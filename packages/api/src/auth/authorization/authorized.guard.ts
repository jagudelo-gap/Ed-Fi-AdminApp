import { subject } from '@casl/ability';
import { AuthorizationCache } from '@edanalytics/models';
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service';
import { AUTHORIZE_KEY, AuthorizeMetadata } from './authorize.decorator';
import { abilityFromCache } from './helpers';
import { IS_PUBLIC_KEY } from './public.decorator';

// The use of __filtered__ is means the response data will be filtered by the business logic
// This is instead of the authorized guard handling the check which is the more normal thing

@Injectable()
export class AuthorizedGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(AuthService) private readonly authService: AuthService
  ) {}
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
      const authorizationCache: AuthorizationCache = request['authorizationCache'];

      const teamIdStr = request.params?.teamId;
      try {
        const ability = abilityFromCache(authorizationCache, teamIdStr);

        request['abilities'] = ability;

        const authorizeRule = this.reflector.getAllAndOverride<
          AuthorizeMetadata | undefined | null
        >(AUTHORIZE_KEY, [context.getHandler(), context.getClass()]);

        if (authorizeRule === undefined) {
          // Each route _must_ define its authorization rule or skip authorization _explicitly_.
          Logger.error('Authorization rule not defined for route' + request.url);
          return false;
        } else if (authorizeRule === null) {
          Logger.verbose('Authorization explicitly skipped for route' + request.url);
        } else {
          function checkAbility(authorizeRule: AuthorizeMetadata) {
            const privilege = authorizeRule.privilege;
            const subjectTemplate = authorizeRule.subject;

            let subjectTeam = {};
            if ('teamId' in subjectTemplate) {
              const value = request.params[subjectTemplate.teamId];
              if (value === undefined) {
                throw new Error('Attempting to authorize by team but no teamId found in request.');
              }
              subjectTeam = {
                teamId: value,
              };
            }

            let subjectSbEnvironment = {};
            if ('sbEnvironmentId' in subjectTemplate) {
              const value = request.params[subjectTemplate.sbEnvironmentId];
              if (value === undefined) {
                throw new Error(
                  'Attempting to authorize by sbEnvironment but no sbEnvironmentId found in request.'
                );
              }
              subjectSbEnvironment = {
                sbEnvironmentId: value,
              };
            }

            let subjectEdfiTenant = {};
            if ('edfiTenantId' in subjectTemplate) {
              const value = request.params[subjectTemplate.edfiTenantId];
              if (value === undefined) {
                throw new Error(
                  'Attempting to authorize by edfiTenant but no edfiTenantId found in request.'
                );
              }
              subjectEdfiTenant = {
                edfiTenantId: value,
              };
            }

            let subjectId: string;
            if (subjectTemplate.id === '__filtered__') {
              subjectId = '__filtered__';
            } else {
              const value = request.params[subjectTemplate.id];
              if (value === undefined) {
                throw new Error('Attempting to authorize by Id but no Id found in request.');
              }
              subjectId = value;
            }
            const subjectObject: AuthorizeMetadata['subject'] = {
              ...subjectTeam,
              ...subjectEdfiTenant,
              ...subjectSbEnvironment,
              id: subjectId,
            };
            subject(privilege, subjectObject);
            const authorizationResult = ability.can(privilege, subjectObject);
            return authorizationResult;
          }
          request['checkAbility'] = checkAbility;
          const authorizationResult = checkAbility(authorizeRule);
          if (!authorizationResult) {
            throw new HttpException('Unauthorized', 403);
          }
        }
      } catch (authorizationSystemError) {
        Logger.log(authorizationSystemError);
        return false;
      }

      return true;
    } else {
      return false;
    }
  }
}
