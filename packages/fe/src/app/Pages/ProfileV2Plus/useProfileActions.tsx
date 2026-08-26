import { ActionsType, Icons } from '@edanalytics/common-ui';
import { useNavigate } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import {
  useAuthorize,
  useTeamEdfiTenantNavContextLoaded,
  profileAuthConfig,
  useNavToParent,
} from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { ProfileEntity, useProfileConfig } from './profileConfig';

//the definition of a Profile is present in the single-item GET response but not the all-item version so there are two versions - get & GetMany

//includes definition
export const useProfileActions = (profile: ProfileEntity | undefined): ActionsType => {
  const { edfiTenant, edfiTenantId, asId } = useTeamEdfiTenantNavContextLoaded();
  const { queries } = useProfileConfig();

  const navigate = useNavigate();

  const to = (id: number | string) =>
    `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/profiles/${id}`;
  const deleteProfile = queries.delete({ edfiTenant, teamId: asId });
  const popBanner = usePopBanner();
  const canView = useAuthorize(
    profileAuthConfig(edfiTenantId, asId, 'team.sb-environment.edfi-tenant.profile:read')
  );
  const parentPath = useNavToParent();
  const onProfilePage = profile && location.pathname.endsWith(`/profiles/${profile.id}`);
  const canEdit = useAuthorize(
    profileAuthConfig(edfiTenantId, asId, 'team.sb-environment.edfi-tenant.profile:update')
  );

  const canDelete = useAuthorize(
    profileAuthConfig(edfiTenantId, asId, 'team.sb-environment.edfi-tenant.profile:delete')
  );
  if (!profile) return {};
  const viewAction = {
    View: {
      icon: Icons.View,
      text: 'View',
      title: 'View ' + profile.name,
      to: to(profile.id),
      onClick: () => navigate(to(profile.id)),
    },
  };
  const editAction = {
    Edit: {
      icon: Icons.Edit,
      text: 'Edit',
      title: 'Edit ' + profile.name,
      to: to(profile.id) + '?edit=true',
      onClick: () => navigate(to(profile.id) + '?edit=true'),
    },
  };
  const deleteAction = {
    Delete: {
      icon: Icons.Delete,
      isPending: deleteProfile.isPending,
      text: 'Delete',
      title: 'Delete profile',
      confirmBody: 'This will permanently delete the profile.',
      onClick: () =>
        deleteProfile.mutateAsync(
          { id: profile.id },
          {
            ...mutationErrCallback({ popGlobalBanner: popBanner }),
            onSuccess: () => {
              if (onProfilePage) {
                navigate(parentPath);
              }
            },
          }
        ),
      confirm: true,
    },
  };
  return {
    ...(canView ? viewAction : {}),
    ...(canEdit ? editAction : {}),
    ...(canDelete ? deleteAction : {}),
  };
};
//does not include definition
export const useManyProfileActions = (): ActionsType => {
  const { asId, edfiTenantId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();

  const navigate = useNavigate();
  const to = `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/profiles/create`;
  const canCreate = useAuthorize(
    profileAuthConfig(edfiTenantId, asId, 'team.sb-environment.edfi-tenant.profile:create')
  );
  return canCreate
    ? {
        Create: {
          icon: Icons.Plus,
          text: 'New',
          title: 'New Profile',
          to,
          onClick: () => navigate(to),
        },
      }
    : {};
};
