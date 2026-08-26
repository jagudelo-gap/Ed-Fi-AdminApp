import { StyleProps, Tooltip, chakra, forwardRef } from '@chakra-ui/react';
import { DateValue } from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { sbEnvironmentQueries } from '../../api';
import { useTeamNavContext } from '../../helpers';

/** Display last sync date of EdfiTenant in upper right corner of a container (overlaid using absolute position) */
export const SbEnvironmentSyncDateOverlay = (props: { left?: boolean }) => {
  const { teamId } = useTeamNavContext();
  const params = useParams() as {
    sbEnvironmentId: string;
  };
  const sbEnvironment = useQuery(
    sbEnvironmentQueries.getOne({
      id: params.sbEnvironmentId,
      teamId,
    })
  );
  return sbEnvironment.data?.configPublic?.lastSuccessfulPull ? (
    <chakra.div position="relative" w="100%">
      <SbEnvironmentSyncDateValue
        position="absolute"
        {...(props.left ? { left: 0 } : { right: 0 })}
        w="max-content"
      />
    </chakra.div>
  ) : null;
};

export const SbEnvironmentSyncDateValue = forwardRef<StyleProps, 'span'>((props, ref) => {
  const { teamId } = useTeamNavContext();
  const params = useParams() as {
    sbEnvironmentId: string;
  };
  const sbEnvironment = useQuery(
    sbEnvironmentQueries.getOne({
      id: params.sbEnvironmentId,
      teamId,
    })
  );
  return (
    <Tooltip hasArrow label="Ed-Orgs are not shown live. They're synced from Ed-Fi once per day.">
      <chakra.span ref={ref} fontSize="sm" color="gray.500" {...props}>
        Data as of{' '}
        {sbEnvironment.data?.configPublic?.lastSuccessfulPull ? (
          <DateValue value={sbEnvironment.data.configPublic.lastSuccessfulPull} />
        ) : (
          '-'
        )}
      </chakra.span>
    </Tooltip>
  );
});
