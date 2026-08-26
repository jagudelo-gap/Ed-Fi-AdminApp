import { ActionsType, Icons } from '@edanalytics/common-ui';
import { GetEdfiTenantDto, OWNERSHIP_RESOURCE_TYPE } from '@edanalytics/models';
import { useNavigate } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { edfiTenantQueriesGlobal } from '../../api';
import {
  globalEdfiTenantAuthConfig,
  globalOwnershipAuthConfig,
  popSyncBanner,
  useAuthorize,
  useSbEnvironmentNavContext,
} from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useSearchParamsObject } from '../../helpers/useSearch';

export const useEdfiTenantGlobalActions = (
  edfiTenant: GetEdfiTenantDto | undefined
): ActionsType => {
  const { sbEnvironment } = useSbEnvironmentNavContext();
  const deleteEdfiTenant = edfiTenantQueriesGlobal.delete({
    sbEnvironmentId: edfiTenant?.sbEnvironmentId as number,
  });
  const checkAdminApi = edfiTenantQueriesGlobal.checkConnection({
    sbEnvironmentId: edfiTenant?.sbEnvironmentId as number,
  });
  const refreshResources = edfiTenantQueriesGlobal.refreshResources({
    sbEnvironmentId: edfiTenant?.sbEnvironmentId as number,
  });
  const v2Keygen = edfiTenantQueriesGlobal.v2Keygen({
    sbEnvironmentId: edfiTenant?.sbEnvironmentId as number,
  });

  const popBanner = usePopBanner();
  const searchParams = useSearchParamsObject();
  const navigate = useNavigate();

  const canGrantOwnership = useAuthorize(globalOwnershipAuthConfig('ownership:create'));
  const canView = useAuthorize(
    globalEdfiTenantAuthConfig(edfiTenant?.id, 'sb-environment.edfi-tenant:read')
  );
  const canDelete = useAuthorize(
    globalEdfiTenantAuthConfig(edfiTenant?.id, 'sb-environment.edfi-tenant:delete')
  );
  const canCheckConnection = useAuthorize(
    globalEdfiTenantAuthConfig(edfiTenant?.id, 'sb-environment.edfi-tenant:read')
  );
  const canRefreshResources = useAuthorize(
    globalEdfiTenantAuthConfig(edfiTenant?.id, 'sb-environment.edfi-tenant:refresh-resources')
  );
  const canUpdate = useAuthorize(
    globalEdfiTenantAuthConfig(edfiTenant?.id, 'sb-environment.edfi-tenant:update')
  );

  const edit = 'edit' in searchParams ? searchParams.edit : undefined;

  if (!edfiTenant || !sbEnvironment) {
    return {};
  }
  const adminApiConfigExists =
    !!sbEnvironment.configPublic?.adminApiUrl &&
    ((sbEnvironment.configPublic.version === 'v2' &&
      !!sbEnvironment.configPublic?.values?.tenants?.[edfiTenant.name]?.adminApiKey) ||
      (sbEnvironment.configPublic.version === 'v1' &&
        !!sbEnvironment.configPublic?.values.adminApiKey));
  return {
    ...(canGrantOwnership
      ? {
          GrantOwnership: {
            icon: Icons.ShieldPlus,
            text: 'Grant ownership',
            title: 'Grant ownership of ' + edfiTenant.displayName,
            to: `/ownerships/create?sbEnvironmentId=${edfiTenant.sbEnvironmentId}&edfiTenantId=${edfiTenant.id}&type=${OWNERSHIP_RESOURCE_TYPE.edfiTenant}`,
            onClick: () =>
              navigate(
                `/ownerships/create?sbEnvironmentId=${edfiTenant.sbEnvironmentId}&edfiTenantId=${edfiTenant.id}&type=${OWNERSHIP_RESOURCE_TYPE.edfiTenant}`
              ),
          },
        }
      : {}),
    ...(canView
      ? {
          View: {
            icon: Icons.View,
            text: 'View',
            title: 'View ' + edfiTenant.displayName,
            to: `/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}`,
            onClick: () =>
              navigate(
                `/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}`
              ),
          },
        }
      : {}),
    ...(canDelete && sbEnvironment.startingBlocks
      ? {
          Delete: {
            icon: Icons.Delete,
            isPending: deleteEdfiTenant.isPending,
            text: 'Delete',
            title: 'Delete tenant',
            confirmBody: 'This will permanently delete the tenant.',
            onClick: () =>
              deleteEdfiTenant.mutateAsync(
                { id: edfiTenant.id },
                {
                  ...mutationErrCallback({ popGlobalBanner: popBanner }),
                  onSuccess: () =>
                    navigate(`/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants`),
                }
              ),
            confirm: true,
          },
        }
      : {}),
    ...(canUpdate && sbEnvironment.version === 'v1' && sbEnvironment.startingBlocks
      ? {
          RegisterAdminApi: {
            isIrrelevant: adminApiConfigExists,
            isDisabled: edit === 'admin-api',
            icon: Icons.Cog,
            text: 'Connect Admin API',
            title: 'Setup connection to Ed-Fi Admin API',
            to: `/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}?edit=admin-api`,
            onClick: () =>
              navigate(
                `/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}?edit=admin-api`
              ),
          },
        }
      : {}),
    ...(canUpdate && sbEnvironment.version === 'v2' && sbEnvironment.startingBlocks
      ? {
          AdminApiV2Keygen: {
            isIrrelevant: adminApiConfigExists,
            isPending: v2Keygen.isPending,
            icon: Icons.Cog,
            text: 'Admin API keygen',
            title: 'Auto-generate Admin API creds',
            onClick: async () => {
              v2Keygen.mutateAsync(
                { entity: { id: edfiTenant.id }, pathParams: {} },
                {
                  ...mutationErrCallback({ popGlobalBanner: popBanner }),
                  onSuccess: (res) => popBanner(res),
                }
              );
            },
          },
        }
      : {}),
    ...(canCheckConnection
      ? {
          CheckConnection: {
            icon: Icons.Plug,
            isPending: checkAdminApi.isPending,
            text: 'Ping Admin API',
            title: 'Check connection to Ed-Fi Admin API',
            onClick: async () => {
              checkAdminApi.mutateAsync(
                { entity: edfiTenant, pathParams: {} },
                {
                  ...mutationErrCallback({ popGlobalBanner: popBanner }),
                  onSuccess: (res) => popBanner(res),
                }
              );
            },
          },
        }
      : {}),
    ...(canRefreshResources && !sbEnvironment.startingBlocks && sbEnvironment.version === 'v2'
      ? {
          RefreshResources: {
            icon: Icons.Download,
            isPending: refreshResources.isPending,
            text: 'Sync Resources',
            title: 'Sync ODSs and Ed-Orgs from Admin API.',
            onClick: async () => {
              await refreshResources.mutateAsync(
                { entity: edfiTenant, pathParams: null },
                {
                  ...mutationErrCallback({ popGlobalBanner: popBanner }),
                  onSuccess(result, _variables, _context) {
                    popSyncBanner({
                      popBanner,
                      syncQueue: result,
                    });
                  },
                }
              );
            },
          },
        }
      : {}),
  };
};
