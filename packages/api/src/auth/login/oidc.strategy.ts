import { Oidc, User } from '@edanalytics/models-server';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import config from 'config';
import { BaseClient, Issuer, Strategy, TokenSet } from 'openid-client';
import passport from 'passport';
import { Repository } from 'typeorm';
import { AuthService } from '../auth.service';

@Injectable()
export class RegisterOidcIdpsService {
  constructor(
    @InjectRepository(Oidc)
    private readonly oidcRepo: Repository<Oidc>,
    @Inject(AuthService)
    private readonly authService: AuthService
  ) {
    this.oidcRepo.find().then((oidcs) => {
      Logger.log(`Found ${oidcs.length} OIDC provider(s) to register`);

      oidcs.forEach(async (oidcConfig) => {
        let client: BaseClient;
        let TrustIssuer: Issuer | null = null;

        try {
          Logger.log(`Initializing OIDC provider: id=${oidcConfig.id}, issuer=${oidcConfig.issuer}`);

          // Try to discover OIDC provider, attempting multiple URLs for compatibility
          const discoveryUrls = this.getDiscoveryUrls(oidcConfig.issuer);
          let lastError: Error | null = null;

          for (const discoveryUrl of discoveryUrls) {
            try {
              Logger.debug(`Attempting OIDC discovery at ${discoveryUrl}`);
              TrustIssuer = await Issuer.discover(discoveryUrl);
              Logger.log(`Successfully discovered OIDC provider at ${discoveryUrl}`);
              break;
            } catch (err) {
              lastError = err as Error;
              Logger.debug(`Failed to discover at ${discoveryUrl}: ${err}`);
              continue;
            }
          }

          if (!TrustIssuer) {
            throw lastError || new Error('Could not discover OIDC provider with any URL');
          }

          // Rewrite all non-issuer endpoint URLs to use the internal container base URL.
          // Discovery may succeed via internal URL but the returned metadata still contains
          // external URLs (e.g. https://localhost/auth/...) for token_endpoint, userinfo_endpoint, etc.
          // The API container cannot reach https://localhost (it resolves to itself, not nginx),
          // so we replace the external base with the internal one for all backchannel calls.
          const internalBase = this.getInternalBaseUrl(oidcConfig.issuer);
          if (internalBase) {
            const externalBase = oidcConfig.issuer;
            const rewrittenMetadata: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(TrustIssuer.metadata)) {
              // Keep 'issuer' as external URL so token 'iss' claim validation passes
              if (key !== 'issuer' && typeof value === 'string' && value.startsWith(externalBase)) {
                rewrittenMetadata[key] = value.replace(externalBase, internalBase);
              } else {
                rewrittenMetadata[key] = value;
              }
            }
            TrustIssuer = new Issuer(rewrittenMetadata as any);
            Logger.log(`Rewrote OIDC endpoints to use internal base URL: ${internalBase}`);
          }

          client = new TrustIssuer.Client({
            client_id: oidcConfig.clientId,
            client_secret: oidcConfig.clientSecret,
          });
        } catch (err) {
          Logger.error(`Error registering OIDC provider ${oidcConfig.issuer}: ${err}`);
          Logger.error(`Error details: ${err instanceof Error ? err.stack : 'No stack trace'}`);
          return;
        }

        if (!client) {
          Logger.error(`Failed to create OIDC client for provider ${oidcConfig.id}`);
          return;
        }

        try {
          Logger.log(`Setting up OIDC strategy for provider ${oidcConfig.id}:`);
          Logger.log(`  - Redirect URI: ${config.MY_URL_API_PATH}/auth/callback/${oidcConfig.id}`);
          Logger.log(`  - Scope: ${oidcConfig.scope || '(default)'}`);
          Logger.log(`  - usePKCE: ${config.USE_PKCE}`);

          const strategy = new Strategy(
            {
              client,
              params: {
                redirect_uri: `${config.MY_URL_API_PATH}/auth/callback/${oidcConfig.id}`,
                scope: oidcConfig.scope || 'openid profile email',
              },
              usePKCE: config.USE_PKCE,
            },
            async (_: TokenSet, userinfo: any, done: any) => {
              let username: string | undefined = undefined;
              try {
                Logger.debug(`OIDC callback received. UserInfo: ${JSON.stringify(userinfo)}`);

                if (typeof userinfo.email !== 'string' || userinfo.email === '') {
                  Logger.error(`LOGIN_ERROR Invalid or missing email from IdP: ${JSON.stringify(userinfo)}`);
                  return done(new Error('Invalid email from IdP'), false);
                }
                username = userinfo.email;
                Logger.debug(`Processing login for user: ${username}`);

                const user: User | null = await this.authService.validateUser({ username });
                const emailDomain = username!.substring(username!.lastIndexOf('@') + 1).toLowerCase();
                const isEaUser = emailDomain === 'edanalytics.org';

                if (user === null) {
                  if (!isEaUser) {
                    Logger.warn(`LOGIN_ERROR User [${username}] not found in database`);
                  }
                  return done(new Error(USER_NOT_FOUND), false);
                }

                if (user.roleId === null || user.roleId === undefined) {
                  if (!isEaUser) {
                    Logger.warn(`LOGIN_ERROR No role assigned for User [${username}]`);
                  }
                  return done(new Error(NO_ROLE), false);
                }

                if (!user.userTeamMemberships || user.userTeamMemberships.length === 0) {
                  if (!isEaUser) {
                    Logger.warn(`LOGIN_WARNING No team memberships assigned for User [${username}], but login will proceed`);
                  }
                }

                Logger.log(`LOGIN_SUCCESS User [${username}] authenticated successfully with role ${user.roleId}`);
                return done(null, user);
              } catch (err) {
                Logger.error(`Database error during authentication for user [${username}]: ${err}`);
                Logger.error(`Error stack: ${err instanceof Error ? err.stack : 'No stack trace'}`);
                // Return a database error to trigger appropriate error handling
                return done(new Error('Database connection error during authentication'), false);
              }
            }
          );
          Logger.log(`Registering OIDC provider ${oidcConfig.issuer} with id ${oidcConfig.id}`);
          passport.use(`oidc-${oidcConfig.id}`, strategy);
          Logger.log(`✓ OIDC strategy registered successfully for provider ${oidcConfig.id}`);
        } catch (strategyErr) {
          Logger.error(`Error creating OIDC strategy for provider ${oidcConfig.id}: ${strategyErr}`);
          Logger.error(`Error details: ${strategyErr instanceof Error ? strategyErr.stack : 'No stack trace'}`);
        }
      });
    }).catch((err) => {
      Logger.error(`Error loading OIDC providers from database: ${err}`);
      Logger.error(`Error details: ${err instanceof Error ? err.stack : 'No stack trace'}`);
    });
  }

  /**
   * Generate a list of discovery URLs to try for a given issuer.
   * This handles both internal Docker container URLs and external URLs.
   * @param issuer The issuer URL (typically external URL like https://localhost/auth/realms/edfi)
   * @returns Array of discovery URLs to try
   */
  private getDiscoveryUrls(issuer: string): string[] {
    const urls: string[] = [];

    // If issuer contains /auth/realms/, also try internal container URL
    if (issuer.includes('/auth/realms/')) {
      const realmMatch = issuer.match(/\/auth\/realms\/([^\/]+)/);
      if (realmMatch) {
        const realmName = realmMatch[1];
        // Try internal Docker container URL first (more reliable within Docker network)
        urls.push(`http://edfiadminapp-keycloak:8080/auth/realms/${realmName}/.well-known/openid-configuration`);
      }
    }

    // Always include the provided issuer URL as fallback
    urls.push(`${issuer}/.well-known/openid-configuration`);

    return urls;
  }

  /**
   * Derive the internal Docker container base URL from the external issuer URL.
   * Returns null if we cannot determine an internal URL (e.g. non-Keycloak issuers).
   */
  private getInternalBaseUrl(issuer: string): string | null {
    const realmMatch = issuer.match(/\/auth\/realms\/([^\/]+)/);
    if (realmMatch) {
      const realmName = realmMatch[1];
      return `http://edfiadminapp-keycloak:8080/auth/realms/${realmName}`;
    }
    return null;
  }
}

export const USER_NOT_FOUND = 'User not found';
export const NO_ROLE = 'No role assigned for user';
export const NO_TEAM_MEMBERSHIPS = 'No team memberships assigned';
