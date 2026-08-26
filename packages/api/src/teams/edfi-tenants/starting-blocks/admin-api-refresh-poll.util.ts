import { Logger } from '@nestjs/common';
import { AxiosInstance, isAxiosError } from 'axios';
import config from 'config';

/**
 * Run the Admin API job to refresh the EdOrgs for the given environment. This is a long-running operation, so it returns a job ID that can be polled for completion.
 * @param client - The Admin API client for the environment (from getAdminApiClientForEnvironment())
 * @param refreshPath - The version-specific refresh endpoint (e.g. 'odsInstances/edOrgs/refresh' for v2, 'dataStores/edOrgs/refresh' for v3)
 * @param logger - The calling service's logger, so log output is attributed to the right service
 * @param environmentName - The environment's display name, for logging
 * @returns Promise<string | null> - The job ID if successfully triggered, otherwise null
 */
export async function triggerEdOrgRefresh(
  client: AxiosInstance,
  refreshPath: string,
  logger: Logger,
  environmentName: string
): Promise<string | null> {
  try {
    const response = await client.post(refreshPath);
    const jobId = (response as { jobId?: string })?.jobId ?? null;
    if (!jobId) {
      logger.warn(`EdOrg refresh response missing jobId for environment ${environmentName}`);
      return null;
    }
    logger.log(`EdOrg refresh triggered for ${environmentName}, jobId: ${jobId}`);
    return jobId;
  } catch (error) {
    logger.warn(
      `Failed to trigger EdOrg refresh for environment ${environmentName}: ${(error as Error).message}`
    );
    return null;
  }
}

/**
 * Polls GET jobs/{jobId} until the job reaches a terminal state or the attempt limit is reached.
 * Poll parameters are driven by ADMINAPI_REFRESH_POLL_ATTEMPTS and ADMINAPI_REFRESH_POLL_INTERVAL_MS config.
 * @param client - The Admin API client for the environment (from getAdminApiClientForEnvironment())
 * @param jobId - The job ID returned by triggerEdOrgRefresh()
 * @param logger - The calling service's logger, so log output is attributed to the right service
 * @param environmentName - The environment's display name, for logging
 * @returns 'completed' | 'failed' | 'timeout'
 */
export async function pollJobStatus(
  client: AxiosInstance,
  jobId: string,
  logger: Logger,
  environmentName: string
): Promise<'completed' | 'failed' | 'timeout'> {
  const rawMaxAttempts = Number(config.ADMINAPI_REFRESH_POLL_ATTEMPTS);
  const rawIntervalMs = Number(config.ADMINAPI_REFRESH_POLL_INTERVAL_MS);
  const maxAttempts: number = Number.isFinite(rawMaxAttempts) && rawMaxAttempts >= 1 ? rawMaxAttempts : 10;
  const intervalMs: number = Number.isFinite(rawIntervalMs) && rawIntervalMs >= 0 ? rawIntervalMs : 5000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await client.get(`jobs/${jobId}`);
      const status = (response as unknown as { status?: string })?.status;
      if (status === 'completed') return 'completed';
      if (status === 'failed') return 'failed';
    } catch (error) {
      // A 404 right after triggering the refresh can simply mean the job's status
      // row hasn't been persisted yet (observed in practice: the job starts executing
      // milliseconds after the first poll 404s) — keep retrying through the attempt
      // budget instead of treating a single 404 as proof the endpoint is unsupported.
      if (isAxiosError(error) && error.response?.status === 404) {
        logger.debug(
          `Job ${jobId} not found (404) on attempt ${attempt}/${maxAttempts} for environment ${environmentName} — retrying`
        );
      } else {
        logger.error(
          `Poll attempt ${attempt}/${maxAttempts} failed for job ${jobId}: ${(error as Error).message}`
        );
        return 'timeout';
      }
    }

    if (attempt < maxAttempts) {
      await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  logger.warn(`Job ${jobId} did not complete after ${maxAttempts} poll attempts for environment ${environmentName}`);
  return 'timeout';
}
