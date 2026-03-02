import { ActionsType, Icons } from '@edanalytics/common-ui';

import { useLocation, useNavigate } from 'react-router-dom';
import {
  useTeamEdfiTenantNavContext,
  useTeamEdfiTenantNavContextLoaded,
} from '../../helpers';
import { GetApiClientDtoV2 } from '@edanalytics/models';
import { useSearchParamsObject } from '../../helpers/useSearch';

export const useSingleApiClientActions = ({
  apiClient,
  applicationId,
}: {
  apiClient: GetApiClientDtoV2 | undefined;
  applicationId: number;
}): ActionsType => {
  const { edfiTenantId, asId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const navigate = useNavigate();
  const location = useLocation();
  const search = useSearchParamsObject();
  const onApiClientPage =
    apiClient && location.pathname.endsWith(`/apiclients/${apiClient.id}`);
  const inEdit = onApiClientPage && 'edit' in search && search?.edit === 'true';

  const canView = true;
  const canReset = true;
  const canEdit = true;
  const canDelete = true;
  const toView = `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${applicationId}/apiclients/${apiClient?.id}`;
  const toEdit = `${toView}?edit=true`;

  return apiClient === undefined
    ? {}
    : {
        ...(canView
          ? {
              View: {
                icon: Icons.View,
                text: 'View',
                title: 'View ' + apiClient.name,
                to: toView,
                onClick: () => navigate(toView),
              },
            }
          : undefined),
        ...(canReset
          ? {
              Reset: {
                isDisabled: false,
                icon: Icons.Application,
                text: 'Reset',
                title: 'Reset ' + apiClient.name,
                onClick: () => {},
              },
            }
          : undefined),
        ...(canEdit
          ? {
              Edit: {
                isDisabled: !!inEdit,
                icon: Icons.Edit,
                text: 'Edit',
                title: 'Edit ' + apiClient.name,
                to: toEdit,
                onClick: () => navigate(toEdit),
              },
            }
          : undefined),
        ...(canDelete
          ? {
              Delete: {
                isPending: false, //deleteApplication.isPending,
                icon: Icons.Delete,
                text: 'Delete',
                title: 'Delete Application credentials',
                confirmBody:
                  'All systems using this application to access Ed-Fi will no longer be able to do so. This action cannot be undone, though you will be able to create a new application if you want.',
                onClick: () => {},
              },
            }
          : undefined),
      };
};

export const useMultiApiClientsActions = ({
  teamId,
  applicationId,
}: {
  teamId: string | number;
  applicationId: number;
}): ActionsType => {
  const navigate = useNavigate();
  const { sbEnvironmentId, edfiTenantId } = useTeamEdfiTenantNavContext();
  const to = `/as/${teamId}/sb-environments/${sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${applicationId}/apiclients/create`;
  const canCreate = true;
  return canCreate
    ? {
        Create: {
          icon: Icons.Plus,
          text: 'New',
          title: 'New credentials',
          to,
          onClick: () => navigate(to),
        },
      }
    : {};
};