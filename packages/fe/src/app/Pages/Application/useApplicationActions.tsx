import { ActionsType, Icons } from '@edanalytics/common-ui';

import { GetApplicationDto, GetEdfiTenantDto, edorgCompositeKey } from '@edanalytics/models';
import { useLocation, useNavigate } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { applicationQueriesV1 } from '../../api';
import { useAuthorize, useNavToParent } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useSearchParamsObject } from '../../helpers/useSearch';

export const useSingleApplicationActions = ({
  application,
  edfiTenant,
  teamId,
}: {
  application: GetApplicationDto | undefined;
  edfiTenant: GetEdfiTenantDto;
  teamId: string | number;
}): ActionsType => {
  const navigate = useNavigate();
  const location = useLocation();
  const popBanner = usePopBanner();

  const deleteApplication = applicationQueriesV1.delete({
    edfiTenant: edfiTenant,
    teamId: teamId,
  });

  const search = useSearchParamsObject();
  const onApplicationPage =
    application && location.pathname.endsWith(`/applications/${application.id}`);
  const inEdit = onApplicationPage && 'edit' in search && search?.edit === 'true';

  const parentPath = useNavToParent();

  const canEdit = useAuthorize(
    application &&
      application._educationOrganizationIds.map((edorgId) => ({
        privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:update',
        subject: {
          edfiTenantId: edfiTenant.id,
          teamId: Number(teamId),
          id: edorgCompositeKey({
            edorg: edorgId,
            ods: '',
          }),
        },
      }))
  );

  const resetCreds = applicationQueriesV1.resetCredential({
    edfiTenant: edfiTenant,
    teamId: teamId,
  });

  const canReset = useAuthorize(
    application &&
      application._educationOrganizationIds.map((edorgId) => ({
        privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:reset-credentials',
        subject: {
          edfiTenantId: edfiTenant.id,
          teamId: Number(teamId),
          id: edorgCompositeKey({
            edorg: edorgId,
            ods: '',
          }),
        },
      }))
  );

  const canView = useAuthorize(
    application && {
      privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:read',
      subject: {
        edfiTenantId: edfiTenant.id,
        teamId: Number(teamId),
        id: edorgCompositeKey({
          edorg: application.educationOrganizationId,
          ods: '',
        }),
      },
    }
  );

  const canDelete = useAuthorize(
    application &&
      application._educationOrganizationIds.map((_edorgId) => ({
        privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:delete',
        subject: {
          edfiTenantId: edfiTenant.id,
          teamId: Number(teamId),
          id: edorgCompositeKey({
            edorg: application.educationOrganizationId,
            ods: '',
          }),
        },
      }))
  );

  return application === undefined
    ? {}
    : {
        ...(canView
          ? {
              View: {
                icon: Icons.View,
                text: 'View',
                title: 'View ' + application.displayName,
                to: `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/applications/${application.id}`,
                onClick: () =>
                  navigate(
                    `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/applications/${application.id}`
                  ),
              },
            }
          : undefined),
        ...(canReset
          ? {
              Reset: {
                isPending: resetCreds.isPending,
                icon: Icons.ShieldX,
                text: 'Reset creds',
                title: 'Reset application credentials.',
                onClick: () => {
                  resetCreds.mutateAsync(
                    { entity: { id: application.id }, pathParams: {} },
                    {
                      ...mutationErrCallback({ popGlobalBanner: popBanner }),
                      onSuccess: (result) => {
                        navigate(
                          `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/applications/${application?.id}`,
                          {
                            state: result,
                          }
                        );
                      },
                    }
                  );
                },
                confirm: true,
                confirmBody:
                  'Are you sure you want to reset the credentials? Anything using the current ones will stop working.',
              },
            }
          : undefined),
        ...(canEdit
          ? {
              Edit: {
                isDisabled: inEdit,
                icon: Icons.Edit,
                text: 'Edit',
                title: 'Edit ' + application.displayName,
                to: `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/applications/${application.id}?edit=true`,
                onClick: () =>
                  navigate(
                    `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/applications/${application.id}?edit=true`
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
  edfiTenant,
  teamId,
}: {
  edfiTenant: GetEdfiTenantDto;
  teamId: string | number;
}): ActionsType => {
  const navigate = useNavigate();
  const to = `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/applications/create`;
  const canCreate = useAuthorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:create',
    subject: {
      edfiTenantId: edfiTenant.id,
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
