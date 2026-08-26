import { Icons, PageActions, PageTemplate, SbaaTableAllInOne, TableRowActions } from '@edanalytics/common-ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { instancesV2, odsQueries } from '../../api';
import {
  teamEdfiTenantAuthConfig,
  useAuthorize,
  useTeamEdfiTenantNavContextLoaded,
} from '../../helpers';
import { CellContext } from '@tanstack/react-table';
import { useOdssActions } from './useOdssActions';
import { Badge, HStack, Link } from '@chakra-ui/react';
import { Link as RouterLink, useNavigate } from 'react-router';
import { GetOdsDto } from '@edanalytics/models';
import { odsStatusDisplayMap } from './Utils';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useOdsTerminology } from './useOdsTerminology';

const withPendingDeleteStatus = <T extends { status: string | null }>(value: T): T =>
  Object.assign(Object.create(Object.getPrototypeOf(value)), value, { status: 'PendingDelete' });

const useOdsRowActions = (ods: GetOdsDto) => {
  const { teamId, edfiTenant, sbEnvironment } = useTeamEdfiTenantNavContextLoaded();
  const navigate = useNavigate();
  const popBanner = usePopBanner();
  const queryClient = useQueryClient();
  const terminology = useOdsTerminology();
  const canDelete = useAuthorize(
    teamEdfiTenantAuthConfig(ods.id, edfiTenant.id, teamId, 'team.sb-environment.edfi-tenant:delete-ods')
  );
  const to = `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/odss/${ods.id}/`;
  const deleteOds = odsQueries.delete({ edfiTenant, teamId });
  const deleteInstance = instancesV2.delete({ edfiTenant, teamId });
  const isStartingBlocks = sbEnvironment.startingBlocks;
  const canDeleteInstance =
    typeof ods.instanceManageId === 'number' && ods.instanceManageId > 0 && ods.status === 'Created';
  const deleteAction = isStartingBlocks
    ? {
        icon: Icons.Delete,
        text: 'Delete',
        title: `Delete ${terminology.singular}`,
        confirmBody: `This will permanently delete the ${terminology.singular}.`,
        confirm: true,
        onClick: () =>
          deleteOds.mutateAsync({ id: ods.id }, mutationErrCallback({ popGlobalBanner: popBanner })),
      }
    : canDelete && canDeleteInstance
      ? {
          icon: Icons.Delete,
          text: 'Delete',
          title: `Delete ${terminology.singular}`,
          confirmBody: `This will permanently delete the ${terminology.singular}.`,
          confirm: true,
          onClick: () => {
            queryClient.setQueryData<Record<number, GetOdsDto>>(
              odsQueries.getAll({ edfiTenant, teamId }).queryKey,
              (prev) => {
                if (!prev) return prev;
                const current = prev[ods.id];
                if (!current) return prev;
                return { ...prev, [ods.id]: withPendingDeleteStatus(current) };
              }
            );
            return deleteInstance.mutateAsync(
              { id: ods.instanceManageId! },
              mutationErrCallback({ popGlobalBanner: popBanner })
            );
          },
        }
      : undefined;

  return {
    View: {
      icon: Icons.View,
      text: 'View',
      title: 'View ' + ods.displayName,
      to,
      onClick: () => navigate(to),
    },
    ...(deleteAction
      ? {
          Delete: deleteAction,
        }
      : {}),
  };
};

const NameCell = (info: CellContext<GetOdsDto, unknown>) => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const terminology = useOdsTerminology();
  const { id, displayName } = info.row.original;
  const to = `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/odss/${id}/`;
  const actions = useOdsRowActions(info.row.original);
  return (
    <HStack justify="space-between">
      <Link as="span">
        <RouterLink title={`Go to ${terminology.singular}`} to={to}>
          {displayName}
        </RouterLink>
      </Link>
      <TableRowActions actions={actions} />
    </HStack>
  );
};

export const OdssPage = () => {
  const actions = useOdssActions();
  const terminology = useOdsTerminology();
  return (
    <PageTemplate actions={<PageActions actions={actions} />} title={terminology.listTitle}>
      <OdssTable />
    </PageTemplate>
  );
};

export const OdssTable = () => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const odss = useQuery({
    ...odsQueries.getAll({
      edfiTenant,
      teamId,
    }),
    staleTime: 0,
    gcTime: 0,
  });
  const sortedOdss = Object.values(odss?.data || {}).sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
  );

  return (
    <SbaaTableAllInOne
      data={sortedOdss}
      columns={[
        { accessorKey: 'displayName', cell: NameCell, header: 'Name' },
        { accessorKey: 'instanceType', header: 'Type' },
        { accessorKey: 'status', header: 'Status', cell: (info) => {
            const { label, colorScheme } = (odsStatusDisplayMap[info.row.original.status ?? 'null'] ?? odsStatusDisplayMap['null']);
            return <Badge colorScheme={colorScheme}>{label}</Badge>;
          },
        },
      ]}
    />
  );
};