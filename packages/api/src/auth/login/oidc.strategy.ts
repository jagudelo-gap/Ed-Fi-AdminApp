import { Oidc, User } from '@edanalytics/models-server';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import config from 'config';
import { BaseClient, Issuer, Strategy, TokenSet, UserinfoResponse } from 'openid-client';
import passport from 'passport';
import { Repository } from 'typeorm';
import { AuthService } from '../auth.service';
import { OidcProviderRegistry } from './oidc-provider.registry';

export interface OidcLoginInfo {
  idToken?: string;
}

const DEFAULT_OIDC_DISCOVERY_TIMEOUT_MS = 10000;

/**
 * Discovers and registers the configured OIDC providers at startup: it loads
 * the provider rows, runs discovery (bounded by a timeout), wires each one into
 * Passport, and populates the OidcProviderRegistry the rest of the app queries.
 */
@Injectable()
export class OidcIdpBootstrapper implements OnModuleInit {
  constructor(
    @InjectRepository(Oidc)
    private readonly oidcRepo: Repository<Oidc>,
    @Inject(AuthService)
    private readonly authService: AuthService,
    private readonly registry: OidcProviderRegistry
  ) {}

  async onModuleInit(): Promise<void> {
    let oidcConfigs: Oidc[];
    try {
      oidcConfigs = await this.oidcRepo.find();
    } catch (err) {
      Logger.error(`Error loading OIDC provider configurations: ${err}`);
      return;
    }
    this.registry.setConfiguredProviderCount(oidcConfigs.length);
    this.registry.clearFailures();
    await Promise.all(
      oidcConfigs.map((oidcConfig) =>
        this.registerIdp(oidcConfig).catch((err) => {
          this.registry.markFailed(oidcConfig.id);
          Logger.error(`Unexpected error registering OIDC provider ${oidcConfig.issuer}: ${err}`);
        })
      )
    );

    const failedIds = this.registry.getFailedProviderIds();
    if (failedIds.length > 0) {
      Logger.warn(
        `OIDC provider registration incomplete: ${failedIds.length} of ${this.registry.configuredProviderTotal} configured provider(s) failed to register (ids: ${failedIds.join(', ')}). Logout for sessions on those providers will be local-only.`
      );
    }
  }

  /**
   * Runs OIDC discovery with a bounded timeout so a slow or unresponsive
   * provider cannot stall application bootstrap. Rejects when the provider does
   * not answer within the configured budget.
   */
  private async discoverWithTimeout(discoveryUrl: string, timeoutMs: number): Promise<Issuer> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error(`OIDC discovery timed out after ${timeoutMs}ms`)),
        timeoutMs
      );
    });
    try {
      return await Promise.race([Issuer.discover(discoveryUrl), timeout]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private async registerIdp(oidcConfig: Oidc): Promise<void> {
    let client: BaseClient;
    try {
      const timeoutMs = config.OIDC_DISCOVERY_TIMEOUT_MS ?? DEFAULT_OIDC_DISCOVERY_TIMEOUT_MS;
      const trustIssuer = await this.discoverWithTimeout(
        `${oidcConfig.issuer}/.well-known/openid-configuration`,
        timeoutMs
      );
      client = new trustIssuer.Client({
        client_id: oidcConfig.clientId,
        client_secret: oidcConfig.clientSecret,
      });
    } catch (err) {
      this.registry.markFailed(oidcConfig.id);
      Logger.error(`Error registering OIDC provider ${oidcConfig.issuer}: ${err}`);
      return;
    }

    const strategy = new Strategy(
      {
        client,
        params: {
          redirect_uri: `${config.MY_URL_API_PATH}/auth/callback/${oidcConfig.id}`,
          scope: oidcConfig.scope,
        },
        usePKCE: config.USE_PKCE,
      },
      async (
        tokenset: TokenSet,
        userinfo: UserinfoResponse,
        done: (err: Error | null, user?: User | false, info?: OidcLoginInfo) => void
      ) => {
        let username: string;
        if (typeof userinfo.email !== 'string' || userinfo.email === '') {
          throw new Error('Invalid email from IdP');
        } else {
          username = userinfo.email;
        }

        try {
          const user: User = await this.authService.validateUser({ username });
          const emailDomain = username.substring(username.lastIndexOf('@') + 1).toLowerCase();
          const isEaUser = emailDomain === 'edanalytics.org';
          if (user === null) {
            if (!isEaUser) {
              Logger.warn(`LOGIN_ERROR User [${username}] not found in database`);
            }
            return done(new Error(USER_NOT_FOUND), false);
          } else if (user.roleId === null || user.roleId === undefined) {
            if (!isEaUser) {
              Logger.warn(`LOGIN_ERROR No role assigned for User [${username}]`);
            }
            return done(new Error(NO_ROLE), false);
          } else {
            if (!user.userTeamMemberships || user.userTeamMemberships.length === 0) {
              if (!isEaUser) {
                Logger.warn(`LOGIN_ERROR No team memberships assigned for User [${username}]`);
              }
            }
            // Pass the id_token along so the login callback can store it on the
            // session for use as id_token_hint during RP-Initiated Logout
            return done(null, user, { idToken: tokenset.id_token });
          }
        } catch (err) {
          Logger.error(`Database error during authentication for user [${username}]:`, err);
          // Return a database error to trigger appropriate error handling
          return done(new Error('Database connection error during authentication'), false);
        }
      }
    );
    Logger.log(`Registering OIDC provider ${oidcConfig.issuer} with id ${oidcConfig.id}`);
    this.registry.register(oidcConfig.id, client);
    passport.use(`oidc-${oidcConfig.id}`, strategy);
  }
}

export const USER_NOT_FOUND = 'User not found';
export const NO_ROLE = 'No role assigned for user';
export const NO_TEAM_MEMBERSHIPS = 'No team memberships assigned';
