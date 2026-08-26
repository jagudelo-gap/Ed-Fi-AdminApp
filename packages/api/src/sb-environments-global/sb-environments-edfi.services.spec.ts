import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getEntityManagerToken } from '@nestjs/typeorm';
import { SbEnvironmentsEdFiService } from './sb-environments-edfi.services';
import { AdminApiVersionStrategyFactory } from '../admin-api-version-strategy';
import { EdfiTenant, SbEnvironment, SbSyncQueue } from '@edanalytics/models-server';
import { PostSbEnvironmentDto, PutSbEnvironmentDto } from '@edanalytics/models';
import { StartingBlocksServiceV1, StartingBlocksServiceV2 } from '../teams/edfi-tenants/starting-blocks';
import * as utils from '../utils';

jest.mock('../utils', () => ({
  ...jest.requireActual('../utils'),
  validateAdminApiUrl: jest.fn(),
  fetchOdsApiMetadata: jest.fn(),
}));

describe('SbEnvironmentsEdFiService.create (v3)', () => {
  let service: SbEnvironmentsEdFiService;
  let sbEnvironmentsRepository: { save: jest.Mock; create: jest.Mock };
  let strategyFactory: { getStrategy: jest.Mock };
  let v3Strategy: {
    version: string;
    buildConfigPublic: jest.Mock;
    getRegistrationHeaders: jest.Mock;
    dispatchSync: jest.Mock;
  };

  beforeEach(async () => {
    v3Strategy = {
      version: 'v3',
      buildConfigPublic: jest.fn().mockReturnValue({
        version: 'v3',
        values: { meta: { mode: 'SingleTenant' }, adminApiUuid: 'uuid-1' },
        adminApiUrl: 'https://api.test.com',
      }),
      getRegistrationHeaders: jest.fn().mockReturnValue({ 'Content-Type': 'application/x-www-form-urlencoded' }),
      dispatchSync: jest.fn().mockResolvedValue({ kind: 'queued', syncQueue: { id: 'job-1', state: 'completed' } }),
    };
    strategyFactory = { getStrategy: jest.fn().mockReturnValue(v3Strategy) };

    sbEnvironmentsRepository = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => ({ id: 99, ...v })),
    };

    (utils.validateAdminApiUrl as jest.Mock).mockResolvedValue({ specificationVersion: 'v3' });
    (utils.fetchOdsApiMetadata as jest.Mock).mockResolvedValue({
      version: '5.3',
      urls: { dataManagementApi: 'https://ods.test.com/data/v3' },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SbEnvironmentsEdFiService,
        { provide: getRepositoryToken(SbEnvironment), useValue: sbEnvironmentsRepository },
        { provide: StartingBlocksServiceV1, useValue: {} },
        { provide: StartingBlocksServiceV2, useValue: {} },
        { provide: getRepositoryToken(EdfiTenant), useValue: { find: jest.fn(), save: jest.fn() } },
        { provide: getEntityManagerToken(), useValue: { transaction: jest.fn() } },
        { provide: 'IJobQueueService', useValue: { send: jest.fn() } },
        { provide: getRepositoryToken(SbSyncQueue), useValue: { findOneBy: jest.fn() } },
        { provide: AdminApiVersionStrategyFactory, useValue: strategyFactory },
      ],
    }).compile();

    service = module.get(SbEnvironmentsEdFiService);
  });

  it('creates a v3 environment, builds a v3-shaped configPublic via the strategy, and returns a syncQueue', async () => {
    const result = await service.create(
      {
        name: 'my-v3-env',
        environmentLabel: 'my-v3-env',
        adminApiUrl: 'https://api.test.com',
        odsApiDiscoveryUrl: 'https://ods.test.com',
        startingBlocks: false,
      } as unknown as PostSbEnvironmentDto,
      undefined
    );

    expect(strategyFactory.getStrategy).toHaveBeenCalledWith('v3');
    expect(v3Strategy.buildConfigPublic).toHaveBeenCalled();
    expect(v3Strategy.dispatchSync).toHaveBeenCalled();
    expect((result as { syncQueue?: unknown } | undefined)?.syncQueue).toBeDefined();
  });
});

describe('SbEnvironmentsEdFiService.updateEnvironment (v3)', () => {
  let service: SbEnvironmentsEdFiService;
  let sbEnvironmentsRepository: { findOne: jest.Mock; save: jest.Mock };
  let strategyFactory: { getStrategy: jest.Mock };
  let v3Strategy: {
    version: string;
    supportsMultiTenant: boolean;
    getTenantModeDefault: jest.Mock;
    applyOdsUrlUpdate: jest.Mock;
    shouldTriggerResync: jest.Mock;
    dispatchSync: jest.Mock;
  };

  const existingV3Environment = {
    id: 5,
    adminApiUrl: 'https://api.test.com',
    configPublic: {
      version: 'v3',
      adminApiUrl: 'https://api.test.com',
      values: { meta: { mode: 'MultiTenant', domainName: 'old.test.com' }, tenants: { default: {} } },
    },
  };

  beforeEach(async () => {
    v3Strategy = {
      version: 'v3',
      supportsMultiTenant: true,
      getTenantModeDefault: jest.fn().mockReturnValue(true),
      applyOdsUrlUpdate: jest.fn().mockReturnValue({ meta: { mode: 'MultiTenant', domainName: 'new.test.com' } }),
      shouldTriggerResync: jest.fn().mockReturnValue(true),
      dispatchSync: jest.fn().mockResolvedValue({ kind: 'queued', syncQueue: { id: 'job-2', state: 'completed' } }),
    };
    strategyFactory = { getStrategy: jest.fn().mockReturnValue(v3Strategy) };

    sbEnvironmentsRepository = {
      findOne: jest.fn().mockResolvedValue(existingV3Environment),
      save: jest.fn(async (v) => v),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SbEnvironmentsEdFiService,
        { provide: getRepositoryToken(SbEnvironment), useValue: sbEnvironmentsRepository },
        { provide: StartingBlocksServiceV1, useValue: { saveAdminApiCredentials: jest.fn() } },
        { provide: StartingBlocksServiceV2, useValue: {} },
        { provide: getRepositoryToken(EdfiTenant), useValue: { find: jest.fn(), save: jest.fn() } },
        { provide: getEntityManagerToken(), useValue: { transaction: jest.fn() } },
        { provide: 'IJobQueueService', useValue: { send: jest.fn() } },
        { provide: getRepositoryToken(SbSyncQueue), useValue: { findOneBy: jest.fn() } },
        { provide: AdminApiVersionStrategyFactory, useValue: strategyFactory },
      ],
    }).compile();

    service = module.get(SbEnvironmentsEdFiService);
  });

  it('accepts isMultitenant:true for an existing v3 multi-tenant environment (tenant-mode lock)', async () => {
    (utils.validateAdminApiUrl as jest.Mock).mockResolvedValue({ specificationVersion: 'v3' });

    await expect(
      service.updateEnvironment(5, { isMultitenant: true } as unknown as PutSbEnvironmentDto, undefined)
    ).resolves.toBeDefined();

    expect(v3Strategy.getTenantModeDefault).toHaveBeenCalledWith(existingV3Environment);
  });

  it('rejects isMultitenant:false for an existing v3 multi-tenant environment', async () => {
    // ValidationHttpException's own `.message` is always the generic HttpException
    // class-name string ("Validation Http Exception") — the real message lives in
    // getResponse().data.errors[field].message — so we assert on the response body
    // rather than `.rejects.toThrow(regex)`, which only inspects `.message`.
    const error = await service
      .updateEnvironment(5, { isMultitenant: false } as unknown as PutSbEnvironmentDto, undefined)
      .catch((e) => e);
    const response = error.getResponse();
    expect(response.data.errors.isMultitenant.message).toMatch(/Tenant mode cannot be changed/);
  });

  it('triggers a re-sync via strategy.dispatchSync when the ODS URL changes', async () => {
    await service.updateEnvironment(5, { odsApiDiscoveryUrl: 'https://new.test.com' } as unknown as PutSbEnvironmentDto, undefined);

    expect(v3Strategy.shouldTriggerResync).toHaveBeenCalledWith(true);
    expect(v3Strategy.dispatchSync).toHaveBeenCalled();
  });
});

describe('SbEnvironmentsEdFiService.updateEnvironment (v1 message wording)', () => {
  let service: SbEnvironmentsEdFiService;
  let sbEnvironmentsRepository: { findOne: jest.Mock; save: jest.Mock };
  let strategyFactory: { getStrategy: jest.Mock };
  let v1Strategy: {
    version: string;
    supportsMultiTenant: boolean;
    getTenantModeDefault: jest.Mock;
  };

  const existingV1Environment = {
    id: 6,
    adminApiUrl: 'https://api-v1.test.com',
    configPublic: {
      version: 'v1',
      adminApiUrl: 'https://api-v1.test.com',
      values: {},
    },
  };

  beforeEach(async () => {
    v1Strategy = {
      version: 'v1',
      supportsMultiTenant: false,
      getTenantModeDefault: jest.fn().mockReturnValue(false),
    };
    strategyFactory = { getStrategy: jest.fn().mockReturnValue(v1Strategy) };

    sbEnvironmentsRepository = {
      findOne: jest.fn().mockResolvedValue(existingV1Environment),
      save: jest.fn(async (v) => v),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SbEnvironmentsEdFiService,
        { provide: getRepositoryToken(SbEnvironment), useValue: sbEnvironmentsRepository },
        { provide: StartingBlocksServiceV1, useValue: { saveAdminApiCredentials: jest.fn() } },
        { provide: StartingBlocksServiceV2, useValue: {} },
        { provide: getRepositoryToken(EdfiTenant), useValue: { find: jest.fn(), save: jest.fn() } },
        { provide: getEntityManagerToken(), useValue: { transaction: jest.fn() } },
        { provide: 'IJobQueueService', useValue: { send: jest.fn() } },
        { provide: getRepositoryToken(SbSyncQueue), useValue: { findOneBy: jest.fn() } },
        { provide: AdminApiVersionStrategyFactory, useValue: strategyFactory },
      ],
    }).compile();

    service = module.get(SbEnvironmentsEdFiService);
  });

  it('rejects isMultitenant:true for a v1 environment with the v1-specific message text', async () => {
    const error = await service
      .updateEnvironment(6, { isMultitenant: true } as unknown as PutSbEnvironmentDto, undefined)
      .catch((e) => e);
    const response = error.getResponse();
    expect(response.data.errors.isMultitenant.message).toContain(
      '(v1 environments are always single-tenant)'
    );
  });
});

describe('SbEnvironmentsEdFiService.updateEnvironment (unrecognized version)', () => {
  let service: SbEnvironmentsEdFiService;
  let sbEnvironmentsRepository: { findOne: jest.Mock; save: jest.Mock };
  let strategyFactory: { getStrategy: jest.Mock };

  const existingLegacyEnvironment = {
    id: 7,
    adminApiUrl: 'https://legacy.test.com',
    configPublic: {
      version: 'v0',
      adminApiUrl: 'https://legacy.test.com',
      values: {},
    },
  };

  beforeEach(async () => {
    strategyFactory = {
      getStrategy: jest.fn().mockImplementation((version: string | undefined) => {
        throw new Error(`Invalid API version: ${version}`);
      }),
    };

    sbEnvironmentsRepository = {
      findOne: jest.fn().mockResolvedValue(existingLegacyEnvironment),
      save: jest.fn(async (v) => v),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SbEnvironmentsEdFiService,
        { provide: getRepositoryToken(SbEnvironment), useValue: sbEnvironmentsRepository },
        { provide: StartingBlocksServiceV1, useValue: { saveAdminApiCredentials: jest.fn() } },
        { provide: StartingBlocksServiceV2, useValue: {} },
        { provide: getRepositoryToken(EdfiTenant), useValue: { find: jest.fn(), save: jest.fn() } },
        { provide: getEntityManagerToken(), useValue: { transaction: jest.fn() } },
        { provide: 'IJobQueueService', useValue: { send: jest.fn() } },
        { provide: getRepositoryToken(SbSyncQueue), useValue: { findOneBy: jest.fn() } },
        { provide: AdminApiVersionStrategyFactory, useValue: strategyFactory },
      ],
    }).compile();

    service = module.get(SbEnvironmentsEdFiService);
  });

  it('does not throw when updating an environment with an unrecognized/legacy configPublic.version', async () => {
    const result = await service.updateEnvironment(7, { name: 'renamed-legacy-env' } as unknown as PutSbEnvironmentDto, undefined);

    expect(result).toBeDefined();
    // The factory should never be called for a version outside v1/v2/v3 — updateEnvironment
    // must degrade to an undefined strategy locally instead of delegating to the factory's throw.
    expect(strategyFactory.getStrategy).not.toHaveBeenCalled();
  });
});

