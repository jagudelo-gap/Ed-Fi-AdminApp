import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { PgBossAdapter } from './pg-boss-adapter.service';

// ---------------------------------------------------------------------------
// pg-boss ships as ESM – jest.mock prevents the ESM loader from running.
// We only need the mock object passed to the PgBossAdapter constructor so we
// do not need any type import from 'pg-boss'.
// ---------------------------------------------------------------------------
jest.mock('pg-boss', () => ({}));

// ---------------------------------------------------------------------------
// Minimal pg-boss mock – only the methods exercised by PgBossAdapter
// ---------------------------------------------------------------------------

interface MockBoss {
  start: jest.Mock;
  stop: jest.Mock;
  createQueue: jest.Mock;
  send: jest.Mock;
  findJobs: jest.Mock;
  getJobById: jest.Mock;
  schedule: jest.Mock;
  work: jest.Mock;
}

function buildPgBossMock(): MockBoss {
  return {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    createQueue: jest.fn().mockResolvedValue(undefined),
    send: jest.fn(),
    findJobs: jest.fn().mockResolvedValue([]),
    getJobById: jest.fn(),
    schedule: jest.fn().mockResolvedValue(undefined),
    work: jest.fn().mockResolvedValue(undefined),
  };
}

/** Build a minimal JobWithMetadata shape as returned by pg-boss v12. */
function buildPgJob(overrides: Partial<{
  id: string;
  name: string;
  state: 'created' | 'retry' | 'active' | 'completed' | 'cancelled' | 'failed';
  singletonKey: string | null;
  createdOn: Date;
}> = {}) {
  return {
    id: overrides.id ?? '11111111-1111-1111-1111-111111111111',
    name: overrides.name ?? 'test-queue',
    data: {},
    state: overrides.state ?? 'active',
    priority: 0,
    retryLimit: 0,
    retryCount: 0,
    retryDelay: 0,
    retryBackoff: false,
    startAfter: new Date(),
    startedOn: new Date(),
    singletonKey: overrides.singletonKey ?? null,
    singletonOn: null,
    expireInSeconds: 0,
    deleteAfterSeconds: 0,
    createdOn: overrides.createdOn ?? new Date(),
    completedOn: null,
    keepUntil: new Date(),
    policy: 'standard' as const,
    heartbeatOn: null,
    heartbeatSeconds: null,
    deadLetter: '',
    output: {},
    signal: new AbortController().signal,
  };
}

// ---------------------------------------------------------------------------

describe('PgBossAdapter', () => {
  let boss: ReturnType<typeof buildPgBossMock>;
  let adapter: PgBossAdapter;

  beforeEach(() => {
    boss = buildPgBossMock();
    adapter = new PgBossAdapter(boss as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // send() — normal (non-dedup) path
  // -------------------------------------------------------------------------

  describe('send() — normal path', () => {
    it('stores queueName in the map and returns the job id', async () => {
      boss.send.mockResolvedValue('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');

      const returned = await adapter.send('my-queue', null);

      expect(returned).toBe('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
      // Verify the map entry exists by successfully calling getJobById
      boss.getJobById.mockResolvedValue(buildPgJob({ id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', state: 'active' }));
      await expect(adapter.getJobById('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa')).resolves.toMatchObject({ id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' });
    });
  });

  // -------------------------------------------------------------------------
  // send() — dedup path (boss.send returns null)
  // -------------------------------------------------------------------------

  describe('send() — dedup path', () => {
    it('resolves the real UUID via findJobs when singletonKey is provided and job exists', async () => {
      boss.send.mockResolvedValue(null);
      const realJob = buildPgJob({ id: '22222222-2222-2222-2222-222222222222', state: 'active' });
      boss.findJobs.mockResolvedValue([realJob]);

      const returned = await adapter.send('my-queue', null, { singletonKey: 'my-key' });

      expect(returned).toBe('22222222-2222-2222-2222-222222222222');
      expect(boss.findJobs).toHaveBeenCalledWith('my-queue', { key: 'my-key' });
    });

    it('resolves the real UUID via findJobs when no singletonKey (queue-policy dedup)', async () => {
      boss.send.mockResolvedValue(null);
      const realJob = buildPgJob({ id: '33333333-3333-3333-3333-333333333333', state: 'created' });
      boss.findJobs.mockResolvedValue([realJob]);

      const returned = await adapter.send('my-queue', null);

      expect(returned).toBe('33333333-3333-3333-3333-333333333333');
      // findJobs called with empty options (no key filter)
      expect(boss.findJobs).toHaveBeenCalledWith('my-queue', {});
    });

    it('stores the real UUID in the map so getJobById succeeds (singletonKey case)', async () => {
      boss.send.mockResolvedValue(null);
      boss.findJobs.mockResolvedValue([buildPgJob({ id: '22222222-2222-2222-2222-222222222222', state: 'active' })]);

      const id = await adapter.send('my-queue', null, { singletonKey: 'k' });

      boss.getJobById.mockResolvedValue(buildPgJob({ id: '22222222-2222-2222-2222-222222222222', state: 'active' }));
      await expect(adapter.getJobById(id)).resolves.toMatchObject({ id: '22222222-2222-2222-2222-222222222222' });
      expect(boss.getJobById).toHaveBeenCalledWith('my-queue', '22222222-2222-2222-2222-222222222222');
    });

    it('stores sentinel → queueName in the map when findJobs returns empty (race condition)', async () => {
      boss.send.mockResolvedValue(null);
      boss.findJobs.mockResolvedValue([]);

      const id = await adapter.send('my-queue', null, { singletonKey: 'race-key' });

      // Sentinel is the singletonKey
      expect(id).toBe('race-key');
      // UUID guard must fire before pg-boss is reached: NotFoundException thrown, boss never called
      await expect(adapter.getJobById(id)).rejects.toThrow(NotFoundException);
      expect(boss.getJobById).not.toHaveBeenCalled();
    });

    it('uses "deduped" sentinel when no singletonKey and findJobs is empty', async () => {
      boss.send.mockResolvedValue(null);
      boss.findJobs.mockResolvedValue([]);

      const id = await adapter.send('my-queue', null);

      expect(id).toBe('deduped');
      // UUID guard must fire before pg-boss is reached: NotFoundException thrown, boss never called
      await expect(adapter.getJobById(id)).rejects.toThrow(NotFoundException);
      expect(boss.getJobById).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // getJobById() — map cleanup on terminal state
  // -------------------------------------------------------------------------

  describe('getJobById() — map cleanup', () => {
    const TERMINAL_STATES = ['completed', 'failed', 'cancelled', 'expired'] as const;
    const NON_TERMINAL_STATES = ['created', 'retry', 'active'] as const;

    it.each(TERMINAL_STATES)(
      'removes map entry after returning a "%s" job',
      async (state) => {
        boss.send.mockResolvedValue('44444444-4444-4444-4444-444444444444');
        await adapter.send('q', null);

        // pg-boss reports terminal state
        // We mock the raw pg-boss state to the terminal state via the adapter's internal mapping.
        // For 'expired', pg-boss v12 stores 'failed' with expiry; simulate via the adapter's
        // TERMINAL_STATES set which includes 'expired'.  Instead, mock getJobById to return a
        // fabricated state value matching exactly what the adapter checks.
        boss.getJobById.mockResolvedValue({ ...buildPgJob({ id: '44444444-4444-4444-4444-444444444444' }), state } as ReturnType<typeof buildPgJob>);

        const job = await adapter.getJobById('44444444-4444-4444-4444-444444444444');
        expect(job.state).toBe(state);

        // Second call must fail with NotFoundException (entry was cleaned up)
        await expect(adapter.getJobById('44444444-4444-4444-4444-444444444444')).rejects.toThrow(NotFoundException);
        // pg-boss should NOT be called again for the second attempt
        expect(boss.getJobById).toHaveBeenCalledTimes(1);
      }
    );

    it.each(NON_TERMINAL_STATES)(
      'keeps map entry for non-terminal "%s" state',
      async (state) => {
        boss.send.mockResolvedValue('55555555-5555-5555-5555-555555555555');
        await adapter.send('q', null);

        boss.getJobById.mockResolvedValue(buildPgJob({ id: '55555555-5555-5555-5555-555555555555', state }));

        await adapter.getJobById('55555555-5555-5555-5555-555555555555');

        // Entry still present — second call reaches pg-boss
        boss.getJobById.mockResolvedValue(buildPgJob({ id: '55555555-5555-5555-5555-555555555555', state }));
        await expect(adapter.getJobById('55555555-5555-5555-5555-555555555555')).resolves.toMatchObject({ id: '55555555-5555-5555-5555-555555555555' });
        expect(boss.getJobById).toHaveBeenCalledTimes(2);
      }
    );
  });

  // -------------------------------------------------------------------------
  // getJobById() — unknown id (never sent)
  // -------------------------------------------------------------------------

  describe('getJobById() — unknown id', () => {
    it('throws NotFoundException immediately without calling pg-boss', async () => {
      await expect(adapter.getJobById('unknown-id')).rejects.toThrow(NotFoundException);
      expect(boss.getJobById).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // send() + getJobById() — triggerSync flow simulation
  // -------------------------------------------------------------------------

  describe('triggerSync flow — dedup then poll', () => {
    it('polls the real job UUID returned from findJobs until completed, then cleans up', async () => {
      // First caller sends, gets a real UUID
      boss.send.mockResolvedValue('66666666-6666-6666-6666-666666666666');
      const id = await adapter.send('sync-queue', null);
      expect(id).toBe('66666666-6666-6666-6666-666666666666');

      // Poll 1 — still active
      boss.getJobById.mockResolvedValueOnce(buildPgJob({ id: '66666666-6666-6666-6666-666666666666', state: 'active' }));
      const active = await adapter.getJobById(id);
      expect(active.state).toBe('active');

      // Poll 2 — completed (terminal)
      boss.getJobById.mockResolvedValueOnce({ ...buildPgJob({ id: '66666666-6666-6666-6666-666666666666' }), state: 'completed' } as ReturnType<typeof buildPgJob>);
      const done = await adapter.getJobById(id);
      expect(done.state).toBe('completed');

      // Map cleaned up — third call must throw
      await expect(adapter.getJobById(id)).rejects.toThrow(NotFoundException);
      expect(boss.getJobById).toHaveBeenCalledTimes(2);
    });

    it('second concurrent send (dedup) resolves same real UUID and can poll', async () => {
      // First send gets a real UUID
      boss.send.mockResolvedValueOnce('77777777-7777-7777-7777-777777777777');
      await adapter.send('sync-queue', null);

      // Second send is deduped; findJobs returns the existing job
      boss.send.mockResolvedValueOnce(null);
      boss.findJobs.mockResolvedValue([buildPgJob({ id: '77777777-7777-7777-7777-777777777777', state: 'active' })]);
      const id2 = await adapter.send('sync-queue', null);

      // Both resolve to the same UUID
      expect(id2).toBe('77777777-7777-7777-7777-777777777777');

      boss.getJobById.mockResolvedValue(buildPgJob({ id: '77777777-7777-7777-7777-777777777777', state: 'active' }));
      await expect(adapter.getJobById(id2)).resolves.toMatchObject({ id: '77777777-7777-7777-7777-777777777777' });
    });
  });

  // -------------------------------------------------------------------------
  // send() — dedup findJobs ordering (Defect 2)
  // -------------------------------------------------------------------------

  describe('send() — dedup findJobs ordering', () => {
    beforeEach(() => {
      boss.send.mockResolvedValue(null);
    });

    it('picks the in-flight job over a stale terminal job', async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);
      boss.findJobs.mockResolvedValue([
        buildPgJob({ id: 'a0000000-0000-0000-0000-000000000001', state: 'completed', createdOn: tenMinutesAgo }),
        buildPgJob({ id: 'a0000000-0000-0000-0000-000000000002', state: 'active',    createdOn: oneMinuteAgo  }),
      ]);

      const returned = await adapter.send('my-queue', null, { singletonKey: 'k' });

      expect(returned).toBe('a0000000-0000-0000-0000-000000000002');
    });

    it('picks the newest in-flight job when multiple in-flight jobs exist', async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const oneMinuteAgo  = new Date(Date.now() - 1 * 60 * 1000);
      boss.findJobs.mockResolvedValue([
        buildPgJob({ id: 'b0000000-0000-0000-0000-000000000001', state: 'active',  createdOn: fiveMinutesAgo }),
        buildPgJob({ id: 'b0000000-0000-0000-0000-000000000002', state: 'created', createdOn: oneMinuteAgo  }),
      ]);

      const returned = await adapter.send('my-queue', null, { singletonKey: 'k' });

      expect(returned).toBe('b0000000-0000-0000-0000-000000000002');
    });

    it('picks the newest terminal job when all jobs are in terminal state (no in-flight)', async () => {
      const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
      const fiveMinutesAgo   = new Date(Date.now() -  5 * 60 * 1000);
      boss.findJobs.mockResolvedValue([
        buildPgJob({ id: 'c0000000-0000-0000-0000-000000000001', state: 'completed', createdOn: twentyMinutesAgo }),
        buildPgJob({ id: 'c0000000-0000-0000-0000-000000000002', state: 'completed', createdOn: fiveMinutesAgo   }),
      ]);

      const returned = await adapter.send('my-queue', null, { singletonKey: 'k' });

      expect(returned).toBe('c0000000-0000-0000-0000-000000000002');
    });
  });
});
