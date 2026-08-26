import { useQuery } from '@tanstack/react-query';
import { PageActions, PageTemplate } from '@edanalytics/common-ui';
import { ErrorBoundary } from 'react-error-boundary';
import { useParams } from 'react-router';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { EditVendor } from './EditVendor';
import { ViewVendor } from './ViewVendor';
import { useVendorActions } from './useVendorActions';
import { useVendorConfig } from './vendorConfig';
import omit from 'lodash/omit';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';

export const VendorPageContent = () => {
  const params = useParams() as {
    vendorId: string;
  };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const { queries } = useVendorConfig();
  const vendor = useQuery(
    queries.getOne({
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
  const { queries } = useVendorConfig();
  const vendor = useQuery(
    queries.getOne({
      teamId,
      id: params.vendorId,
      edfiTenant,
    })
  ).data;
  return <>{vendor?.company || 'Vendor'}</>;
};

export const VendorPageV2 = () => {
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
  const { queries } = useVendorConfig();
  const vendor = useQuery(
    queries.getOne({
      teamId,
      id: params.vendorId,
      edfiTenant,
    })
  ).data;

  const actions = useVendorActions(vendor);
  return <PageActions actions={omit(actions, 'View')} />;
};
