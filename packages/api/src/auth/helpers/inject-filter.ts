import {
  AuthorizationCache,
  Ids,
  isCachedByEdfiTenant,
  isCachedBySbEnvironment,
  PrivilegeCode,
  SpecificIds,
} from '@edanalytics/models';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const InjectFilter = createParamDecorator(
  (privilege: PrivilegeCode, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const cache: AuthorizationCache = request.authorizationCache;

    let ids: Ids | undefined;

    if (isCachedByEdfiTenant(privilege)) {
      const edfiTenantId = Number(request?.params?.edfiTenantId);
      ids = cache?.[privilege]?.[edfiTenantId] ?? undefined;
    } else if (isCachedBySbEnvironment(privilege)) {
      const sbEnvironmentId = Number(request?.params?.sbEnvironmentId);
      ids = cache?.[privilege]?.[sbEnvironmentId] ?? undefined;
    } else {
      ids = cache?.[privilege] ?? undefined;
    }

    if (ids === undefined) return new Set() as SpecificIds;
    return ids;
  }
);
