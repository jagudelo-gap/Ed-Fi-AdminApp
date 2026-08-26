import {
  CappedLinesText,
  PageActions,
  PageTemplate,
  SbaaTableAllInOne,
} from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { NameCell } from './NameCell';
import { useManyVendorActions } from './useVendorActions';
import { useVendorConfig } from './vendorConfig';

export const VendorsPageContent = () => {
  const { edfiTenant, asId } = useTeamEdfiTenantNavContextLoaded();
  const { queries } = useVendorConfig();

  const vendors = useQuery(
    queries.getAll({
      teamId: asId,
      edfiTenant,
    })
  );
  return (
    <SbaaTableAllInOne
      data={Object.values(vendors?.data || {})}
      columns={[
        {
          accessorKey: 'id',
          header: 'ID',
        },
        {
          accessorKey: 'company',
          cell: NameCell,
          header: 'Company',
        },
        {
          accessorKey: 'namespacePrefixes',
          header: 'Namespace',
          cell: ({ getValue }) => (
            <CappedLinesText maxLines={2}>{getValue() as string}</CappedLinesText>
          ),
        },
        {
          accessorKey: 'contactName',
          header: 'Contact',
        },
      ]}
    />
  );
};

export const VendorsPageV2 = () => {
  const actions = useManyVendorActions();
  return (
    <PageTemplate title="Vendors" actions={<PageActions actions={actions} />}>
      <VendorsPageContent />
    </PageTemplate>
  );
};
