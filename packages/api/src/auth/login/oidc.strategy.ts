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
      oidcs.forEach(async (oidcConfig) => {
        let client: BaseClient;
        try {
          // Try to discover OIDC provider, attempting multiple URLs for compatibility
          const discoveryUrls = this.getDiscoveryUrls(oidcConfig.issuer);
          let TrustIssuer: Issuer;
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

          client = new TrustIssuer.Client({
            client_id: oidcConfig.clientId,
            client_secret: oidcConfig.clientSecret,
          });
        } catch (err) {
          Logger.error(`Error registering OIDC provider ${oidcConfig.issuer}: ${err}`);
        }
        if (client) {
          const strategy = new Strategy(
            {
              client,
              params: {
                redirect_uri: `${config.MY_URL_API_PATH}/auth/callback/${oidcConfig.id}`,
                scope: oidcConfig.scope,
              },
              usePKCE: config.USE_PKCE,
            },
            async (_: TokenSet, userinfo, done) => {
              let username: string | undefined = undefined;
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
                  return done(null, user);
                }
              } catch (err) {
                Logger.error(`Database error during authentication for user [${username}]:`, err);
                // Return a database error to trigger appropriate error handling
                return done(new Error('Database connection error during authentication'), false);
              }
            }
          );
          Logger.log(`Registering OIDC provider ${oidcConfig.issuer} with id ${oidcConfig.id}`);
          passport.use(`oidc-${oidcConfig.id}`, strategy);
        }
      });
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

    // If issuer contains localhost or 127.0.0.1 with /auth path, also try internal container URL
    if (issuer.includes('/auth/realms/')) {
      // Extract realm name from issuer
      const realmMatch = issuer.match(/\/auth\/realms\/([^\/]+)/);
      if (realmMatch) {
        const realmName = realmMatch[1];
        // Try internal Docker container URL first (more likely to work from within container)
        urls.push(`http://edfiadminapp-keycloak:8080/auth/realms/${realmName}/.well-known/openid-configuration`);
      }
    }

    // Always try the provided issuer URL
    urls.push(`${issuer}/.well-known/openid-configuration`);

    return urls;
  }
}

export const USER_NOT_FOUND = 'User not found';
export const NO_ROLE = 'No role assigned for user';
export const NO_TEAM_MEMBERSHIPS = 'No team memberships assigned';
