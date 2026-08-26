import { useQuery } from '@tanstack/react-query';
import { PageActions, PageTemplate } from '@edanalytics/common-ui';
import { ErrorBoundary } from 'react-error-boundary';
import { useParams } from 'react-router';
import { vendorQueriesV1 } from '../../api';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { EditVendor } from './EditVendor';
import { ViewVendor } from './ViewVendor';
import { useVendorActions } from './useVendorActions';
import omit from 'lodash/omit';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';

export const VendorPageContent = () => {
  const params = useParams() as {
    vendorId: string;
  };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const vendor = useQuery(
    vendorQueriesV1.getOne({
      teamId,
      id: params.vendorId,
      edfiTenant,
    })
  ).data;
  const { edit } = useSearchParamsObject() as { edit?: boolean };

  return vendor ? edit ? <EditVendor vendor={vendor} /> : <ViewVendor /> : null;
};

const VendorPageTitle = () => {
  const params = useParams() as {
    vendorId: string;
  };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const vendor = useQuery(
    vendorQueriesV1.getOne({
      teamId,
      id: params.vendorId,
      edfiTenant,
    })
  ).data;
  return <>{vendor?.company || 'Vendor'}</>;
};

export const VendorPage = () => {
  return (
    <PageTemplate
      title={
        <ErrorBoundary fallbackRender={() => 'Vendor'}>
          <VendorPageTitle />
        </ErrorBoundary>
      }
      actions={<VendorPageActions />}
    >
      <VendorPageContent />
    </PageTemplate>
  );
};

export const VendorPageActions = () => {
  const params = useParams() as {
    vendorId: string;
  };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const vendor = useQuery(
    vendorQueriesV1.getOne({
      teamId,
      id: params.vendorId,
      edfiTenant,
    })
  ).data;

  const actions = useVendorActions(vendor);
  return <PageActions actions={omit(actions, 'View')} />;
};
