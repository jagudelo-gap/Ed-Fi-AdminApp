import { ActionsType, Icons } from '@edanalytics/common-ui';

import { edorgKeyV2 } from '@edanalytics/models';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import {
  useAuthorize,
  useNavToParent,
  useTeamEdfiTenantNavContext,
  useTeamEdfiTenantNavContextLoaded,
} from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { QUERY_KEYS } from '../../api-v2/queryKeys';
import { ApplicationEntity, getDataStoreIds, useApplicationConfig } from './applicationConfig';

export const useSingleApplicationActions = ({
  application,
}: {
  application: ApplicationEntity | undefined;
}): ActionsType => {
  const queryClient = useQueryClient();
  const { edfiTenantId, asId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const navigate = useNavigate();
  const location = useLocation();
  const popBanner = usePopBanner();
  const { version, queries } = useApplicationConfig();

  const deleteApplication = queries.delete({
    edfiTenant,
    teamId: asId,
  });

  const search = useSearchParamsObject();
  const onApplicationPage =
    application && location.pathname.endsWith(`/applications/${application.id}`);
  const inEdit = onApplicationPage && 'edit' in search && search?.edit === 'true';

  const parentPath = useNavToParent();

  const dataStoreIds = application ? getDataStoreIds(application) : [];

  const canEdit = useAuthorize(
    application
      ? dataStoreIds.flatMap((odsInstanceId) =>
          application.educationOrganizationIds.map((educationOrganizationIds) => ({
            privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:update',
            subject: {
              edfiTenantId: Number(edfiTenantId),
              teamId: Number(asId),
              id: edorgKeyV2({
                edorg: educationOrganizationIds,
                ods: odsInstanceId,
              }),
            },
          }))
        )
      : undefined
  );

  // TODO add "or" option to multi-configured useAuthorize
  const canView = true; /* useAuthorize(
    application && {
      privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:read',
      subject: {
        edfiTenantId: Number(edfiTenantId),
        teamId: Number(teamId),
        id: createEdorgCompositeNaturalKey({
          educationOrganizationId: application.educationOrganizationId,
          odsDbName: '',
        }),
      },
    }
  ); */

  const canDelete = useAuthorize(
    application
      ? dataStoreIds.flatMap((odsInstanceId) =>
          application.educationOrganizationIds.map((educationOrganizationIds) => ({
            privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:delete',
            subject: {
              edfiTenantId: Number(edfiTenantId),
              teamId: Number(asId),
              id: edorgKeyV2({
                edorg: educationOrganizationIds,
                ods: odsInstanceId,
              }),
            },
          }))
        )
      : undefined
  );

  return application === undefined
    ? {}
    : {
        ...(canView
          ? {
              View: {
                icon: Icons.View,
                text: 'View',
                title: 'View ' + application.applicationName,
                to: `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${application.id}`,
                onClick: () =>
                  navigate(
                    `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${application.id}`
                  ),
              },
            }
          : undefined),
        ...(version === 'v2'
          ? {
              Manage: {
                isDisabled: false,
                icon: Icons.Application,
                text: 'Manage creds',
                title: 'Manage credentials for ' + application.applicationName,
                to: `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${application.id}/apiClients`,
                onClick: () =>
                  navigate(
                    `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${application.id}/apiClients`
                  ),
              },
            }
          : undefined),
        ...(canEdit
          ? {
              Edit: {
                isDisabled: inEdit,
                icon: Icons.Edit,
                text: 'Edit',
                title: 'Edit ' + application.applicationName,
                to: `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${application.id}?edit=true`,
                onClick: () =>
                  navigate(
                    `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${application.id}?edit=true`
                  ),
              },
            }
          : undefined),
        ...(canDelete
          ? {
              Delete: {
                isPending: deleteApplication.isPending,
                icon: Icons.Delete,
                text: 'Delete',
                title: 'Delete application',
                confirmBody:
                  'All systems using this application to access Ed-Fi will no longer be able to do so. This action cannot be undone, though you will be able to create a new application if you want.',
                onClick: () =>
                  deleteApplication.mutate(
                    { id: application.id },
                    {
                      ...mutationErrCallback({ popGlobalBanner: popBanner }),
                      onSuccess: () => {
                        queryClient.invalidateQueries({
                          queryKey: [QUERY_KEYS.edfiTenants, edfiTenantId, QUERY_KEYS.applications],
                        });
                        if (application.integrationProviderId) {
                          queryClient.invalidateQueries({
                            queryKey: [
                              QUERY_KEYS.integrationProviders,
                              application.integrationProviderId,
                              QUERY_KEYS.integrationApps,
                            ],
                          });
                        }
                        if (onApplicationPage) {
                          navigate(parentPath);
                        }
                      },
                    }
                  ),

                confirm: true,
              },
            }
          : undefined),
      };
};
export const useMultiApplicationActions = ({
  teamId,
}: {
  edfiTenantId: string | number;
  teamId: string | number;
}): ActionsType => {
  const navigate = useNavigate();
  const { sbEnvironmentId, edfiTenantId } = useTeamEdfiTenantNavContext();
  const to = `/as/${teamId}/sb-environments/${sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/create`;
  const canCreate = useAuthorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:create',
    subject: {
      edfiTenantId: Number(edfiTenantId),
      teamId: Number(teamId),
      id: '__filtered__',
    },
  });
  return canCreate
    ? {
        Create: {
          icon: Icons.Plus,
          text: 'New',
          title: 'New application',
          to,
          onClick: () => navigate(to),
        },
      }
    : {};
};