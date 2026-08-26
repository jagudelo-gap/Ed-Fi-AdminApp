import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { V2AdminApiVersionStrategy } from './v2-admin-api-version.strategy';
import { AdminApiServiceV2 } from '../teams/edfi-tenants/starting-blocks';
import { SbEnvironment, SbSyncQueue } from '@edanalytics/models-server';
import {
  ISbEnvironmentConfigPrivateV2,
  ISbEnvironmentConfigPublicV2,
  PostSbEnvironmentDto,
  SbEnvironmentConfigPublic,
  TenantDto,
} from '@edanalytics/models';
import axios, { AxiosInstance, AxiosResponse } from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('V2AdminApiVersionStrategy', () => {
  let strategy: V2AdminApiVersionStrategy;
  let jobQueue: { send: jest.Mock };
  let queueRepository: { findOneBy: jest.Mock };
  let sbEnvironmentsRepository: { findOne: jest.Mock; save: jest.Mock };
  let adminApiServiceV2: AdminApiServiceV2;

  beforeEach(async () => {
    jobQueue = { send: jest.fn().mockResolvedValue('job-1') };
    queueRepository = { findOneBy: jest.fn() };
    sbEnvironmentsRepository = { findOne: jest.fn(), save: jest.fn() };
    adminApiServiceV2 = {} as AdminApiServiceV2;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        V2AdminApiVersionStrategy,
        { provide: AdminApiServiceV2, useValue: adminApiServiceV2 },
        { provide: 'IJobQueueService', useValue: jobQueue },
        { provide: getRepositoryToken(SbSyncQueue), useValue: queueRepository },
        { provide: getRepositoryToken(SbEnvironment), useValue: sbEnvironmentsRepository },
      ],
    }).compile();

    strategy = module.get(V2AdminApiVersionStrategy);
  });

  it('reports version "v2" and multi-tenant support', () => {
    expect(strategy.version).toBe('v2');
    expect(strategy.supportsMultiTenant).toBe(true);
  });

  it('getAdminApiService returns the injected AdminApiServiceV2', () => {
    expect(strategy.getAdminApiService()).toBe(adminApiServiceV2);
  });

  it('buildConfigPublic returns the v2-shaped configPublic with SbV2MetaEnv meta', () => {
    const result = strategy.buildConfigPublic({
      createSbEnvironmentDto: {
        startingBlocks: false,
        adminApiUrl: 'https://api.test.com',
        odsApiDiscoveryUrl: 'https://ods.test.com',
        environmentLabel: 'my-env',
      } as PostSbEnvironmentDto,
      odsApiMetaResponse: { version: '5.3' },
      tenantMode: 'MultiTenant',
    }) as unknown as { version: string; values: ISbEnvironmentConfigPublicV2 & { adminApiUuid: string } };

    expect(result.version).toBe('v2');
    expect(result.values.meta).toEqual({
      envlabel: 'my-env',
      mode: 'MultiTenant',
      domainName: 'https://ods.test.com',
      adminApiUrl: 'https://api.test.com',
      tenantManagementFunctionArn: '',
      tenantResourceTreeFunctionArn: '',
      odsManagementFunctionArn: '',
      edorgManagementFunctionArn: '',
      dataFreshnessFunctionArn: '',
    });
    expect(typeof result.values.adminApiUuid).toBe('string');
  });

  it('applyOdsUrlUpdate patches meta.domainName', () => {
    const patch = strategy.applyOdsUrlUpdate(
      {
        version: 'v2',
        values: { meta: { domainName: 'old.test.com', mode: 'SingleTenant' } },
      } as SbEnvironmentConfigPublic,
      'https://new.test.com/'
    );
    expect(patch).toEqual({
      meta: { domainName: 'new.test.com', mode: 'SingleTenant' },
    });
  });

  it('getTenantModeDefault reads meta.mode === MultiTenant off the existing environment', () => {
    const env = {
      configPublic: { version: 'v2', values: { meta: { mode: 'MultiTenant' } } },
    } as unknown as SbEnvironment;
    expect(strategy.getTenantModeDefault(env)).toBe(true);

    const singleTenantEnv = {
      configPublic: { version: 'v2', values: { meta: { mode: 'SingleTenant' } } },
    } as unknown as SbEnvironment;
    expect(strategy.getTenantModeDefault(singleTenantEnv)).toBe(false);
  });

  it('shouldTriggerResync mirrors hasUrlUpdates', () => {
    expect(strategy.shouldTriggerResync(true)).toBe(true);
    expect(strategy.shouldTriggerResync(false)).toBe(false);
  });

  it('getRegistrationHeaders adds a tenant header only when multitenant', () => {
    expect(strategy.getRegistrationHeaders(true, 'tenant-a')).toEqual({
      'Content-Type': 'application/x-www-form-urlencoded',
      tenant: 'tenant-a',
    });
    expect(strategy.getRegistrationHeaders(false, 'tenant-a')).toEqual({
      'Content-Type': 'application/x-www-form-urlencoded',
    });
  });

  describe('dispatchSync', () => {
    it('enqueues a job and returns the polled queue item once it leaves a pending state', async () => {
      queueRepository.findOneBy.mockResolvedValue({ id: 'job-1', state: 'completed' } as SbSyncQueue);

      const result = await strategy.dispatchSync({ id: 42 } as SbEnvironment);

      expect(jobQueue.send).toHaveBeenCalledWith(
        'sbe-sync',
        { sbEnvironmentId: 42 },
        { expireInHours: 2 }
      );
      expect(result).toEqual({ kind: 'queued', syncQueue: { id: 'job-1', state: 'completed' } });
    });
  });

  describe('bootstrapCredentials', () => {
    it('no-ops when the environment already has tenant credentials', async () => {
      const env = {
        configPublic: { version: 'v2', values: { tenants: { default: { adminApiKey: 'x' } } } },
      } as unknown as SbEnvironment;

      await strategy.bootstrapCredentials(env);

      expect(sbEnvironmentsRepository.save).not.toHaveBeenCalled();
    });

    it('discovers tenants from the root endpoint and registers/saves credentials for each in multi-tenant mode', async () => {
      jest.clearAllMocks();
      sbEnvironmentsRepository.save = jest.fn();
      const getMock = jest.fn().mockResolvedValue({
        data: { tenancy: { multitenantMode: true, tenants: ['tenant-a', 'tenant-b'] } },
      });
      mockedAxios.create.mockReturnValue({ get: getMock } as unknown as AxiosInstance);
      mockedAxios.post.mockResolvedValue({ status: 200 } as unknown as AxiosResponse);

      const env = {
        name: 'my-env',
        adminApiUrl: 'https://api.test.com',
        configPublic: { version: 'v2', values: { meta: { mode: 'MultiTenant' }, tenants: {} } },
      } as unknown as SbEnvironment;

      await strategy.bootstrapCredentials(env);

      expect(mockedAxios.create).toHaveBeenCalledWith({ baseURL: 'https://api.test.com' });
      expect(getMock).toHaveBeenCalledWith('/');
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);

      const values = (env.configPublic as unknown as { values: ISbEnvironmentConfigPublicV2 }).values;
      expect(values.tenants['tenant-a'].adminApiKey).toEqual(expect.any(String));
      expect(values.tenants['tenant-b'].adminApiKey).toEqual(expect.any(String));

      const privateConfig = env.configPrivate as unknown as ISbEnvironmentConfigPrivateV2;
      expect(privateConfig.tenants['tenant-a'].adminApiSecret).toEqual(expect.any(String));
      expect(privateConfig.tenants['tenant-b'].adminApiSecret).toEqual(expect.any(String));

      expect(sbEnvironmentsRepository.save).toHaveBeenCalledTimes(1);
      expect(sbEnvironmentsRepository.save).toHaveBeenCalledWith(env);
    });

    it('falls back to the default tenant when the root endpoint response does not have the expected shape', async () => {
      jest.clearAllMocks();
      sbEnvironmentsRepository.save = jest.fn();
      const getMock = jest.fn().mockResolvedValue({ data: {} });
      mockedAxios.create.mockReturnValue({ get: getMock } as unknown as AxiosInstance);
      mockedAxios.post.mockResolvedValue({ status: 200 } as unknown as AxiosResponse);

      const env = {
        name: 'my-env',
        adminApiUrl: 'https://api.test.com',
        configPublic: { version: 'v2', values: { meta: { mode: 'MultiTenant' }, tenants: {} } },
      } as unknown as SbEnvironment;

      await strategy.bootstrapCredentials(env);

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      const values = (env.configPublic as unknown as { values: ISbEnvironmentConfigPublicV2 }).values;
      expect(values.tenants['default'].adminApiKey).toEqual(expect.any(String));
      expect(sbEnvironmentsRepository.save).toHaveBeenCalledTimes(1);
    });

    it('logs and returns early without saving when the root Admin API call throws', async () => {
      jest.clearAllMocks();
      sbEnvironmentsRepository.save = jest.fn();
      const getMock = jest.fn().mockRejectedValue(new Error('network unreachable'));
      mockedAxios.create.mockReturnValue({ get: getMock } as unknown as AxiosInstance);

      const env = {
        name: 'my-env',
        adminApiUrl: 'https://api.test.com',
        configPublic: { version: 'v2', values: { meta: { mode: 'MultiTenant' }, tenants: {} } },
      } as unknown as SbEnvironment;

      await strategy.bootstrapCredentials(env);

      expect(mockedAxios.post).not.toHaveBeenCalled();
      expect(sbEnvironmentsRepository.save).not.toHaveBeenCalled();
    });

    it('continues provisioning remaining tenants and still saves when one tenant registration fails', async () => {
      jest.clearAllMocks();
      sbEnvironmentsRepository.save = jest.fn();
      const getMock = jest.fn().mockResolvedValue({
        data: { tenancy: { multitenantMode: true, tenants: ['tenant-a', 'tenant-b'] } },
      });
      mockedAxios.create.mockReturnValue({ get: getMock } as unknown as AxiosInstance);
      mockedAxios.post
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({ status: 200 } as unknown as AxiosResponse);

      const env = {
        name: 'my-env',
        adminApiUrl: 'https://api.test.com',
        configPublic: { version: 'v2', values: { meta: { mode: 'MultiTenant' }, tenants: {} } },
      } as unknown as SbEnvironment;

      await strategy.bootstrapCredentials(env);

      const values = (env.configPublic as unknown as { values: ISbEnvironmentConfigPublicV2 }).values;
      expect(values.tenants['tenant-a']).toBeUndefined();
      expect(values.tenants['tenant-b'].adminApiKey).toEqual(expect.any(String));

      expect(sbEnvironmentsRepository.save).toHaveBeenCalledTimes(1);
      expect(sbEnvironmentsRepository.save).toHaveBeenCalledWith(env);
    });
  });

  describe('provisionCredentialsForNewTenants', () => {
    it('no-ops when there are no newly discovered tenants', async () => {
      const env = {
        configPublic: { version: 'v2', values: { tenants: { 'tenant-a': { adminApiKey: 'x' } } } },
      } as unknown as SbEnvironment;
      const discovered: TenantDto[] = [{ id: 'tenant-a', name: 'tenant-a', odsInstances: [] }];

      await strategy.provisionCredentialsForNewTenants(env, discovered);

      expect(sbEnvironmentsRepository.save).not.toHaveBeenCalled();
    });

    it('registers and saves credentials for newly discovered tenants', async () => {
      jest.clearAllMocks();
      sbEnvironmentsRepository.save = jest.fn();
      mockedAxios.post.mockResolvedValue({ status: 200 } as unknown as AxiosResponse);

      const env = {
        name: 'my-env',
        adminApiUrl: 'https://api.test.com',
        configPublic: { version: 'v2', values: { meta: { mode: 'MultiTenant' }, tenants: { 'tenant-a': { adminApiKey: 'existing' } } } },
      } as unknown as SbEnvironment;
      const discovered: TenantDto[] = [
        { id: 'tenant-a', name: 'tenant-a', odsInstances: [] },
        { id: 'tenant-b', name: 'tenant-b', odsInstances: [] },
      ];

      await strategy.provisionCredentialsForNewTenants(env, discovered);

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      const values = (env.configPublic as unknown as { values: ISbEnvironmentConfigPublicV2 }).values;
      expect(values.tenants['tenant-a']).toEqual({ adminApiKey: 'existing' });
      expect(values.tenants['tenant-b'].adminApiKey).toEqual(expect.any(String));

      const privateConfig = env.configPrivate as unknown as ISbEnvironmentConfigPrivateV2;
      expect(privateConfig.tenants['tenant-b'].adminApiSecret).toEqual(expect.any(String));

      expect(sbEnvironmentsRepository.save).toHaveBeenCalledTimes(1);
      expect(sbEnvironmentsRepository.save).toHaveBeenCalledWith(env);
    });

    it('continues provisioning remaining new tenants and still saves when one registration fails', async () => {
      jest.clearAllMocks();
      sbEnvironmentsRepository.save = jest.fn();
      mockedAxios.post
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({ status: 200 } as unknown as AxiosResponse);

      const env = {
        name: 'my-env',
        adminApiUrl: 'https://api.test.com',
        configPublic: { version: 'v2', values: { meta: { mode: 'MultiTenant' }, tenants: {} } },
      } as unknown as SbEnvironment;
      const discovered: TenantDto[] = [
        { id: 'tenant-a', name: 'tenant-a', odsInstances: [] },
        { id: 'tenant-b', name: 'tenant-b', odsInstances: [] },
      ];

      await strategy.provisionCredentialsForNewTenants(env, discovered);

      const values = (env.configPublic as unknown as { values: ISbEnvironmentConfigPublicV2 }).values;
      expect(values.tenants['tenant-a']).toBeUndefined();
      expect(values.tenants['tenant-b'].adminApiKey).toEqual(expect.any(String));

      expect(sbEnvironmentsRepository.save).toHaveBeenCalledTimes(1);
      expect(sbEnvironmentsRepository.save).toHaveBeenCalledWith(env);
    });
  });
});
