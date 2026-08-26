import { Logger } from '@nestjs/common';
import { AxiosInstance } from 'axios';
import config from 'config';
import { pollJobStatus } from './admin-api-refresh-poll.util';

jest.mock('config', () => ({
  ADMINAPI_REFRESH_POLL_ATTEMPTS: 5,
  ADMINAPI_REFRESH_POLL_INTERVAL_MS: 0,
}));

const make404 = (): Error & { isAxiosError: true; response: { status: number } } =>
  Object.assign(new Error('Request failed with status code 404'), {
    isAxiosError: true as const,
    response: { status: 404 },
  });

describe('pollJobStatus', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('test');
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    jest.spyOn(logger, 'debug').mockImplementation(() => undefined);
  });

  it('retries past an initial 404 (job status row not yet persisted) and returns completed once the job is found', async () => {
    const get = jest
      .fn()
      .mockRejectedValueOnce(make404())
      .mockResolvedValueOnce({ status: 'completed' });
    const client = { get } as unknown as AxiosInstance;

    const result = await pollJobStatus(client, 'job-123', logger, 'Test Env');

    expect(result).toBe('completed');
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('logs a per-attempt 404 at debug (not warn), including the environment name', async () => {
    const get = jest
      .fn()
      .mockRejectedValueOnce(make404())
      .mockResolvedValueOnce({ status: 'completed' });
    const client = { get } as unknown as AxiosInstance;

    await pollJobStatus(client, 'job-123', logger, 'Test Env');

    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Test Env'));
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('returns timeout after exhausting all attempts if every poll 404s', async () => {
    const get = jest.fn().mockRejectedValue(make404());
    const client = { get } as unknown as AxiosInstance;

    const result = await pollJobStatus(client, 'job-123', logger, 'Test Env');

    expect(result).toBe('timeout');
    expect(get).toHaveBeenCalledTimes(Number(config.ADMINAPI_REFRESH_POLL_ATTEMPTS));
  });

  it('returns timeout immediately on a non-404 error without retrying', async () => {
    const get = jest.fn().mockRejectedValue(new Error('network error'));
    const client = { get } as unknown as AxiosInstance;

    const result = await pollJobStatus(client, 'job-123', logger, 'Test Env');

    expect(result).toBe('timeout');
    expect(get).toHaveBeenCalledTimes(1);
  });
});
