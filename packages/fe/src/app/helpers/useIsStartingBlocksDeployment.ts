import { useQuery } from '@tanstack/react-query';
import { sbEnvironmentQueries } from '../api';
import { useAuthorize } from './Authorize';

/**
 * This deployment is assumed to have a single relevant SbEnvironment, so its
 * `startingBlocks` flag stands in for whether the whole deployment is a
 * Starting Blocks deployment (as opposed to a generic Ed-Fi Data Store one).
 *
 * Defaults to `false` while environments are loading, if none exist yet, or
 * if the caller lacks `sb-environment:read` (e.g. a sb-sync-queue:read-only
 * role) — the SbEnvironment query is skipped entirely in that case so it
 * never 403s.
 */
export const useIsStartingBlocksDeployment = () => {
  const isAuthorizedForSbEnvironment = useAuthorize({
    privilege: 'sb-environment:read',
    subject: { id: '__filtered__' },
  });
  const sbEnvironments = useQuery({
    ...sbEnvironmentQueries.getAll({}),
    enabled: isAuthorizedForSbEnvironment,
  });
  const [firstEnvironment] = Object.values(sbEnvironments.data ?? {});
  return firstEnvironment?.startingBlocks ?? false;
};
