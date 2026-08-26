import { ContentSection, PageActions, PageContentCard, PageTemplate } from '@edanalytics/common-ui';
import { useMultipleUserGlobalActions } from './useMultipleUserGlobalActions';
import { MachineUsersTable } from './MachineUsersTable';
import { HumanUsersTable } from './HumanUsersTable';

export const UsersGlobalPage = () => {
  const actions = useMultipleUserGlobalActions();

  return (
    <PageTemplate title="Users" actions={<PageActions actions={actions} />} customPageContentCard>
      <PageContentCard>
        <ContentSection heading="Human Users">
          <HumanUsersTable />
        </ContentSection>
      </PageContentCard>
      <PageContentCard>
        <ContentSection heading="Machine Users">
          <MachineUsersTable />
        </ContentSection>
      </PageContentCard>
    </PageTemplate>
  );
};
