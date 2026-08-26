import { GetSbEnvironmentDto, OWNERSHIP_RESOURCE_TYPE } from '@edanalytics/models';
import { useNavigate } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { sbEnvironmentQueriesGlobal } from '../../api';
import {
  globalOwnershipAuthConfig,
  globalSbEnvironmentAuthConfig,
  popSyncBanner,
  useAuthorize,
} from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { Icons } from '@edanalytics/common-ui';
import { config } from '../../../config/config';

export const useSbEnvironmentGlobalActions = (sbEnvironment: GetSbEnvironmentDto | undefined) => {
  const refreshResources = sbEnvironmentQueriesGlobal.refreshResources({});
  const deleteSbEnvironment = sbEnvironmentQueriesGlobal.delete({});
  const reloadTenants = sbEnvironmentQueriesGlobal.reloadTenants({});

  const searchParams = useSearchParamsObject();
  const edit = 'edit' in searchParams ? searchParams.edit : undefined;

  const popBanner = usePopBanner();

  const navigate = useNavigate();

  const canGrantOwnership = useAuthorize(globalOwnershipAuthConfig('ownership:create'));
  const canView = useAuthorize(
    globalSbEnvironmentAuthConfig(sbEnvironment?.id, 'sb-environment:read')
  );
  const canUpdate = useAuthorize(
    globalSbEnvironmentAuthConfig(sbEnvironment?.id, 'sb-environment:update')
  );
  const canDelete = useAuthorize(
    globalSbEnvironmentAuthConfig(sbEnvironment?.id, 'sb-environment:delete')
  );
  const canRefreshResources = useAuthorize(
    globalSbEnvironmentAuthConfig(sbEnvironment?.id, 'sb-environment:refresh-resources')
  );

  return sbEnvironment === undefined
    ? {}
    : {
        ...(canGrantOwnership
          ? {
              GrantOwnership: {
                icon: Icons.ShieldPlus,
                text: 'Grant ownership',
                title: 'Grant ownership of ' + sbEnvironment.displayName,
                to: `/ownerships/create?sbEnvironmentId=${sbEnvironment.id}&type=${OWNERSHIP_RESOURCE_TYPE.sbEnvironment}`,
                onClick: () =>
                  navigate(
                    `/ownerships/create?sbEnvironmentId=${sbEnvironment.id}&type=${OWNERSHIP_RESOURCE_TYPE.sbEnvironment}`
                  ),
              },
            }
          : {}),
        ...(canView
          ? {
              View: {
                icon: Icons.View,
                text: 'View',
                title: 'View ' + sbEnvironment.displayName,
                to: `/sb-environments/${sbEnvironment.id}`,
                onClick: () => navigate(`/sb-environments/${sbEnvironment.id}`),
              },
            }
          : {}),
        ...(config.showRequestCertification && sbEnvironment.version === 'v1'
          ? {
              RequestCert: {
                icon: Icons.Data,
                text: 'Request certification',
                title: 'Request certification for ' + sbEnvironment.displayName,
                to: `/sb-environments/${sbEnvironment.id}/request-certification`,
                onClick: () =>
                  navigate(`/sb-environments/${sbEnvironment.id}/request-certification`),
              },
            }
          : {}),
        ...(canUpdate && sbEnvironment.startingBlocks
          ? {
              EditSbMeta: {
                isIrrelevant: !!sbEnvironment.configPublic?.sbEnvironmentMetaArn,
                isDisabled: edit === 'sb-environment-meta',
                icon: Icons.Data,
                text: 'Connect SB Meta',
                title: 'Setup connection to Starting Blocks metadata API',
                to: `/sb-environments/${sbEnvironment.id}?edit=sb-environment-meta`,
                onClick: () =>
                  navigate(`/sb-environments/${sbEnvironment.id}?edit=sb-environment-meta`),
              },
            }
          : {}),
        ...(canUpdate && sbEnvironment.startingBlocks
          ? {
              Rename: {
                isDisabled: edit === 'name',
                icon: Icons.Rename,
                text: 'Rename',
                title: 'Rename the environment',
                to: `/sb-environments/${sbEnvironment.id}?edit=name`,
                onClick: () => navigate(`/sb-environments/${sbEnvironment.id}?edit=name`),
              },
            }
          : {}),
        ...(canUpdate && !sbEnvironment.startingBlocks
          ? {
              Edit: {
                icon: Icons.Edit,
                text: 'Edit',
                title: 'Edit environment details',
                to: `/sb-environments/${sbEnvironment.id}/edit`,
                onClick: () => navigate(`/sb-environments/${sbEnvironment.id}/edit`),
              },
            }
          : {}),
        ...(canDelete
          ? {
              Delete: {
                icon: Icons.Delete,
                isPending: deleteSbEnvironment.isPending,
                text: 'Delete',
                title: 'Delete environment',
                confirmBody: 'This will permanently delete the environment.',
                onClick: () =>
                  deleteSbEnvironment.mutateAsync(
                    { id: sbEnvironment.id },
                    {
                      ...mutationErrCallback({ popGlobalBanner: popBanner }),
                      onSuccess: () => navigate(`/sb-environments`),
                    }
                  ),
                confirm: true,
              },
            }
          : {}),
        ...(canRefreshResources && !sbEnvironment.startingBlocks && sbEnvironment.version !== 'v1'
          ? {
              RefreshResources: {
                icon: Icons.Download,
                isPending: refreshResources.isPending,
                text: 'Sync Resources',
                title: 'Sync ODSs and Ed-Orgs from Admin API.',
                onClick: async () => {
                  await refreshResources.mutateAsync(
                    { entity: sbEnvironment, pathParams: null },
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
        ...(canUpdate && sbEnvironment.version === 'v2' && sbEnvironment.startingBlocks
          ? {
              Restart: {
                isPending: reloadTenants.isPending,
                icon: Icons.Refresh,
                text: 'Reload tenants',
                title: 'Reload tenants in the Admin API server',
                onClick: async () => {
                  await reloadTenants.mutateAsync(
                    { entity: sbEnvironment, pathParams: null },
                    {
                      ...mutationErrCallback({ popGlobalBanner: popBanner }),
                      onSuccess(result, _variables, _context) {
                        popBanner(result);
                      },
                    }
                  );
                },
              },
            }
          : {}),
      };
};
