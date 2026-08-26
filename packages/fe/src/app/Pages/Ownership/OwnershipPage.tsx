import { PageTemplate } from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { ownershipQueries } from '../../api';
import { useTeamNavContext } from '../../helpers';
import { ViewOwnership } from './ViewOwnership';

export const OwnershipPage = () => {
  const params = useParams() as {
    ownershipId: string;
  };

  const { teamId } = useTeamNavContext();

  const ownership = useQuery(
    ownershipQueries.getOne({
      id: params.ownershipId,
      teamId,
    })
  ).data;

  return (
    <PageTemplate title={ownership?.displayName || 'Ownership'}>
      {ownership ? <ViewOwnership /> : null}
    </PageTemplate>
  );
};
