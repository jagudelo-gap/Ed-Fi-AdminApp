import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { V3AdminApiVersionStrategy } from './v3-admin-api-version.strategy';
import { AdminApiServiceV3 } from '../teams/edfi-tenants/starting-blocks';
import { SbEnvironment, SbSyncQueue } from '@edanalytics/models-server';
import { ISbEnvironmentConfigPublicV3, PostSbEnvironmentDto } from '@edanalytics/models';

describe('V3AdminApiVersionStrategy', () => {
  let strategy: V3AdminApiVersionStrategy;
  let adminApiServiceV3: AdminApiServiceV3;

  beforeEach(async () => {
    adminApiServiceV3 = {} as AdminApiServiceV3;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        V3AdminApiVersionStrategy,
        { provide: AdminApiServiceV3, useValue: adminApiServiceV3 },
        { provide: 'IJobQueueService', useValue: { send: jest.fn() } },
        { provide: getRepositoryToken(SbSyncQueue), useValue: { findOneBy: jest.fn() } },
        { provide: getRepositoryToken(SbEnvironment), useValue: { findOne: jest.fn(), save: jest.fn() } },
      ],
    }).compile();

    strategy = module.get(V3AdminApiVersionStrategy);
  });

  it('reports version "v3" and multi-tenant support (inherited from V2)', () => {
    expect(strategy.version).toBe('v3');
    expect(strategy.supportsMultiTenant).toBe(true);
  });

  it('getAdminApiService returns the injected AdminApiServiceV3 (not V2)', () => {
    expect(strategy.getAdminApiService()).toBe(adminApiServiceV3);
  });

  it('buildConfigPublic returns a v3-tagged configPublic with the same meta shape as v2', () => {
    const result = strategy.buildConfigPublic({
      createSbEnvironmentDto: {
        startingBlocks: false,
        adminApiUrl: 'https://api.test.com',
        odsApiDiscoveryUrl: 'https://ods.test.com',
        environmentLabel: 'my-v3-env',
      } as PostSbEnvironmentDto,
      odsApiMetaResponse: { version: '5.3' },
      tenantMode: 'MultiTenant',
    }) as unknown as { version: string; values: ISbEnvironmentConfigPublicV3 };

    expect(result.version).toBe('v3');
    expect(result.values.meta).toEqual({
      envlabel: 'my-v3-env',
      mode: 'MultiTenant',
      domainName: 'https://ods.test.com',
      adminApiUrl: 'https://api.test.com',
      tenantManagementFunctionArn: '',
      tenantResourceTreeFunctionArn: '',
      odsManagementFunctionArn: '',
      edorgManagementFunctionArn: '',
      dataFreshnessFunctionArn: '',
    });
  });

  it('inherits getRegistrationHeaders behavior from V2 (tenant header rule)', () => {
    expect(strategy.getRegistrationHeaders(true, 'tenant-a')).toEqual({
      'Content-Type': 'application/x-www-form-urlencoded',
      tenant: 'tenant-a',
    });
  });

  it('inherits getTenantModeDefault behavior from V2', () => {
    const env = {
      configPublic: { version: 'v3', values: { meta: { mode: 'MultiTenant' } } },
    } as unknown as SbEnvironment;
    expect(strategy.getTenantModeDefault(env)).toBe(true);
  });
});
