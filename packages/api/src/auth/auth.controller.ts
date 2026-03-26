import {
  AuthorizationCache,
  GetSessionDataDto,
  PrivilegeCode,
  isBaseTeamPrivilege,
  isGlobalPrivilege,
  isCachedByEdfiTenant,
  toGetSessionDataDto,
  toGetTeamDto,
  isCachedBySbEnvironment,
} from '@edanalytics/models';
import { Team, Oidc } from '@edanalytics/models-server';
import {
  BadRequestException,
  Controller,
  Get,
  Header,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Param,
  Query,
  Request as Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import config from 'config';
import { randomUUID } from 'crypto';
import type { Response, Request } from 'express';
import passport from 'passport';
import { Repository } from 'typeorm';
import { Authorize, NoAuthorization } from './authorization';
import { Public } from './authorization/public.decorator';
import { AuthCache } from './helpers/inject-auth-cache';
import { ReqUser } from './helpers/user.decorator';
import { NO_ROLE, USER_NOT_FOUND } from './login/oidc.strategy';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    @InjectRepository(Team)
    private readonly teamsRepository: Repository<Team>,
    @InjectRepository(Oidc)
    private readonly oidcRepository: Repository<Oidc>,
    private readonly authService: AuthService
  ) {}

  throwOnBearerToken({ request, route }: { request: Request; route: string }) {
    const [type] = request.headers['authorization']?.split(' ') ?? [];
    if (type === 'Bearer') {
      throw new BadRequestException(`Bearer token authentication not supported for ${route}.`);
    }
  }

  @Public()
  @Get('/login/:oidcId')
  oidcLogin(@Param('oidcId') oidcId: number, @Req() request: Request, @Res() response: Response) {
    this.throwOnBearerToken({ request, route: 'oidc login' });

    // Validate and whitelist redirect URL
    const requestedRedirect = request.query?.redirect as string;
    const safeRedirect = this.validateRedirectUrl(requestedRedirect);
    Logger.log(`Using safe redirect URL: ${safeRedirect}`);
    passport.authenticate(`oidc-${oidcId}`, {
      state: JSON.stringify({
        redirect: safeRedirect,
        random: randomUUID(),
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })(request, response, (error: any) => {
      Logger.error(error);
      if (error?.message.includes('Unknown authentication strategy')) {
        throw new NotFoundException();
      } else {
        throw new InternalServerErrorException();
      }
    });
  }

  @Public()
  @Get('/callback/:oidcId')
  oidcLoginCallback(
    @Param('oidcId') oidcId: number,
    @Req() request: Request,
    @Res() response: Response
  ) {
    this.throwOnBearerToken({ request, route: 'oidc callback' });

    let redirect = '/';
    try {
      const state = JSON.parse(request.query.state as string);
      // Validate redirect URL again in callback for extra security
      redirect = this.validateRedirectUrl(state.redirect);
    } catch (error) {
      // Use default redirect
    }
    passport.authenticate(`oidc-${oidcId}`, {
      successRedirect: `${config.FE_URL}${redirect}`,
      failureRedirect: `${config.FE_URL}/unauthenticated`,
    })(request, response, (error: Error) => {
      Logger.error(error);

      if (error.message === USER_NOT_FOUND) {
        response.redirect(
          `${config.FE_URL}/unauthenticated?msg=Oops, it looks like your user hasn't been created yet. We'll let you know when you can log in.`
        );
      } else if (error.message === NO_ROLE) {
        response.redirect(
          `${config.FE_URL}/unauthenticated?msg=Your login worked, but it looks like your setup isn't quite complete. We'll let you know when everything's ready.`
        );
      } else if (
        error.message?.startsWith('did not find expected authorization request details in session')
      ) {
        response.redirect(
          `${config.FE_URL}/unauthenticated?msg=Login failed. There may be an issue, but please try again.`
        );
      } else if (error.message?.startsWith('invalid_grant (Code not valid)')) {
        response.redirect(
          `${config.FE_URL}/unauthenticated?msg=It looks like there was a hiccup during login. Please try again.`
        );
      } else if (error.message?.includes('Database connection error')) {
        response.redirect(
          `${config.FE_URL}/unauthenticated?msg=The system is temporarily unavailable. Please try again in a few moments.`
        );
      } else {
        response.redirect(
          `${config.FE_URL}/unauthenticated?msg=It looks like your login was not successful. Please try again and contact us if the issue persists.`
        );
      }
    });
  }

  @Get('me')
  @NoAuthorization()
  @Header('Cache-Control', 'no-store')
  async me(@ReqUser() session: GetSessionDataDto) {
    const userId = session?.id;

    try {
      // Validate user still exists and is active (this is the "deserialization" logic)
      const user = await this.authService.findActiveUserById(userId);

      if (!user || !user.isActive || !user.role) {
        throw new HttpException('User no longer valid', HttpStatus.UNAUTHORIZED);
      }
      return toGetSessionDataDto(session);
    } catch (error) {
      Logger.error(`Error validating user ${session}:`, error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Authentication failed', HttpStatus.UNAUTHORIZED);
    }
  }

  @Get('my-teams')
  @NoAuthorization()
  @Header('Cache-Control', 'no-store')
  async myTeams(
    @ReqUser() session: GetSessionDataDto,
    @AuthCache() privileges: AuthorizationCache
  ) {
    if (privileges['team:read'] === true) {
      return toGetTeamDto(await this.teamsRepository.find());
    } else {
      return toGetTeamDto(session?.userTeamMemberships?.map((utm) => utm.team) ?? []);
    }
  }
  @Get('cache/:teamId?')
  @Authorize({
    privilege: 'me:read',
    subject: {
      id: '__filtered__',
    },
  })
  async privilegeCache(
    @Param('teamId') teamId: string | undefined,
    @Query('edfiTenantId') edfiTenantId: string | undefined,
    @Query('sbEnvironmentId') sbEnvironmentId: string | undefined,
    @AuthCache() cache: AuthorizationCache
  ) {
    const result: Partial<AuthorizationCache> = {};
    if (teamId === undefined) {
      Object.keys(cache).forEach((privilege: PrivilegeCode) => {
        if (isGlobalPrivilege(privilege)) {
          result[privilege] = cache[privilege];
        }
      });
    }
    if (teamId !== undefined && sbEnvironmentId === undefined && edfiTenantId === undefined) {
      Object.keys(cache).forEach((privilege: PrivilegeCode) => {
        if (isBaseTeamPrivilege(privilege)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result[privilege] = cache[privilege] as any;
        }
      });
    }
    if (teamId !== undefined && sbEnvironmentId !== undefined && edfiTenantId === undefined) {
      Object.keys(cache).forEach((privilege: PrivilegeCode) => {
        if (isCachedBySbEnvironment(privilege) && sbEnvironmentId in cache[privilege]) {
          result[privilege] = cache[privilege][sbEnvironmentId];
        }
      });
    }
    if (teamId !== undefined && sbEnvironmentId === undefined && edfiTenantId !== undefined) {
      Object.keys(cache).forEach((privilege: PrivilegeCode) => {
        if (isCachedByEdfiTenant(privilege) && edfiTenantId in cache[privilege]) {
          result[privilege] = cache[privilege][edfiTenantId];
        }
      });
    }
    return result;
  }

  @Get('/post-logout')
  @Public()
  async postLogout(@Res() response: Response) {
    return response.redirect(config.FE_URL);
  }

  @Get('/logout')
  @Public()
  async logout(@Req() request: Request, @Res() response: Response) {
    this.throwOnBearerToken({ request, route: 'logout' });

    try {
      // Get the OIDC providers to construct logout URL
      const oidcProviders = await this.oidcRepository.find();

      // Destroy the local session first
      await new Promise<void>((resolve, reject) => {
        request.session.destroy((err) => {
          if (err) {
            Logger.error('Error destroying session:', err);
            reject(err);
          } else {
            resolve();
          }
        });
      });

      if (oidcProviders.length > 0) {
        // Try to find provider matching the configured client ID (case-insensitive)
        let oidcProvider = oidcProviders[0]; // Default fallback to first provider

        if (config.SAMPLE_OIDC_CONFIG?.clientId) {
          const clientId = config.SAMPLE_OIDC_CONFIG.clientId.toLowerCase();
          const matchingProvider = oidcProviders.find(provider =>
            provider.clientId.toLowerCase() === clientId
          );
          if (matchingProvider) {
            oidcProvider = matchingProvider;
          } else {
            Logger.warn(`No OIDC provider found matching configured clientId: ${config.SAMPLE_OIDC_CONFIG.clientId}, using first available`);
          }
        }

        const logoutUrl = this.constructKeycloakLogoutUrl(oidcProvider.issuer, oidcProvider.clientId);

        if (logoutUrl) {
          return response.redirect(logoutUrl);
        }
      }

      // Fallback: redirect to base URL if no OIDC provider or logout URL construction failed
      Logger.warn('No OIDC logout URL available, redirecting to frontend');
      return response.redirect(config.FE_URL);

    } catch (error) {
      Logger.error('Error during logout process:', error);
      // Even if there's an error, still redirect to base URL
      return response.redirect(config.FE_URL);
    }
  }

  // Constructs a Keycloak logout URL from the OIDC issuer
  private constructKeycloakLogoutUrl(issuer: string, clientId?: string): string | null {
    try {
      if (!issuer || typeof issuer !== 'string') {
        Logger.warn('Invalid issuer provided for logout URL construction');
        return null;
      }

      // Remove trailing slash if present
      const cleanIssuer = issuer.replace(/\/$/, '');
      // Keycloak OIDC logout endpoint is always: {issuer}/protocol/openid-connect/logout
      const logoutEndpoint = `${cleanIssuer}/protocol/openid-connect/logout`;

      // Always redirect to our post-logout endpoint which forwards to frontend
      const redirectUrl = `${config.MY_URL}/api/auth/post-logout`;
      const returnUrl = encodeURIComponent(redirectUrl);

      // Add client_id and post_logout_redirect_uri to bypass confirmation page
      let fullLogoutUrl = `${logoutEndpoint}?post_logout_redirect_uri=${returnUrl}`;

      if (clientId) {
        fullLogoutUrl += `&client_id=${encodeURIComponent(clientId)}`;
      }

      return fullLogoutUrl;
    } catch (error) {
      Logger.error('Failed to construct Keycloak logout URL:', error);
      return null;
    }
  }

  private validateRedirectUrl(redirect: string): string {
    // Default safe redirect
    const defaultRedirect = '/';

    if (!redirect || typeof redirect !== 'string') {
      return defaultRedirect;
    }

    // Allow only relative URLs that start with '/'
    if (redirect.startsWith('/') && !redirect.startsWith('//')) {
      // Additional validation to prevent protocol-relative URLs and malicious paths
      if (redirect.match(/^\/[a-zA-Z0-9\-._~!$&'()*+,;=:@%/?#[\]]*$/) && !/[<>]/.test(redirect)) {
        return redirect;
      }
    }

    // Allow whitelisted absolute URLs (frontend URL from config)
    const allowedHosts = config.WHITELISTED_REDIRECTS || [];

    try {
      const url = new URL(redirect);
      const baseUrl = `${url.protocol}//${url.host}`;

      if (allowedHosts.includes(baseUrl)) {
        return redirect;
      }
    } catch (error) {
      // Invalid URL format
    }

    // Return default redirect for any invalid or non-whitelisted URLs
    return defaultRedirect;
  }
}
