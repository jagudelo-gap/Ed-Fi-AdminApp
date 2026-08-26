// pg-boss.module.ts
import { Global, Injectable, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { PgBoss } from 'pg-boss';
import { Client } from 'pg';
import * as appConfig from 'config';

const log = new Logger('PgBoss');
const onceKeys = new Set<string>();

function logOnce(key: string, msg: string, meta?: Record<string, unknown>) {
  if (onceKeys.has(key)) return;
  onceKeys.add(key);
  if (meta) {
    log.error(msg + ' ' + JSON.stringify(meta));
  } else {
    log.error(msg);
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class PgBossInstance extends PgBoss implements OnApplicationShutdown {
  // store the background checker timer id on the instance
  private _recoveryTimer?: ReturnType<typeof setInterval>;

  setRecoveryTimer(t: ReturnType<typeof setInterval> | undefined) {
    this._recoveryTimer = t;
  }

  async onApplicationShutdown() {
    try {
      if (this._recoveryTimer) {
        clearInterval(this._recoveryTimer);
        this._recoveryTimer = undefined;
      }
      await this.stop({ graceful: false });
    } catch {
      // ignore
    }
  }
}

@Global()
@Module({
  providers: [
    {
      provide: 'PgBossInstance',
      useFactory: async () => {
        if (appConfig.DB_ENGINE === 'mssql') {
          // mssql is not yet supported
          return null;
        }

        const connectionString = await appConfig.DB_CONNECTION_STRING;

        if (!connectionString) {
          throw new Error('Missing DB_CONNECTION_STRING (config or env).');
        }

        const boss = new PgBossInstance({ connectionString });

        // ---- collapse repeated worker errors, stop boss on ECONNREFUSED ----
        let stoppedDueToConnRefused = false;

        boss.on('error', async (err: { code?: string; message?: string; queue?: string }) => {
          const code = err?.code ?? 'UNKNOWN';
          const queue =
            /Queue:\s*([^\s,]+)/.exec(String(err?.message ?? ''))?.[1] ?? err?.queue ?? 'unknown';
          const key = `${code}:${queue}`;

          if (code === 'ECONNREFUSED') {
            if (!stoppedDueToConnRefused) {
              stoppedDueToConnRefused = true;
              logOnce(
                key,
                'Database connection refused. Stopping PgBoss to prevent repeated error spam.',
                { code, queue }
              );
              try {
                await boss.stop({ graceful: false });
              } catch {
                // ignore
              }
            }
            return;
          }

          // For any other error, still log once per (code:queue)
          logOnce(key, 'PgBoss error (logged once).', {
            code,
            queue,
            message: err?.message,
          });
        });

        // ---- start with small bounded retries (quiet, then throw once) ----
        const maxAttempts = 5;
        const baseDelayMs = 500;
        let started = false;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            await boss.start();
            started = true;
            log.log(`PgBoss started (attempt ${attempt}/${maxAttempts}).`);
            break;
          } catch (err: unknown) {
            const code = (err as { code?: string } | undefined)?.code ?? 'UNKNOWN';
            if (code === 'ECONNREFUSED') {
              const delay = baseDelayMs * Math.pow(2, attempt - 1);
              if (attempt === 1) {
                logOnce(
                  'start:ECONNREFUSED',
                  'PgBoss start refused connection. Retrying briefly…',
                  { attempt, maxAttempts }
                );
              }
              if (attempt === maxAttempts) {
                // final failure: throw once
                throw new Error('PgBoss failed to start after retries due to ECONNREFUSED.', {
                  cause: err,
                });
              }
              await wait(delay);
              continue;
            }
            // Non-ECONNREFUSED: rethrow immediately
            throw err;
          }
        }

        // ---- background recovery: restart boss after DB returns ----
        // If we ever stopped due to ECONNREFUSED, try to bring it back every 30s.
        const intervalMs = 30_000;
        const timer = setInterval(async () => {
          if (!stoppedDueToConnRefused) return;

          try {
            // Quick reachability probe using pg Client.
            const client = new Client({ connectionString });
            await client.connect();
            await client.end();

            log.log('Database reachable again. Restarting PgBoss…');
            await boss.start(); // safe to call after stop
            stoppedDueToConnRefused = false;
            log.log('PgBoss restarted successfully.');
          } catch {
            // still down
          }
        }, intervalMs);

        boss.setRecoveryTimer(timer);

        // optional: if we never started (shouldn’t happen due to throw), ensure stopped flag
        if (!started) {
          stoppedDueToConnRefused = true;
        }

        return boss;
      },
    },
  ],
  exports: [
    {
      useExisting: 'PgBossInstance',
      provide: 'PgBossInstance',
    },
  ],
})
export class PgBossModule {}
