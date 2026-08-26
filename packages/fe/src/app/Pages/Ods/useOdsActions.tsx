import { ActionsType, Icons } from '@edanalytics/common-ui';
import { GetOdsDto } from '@edanalytics/models';
import { useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { instancesV2, odsQueries } from '../../api';
import {
  teamEdfiTenantAuthConfig,
  useAuthorize,
  useTeamEdfiTenantNavContextLoaded,
} from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useOdsTerminology } from './useOdsTerminology';

const withPendingDeleteStatus = <T extends { status: string | null }>(value: T): T =>
  Object.assign(Object.create(Object.getPrototypeOf(value)), value, { status: 'PendingDelete' });

export const useOdsActions = (ods: Pick<GetOdsDto, 'id' | 'instanceManageId' | 'status'>): ActionsType => {
  const navigate = useNavigate();
  const { edfiTenantId, edfiTenant, sbEnvironmentId, sbEnvironment, teamId } = useTeamEdfiTenantNavContextLoaded();
  const popBanner = usePopBanner();
  const { odsId } = useParams();
  const queryClient = useQueryClient();
  const terminology = useOdsTerminology();

  const canDelete = useAuthorize(
    teamEdfiTenantAuthConfig(
      ods.id,
      edfiTenantId,
      teamId,
      'team.sb-environment.edfi-tenant:delete-ods'
    )
  );
  const deleteOds = odsQueries.delete({ edfiTenant, teamId });
  const deleteInstance = instancesV2.delete({ edfiTenant, teamId });
  const isStartingBlocks = sbEnvironment.startingBlocks;
  const canDeleteInstance =
    typeof ods.instanceManageId === 'number' && ods.instanceManageId > 0 && ods.status === 'Created';
  const deleteMutation = isStartingBlocks ? deleteOds : canDeleteInstance ? deleteInstance : undefined;
  const deleteId = isStartingBlocks ? ods.id : ods.instanceManageId;

  const applyPendingDeleteOptimistic = () => {
    queryClient.setQueryData<Record<number, GetOdsDto>>(
      odsQueries.getAll({ edfiTenant, teamId }).queryKey,
      (prev) => {
        if (!prev) return prev;
        const current = prev[ods.id];
        if (!current) return prev;
        return { ...prev, [ods.id]: withPendingDeleteStatus(current) };
      }
    );
    queryClient.setQueryData<GetOdsDto>(
      odsQueries.getOne({ id: ods.id, edfiTenant, teamId }).queryKey,
      (prev) => (prev ? withPendingDeleteStatus(prev) : prev)
    );
  };

  return {
    ...(canDelete && deleteMutation && typeof deleteId === 'number'
      ? {
          Delete: {
            icon: Icons.Delete,
            isPending: deleteMutation.isPending,
            text: 'Delete',
            title: `Delete ${terminology.singular}`,
            confirmBody: `This will permanently delete the ${terminology.singular}.`,
            onClick: () => {
              if (!isStartingBlocks) applyPendingDeleteOptimistic();
              return deleteMutation.mutateAsync(
                { id: deleteId },
                {
                  ...mutationErrCallback({ popGlobalBanner: popBanner }),
                  onSuccess: () =>
                    odsId &&
                    navigate(
                      `/as/${teamId}/sb-environments/${sbEnvironmentId}/edfi-tenants/${edfiTenantId}/odss`
                    ),
                }
              );
            },
            confirm: true,
          },
        }
      : {}),
  };
};