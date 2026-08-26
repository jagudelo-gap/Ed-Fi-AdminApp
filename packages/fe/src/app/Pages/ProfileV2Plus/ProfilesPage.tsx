import { PageActions, PageTemplate, SbaaTableAllInOne } from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { NameCell } from './NameCell';
import { useManyProfileActions } from './useProfileActions';
import { useProfileConfig } from './profileConfig';

export const ProfilesPageContent = () => {
  const { edfiTenant, asId } = useTeamEdfiTenantNavContextLoaded();
  const { queries } = useProfileConfig();

  const profiles = useQuery(
    queries.getAll({
      teamId: asId,
      edfiTenant,
    })
  );
  return (
    <SbaaTableAllInOne
      data={Object.values(profiles?.data || {})}
      columns={[
        {
          accessorKey: 'name',
          cell: NameCell,
          header: 'Name',
        },
      ]}
    />
  );
};

export const ProfilesPage = () => {
  const actions = useManyProfileActions();
  return (
    <PageTemplate title="Profiles" actions={<PageActions actions={actions} />}>
      <ProfilesPageContent />
    </PageTemplate>
  );
};
