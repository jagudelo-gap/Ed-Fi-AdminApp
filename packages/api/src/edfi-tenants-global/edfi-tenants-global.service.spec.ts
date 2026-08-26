import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EdfiTenant } from '@edanalytics/models-server';
import { PostEdfiTenantDto } from '@edanalytics/models';
import { EdfiTenantsGlobalService } from './edfi-tenants-global.service';
import { AdminApiServiceV1 } from '../teams/edfi-tenants/starting-blocks/v1/admin-api.v1.service';
import { AdminApiServiceV2 } from '../teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service';

const mockEdfiTenant = { id: 1, name: 'Tenant1' };

const mockRepo = {
  create: jest.fn((dto) => ({ ...dto })),
  save: jest.fn(async (entity) => ({ ...mockEdfiTenant, ...entity, id: entity.id ?? 1 })),
};

describe('EdfiTenantsGlobalService', () => {
  let service: EdfiTenantsGlobalService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EdfiTenantsGlobalService,
        { provide: getRepositoryToken(EdfiTenant), useValue: mockRepo },
        { provide: AdminApiServiceV1, useValue: {} },
        { provide: AdminApiServiceV2, useValue: {} },
      ],
    }).compile();
    service = module.get(EdfiTenantsGlobalService);
  });

  it('create() saves a new EdFi tenant', async () => {
    const dto: PostEdfiTenantDto = { name: 'NewTenant' };
    await service.create(dto);
    expect(mockRepo.create).toHaveBeenCalledWith(dto);
    expect(mockRepo.save).toHaveBeenCalled();
  });
});
