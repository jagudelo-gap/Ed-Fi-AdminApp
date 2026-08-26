import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service';
import { IS_PUBLIC_KEY } from '../authorization/public.decorator';
import config from 'config';
import { JWTPayload } from 'jose';
import { User } from '@edanalytics/models-server';

type AccessTokenPayload = JWTPayload & {
  aud: string | string[];
  azp?: string;            // Keycloak/Auth0/Entra v2: authorized party (client id)
  appid?: string;          // Entra v1.0 access tokens: client app id
  gty?: string;
  scope?: string;          // Keycloak / Auth0 (space-delimited)
  roles?: string[];        // Entra app-only (client_credentials)
  preferred_username?: string;
  client_id?: string;      // Keycloak (via mapper) / Auth0
};

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(AuthService) private readonly authService: AuthService
  ) { }
  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    if (request.isAuthenticated()) {
      try {
        const user = await this.authService.findActiveUserById(request.user.id);

        if (!user || !user.isActive) {
          Logger.warn(`User ${request.user.username} no longer valid - logging out`);
          // Destroy the session safely
          if (request.session && typeof request.session.destroy === 'function') {
            await new Promise<void>((resolve) => {
              request.session.destroy((err) => {
                if (err) Logger.error('Error destroying session:', err);
                resolve();
              });
            });
          }
          // Send 401 response to trigger frontend logout
          throw new HttpException(
            {
              statusCode: HttpStatus.UNAUTHORIZED,
              message: 'Session invalid - user no longer active',
              error: 'Unauthorized'
            },
            HttpStatus.UNAUTHORIZED
          );
        }

        request.user = user;

        return true;
      } catch (err) {
        Logger.error('User validation failed:', err);

        // Destroy the session safely
        if (request.session && typeof request.session.destroy === 'function') {
          await new Promise<void>((resolve) => {
            request.session.destroy((err) => {
              if (err) Logger.error('Error destroying session:', err);
              resolve();
            });
          });
        }

        // If it's already an HttpException, re-throw it
        if (err instanceof HttpException) {
          throw err;
        }

        // Otherwise, throw a new 401
        throw new HttpException(
          {
            statusCode: HttpStatus.UNAUTHORIZED,
            message: 'Authentication failed',
            error: 'Unauthorized'
          },
          HttpStatus.UNAUTHORIZED
        );
      }
    } else {
      // JWT validation logic remains the same...
      const token = this.extractTokenFromHeader(request);
      const verifyResult = await this.authService.verifyBearerJwt(token);

      const AUTH0_CONFIG_SECRET = await config.AUTH0_CONFIG_SECRET;
      if (!AUTH0_CONFIG_SECRET.MACHINE_AUDIENCE) {
        throw new Error('AUTH0_CONFIG_SECRET.MACHINE_AUDIENCE is not defined');
      }

      if (verifyResult.status !== 'success') {
        throw new HttpException(
          {
            statusCode: HttpStatus.UNAUTHORIZED,
            message: verifyResult.message || 'Unauthorized',
            error: 'Unauthorized'
          },
          HttpStatus.UNAUTHORIZED
        );
      }

      const { data } = verifyResult;
      const payload = data as AccessTokenPayload;
      const username = payload.preferred_username;

      // aud may be a string (Keycloak/Auth0/Entra) or an array (some IdPs / jose).
      const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      const audienceMatches = audiences.includes(AUTH0_CONFIG_SECRET.MACHINE_AUDIENCE);

      // Machine client id by IdP convention:
      //   Keycloak / Auth0 -> client_id ; Entra v2 -> azp ; Entra v1 -> appid
      const machineClientId = payload.client_id ?? payload.azp ?? payload.appid;

      // login:app authorization by IdP convention:
      //   Keycloak / Auth0 -> scope ; Entra app-only -> roles
      // Entra delegated `scp` is deliberately excluded: only app-only (machine) tokens qualify.
      const grants = new Set<string>([
        ...(payload.scope?.split(' ') ?? []),
        ...(payload.roles ?? []),
      ]);

      // Keep the original machine signal (explicit client_id) to avoid reclassifying a
      // human Keycloak bearer token (which carries azp but no client_id) as a machine.
      const isMachineClient = !!payload.client_id || (audienceMatches && !username);

      let user: User;
      try {
        if (isMachineClient) {
          if (!audienceMatches || !grants.has('login:app')) {
            throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
          }
          user = await this.authService.validateUser({ clientId: machineClientId });
        } else {
          Logger.verbose(`Authenticating user: ${username}`);
          if (!username || !audiences.includes('account')) {
            throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
          }
          // User token: pass username and clientId (azp) for validation
          user = await this.authService.validateUser({ username, clientId: payload.azp });
        }
        if (user && user.isActive) {
          request.user = user;
          return true;
        } else {
          throw new HttpException('User not found or inactive', HttpStatus.UNAUTHORIZED);
        }
      } catch (error) {
        Logger.error('Machine user validation failed:', error);
        throw new HttpException('Authentication failed', HttpStatus.UNAUTHORIZED);
      }
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers['authorization']?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
