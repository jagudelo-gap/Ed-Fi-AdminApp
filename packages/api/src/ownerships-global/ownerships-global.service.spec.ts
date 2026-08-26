import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getEntityManagerToken, getRepositoryToken } from '@nestjs/typeorm';
import { Ownership } from '@edanalytics/models-server';
import { AuthService } from '../auth/auth.service';
import { OwnershipsGlobalService } from './ownerships-global.service';
import {
  GetUserDto,
  OWNERSHIP_RESOURCE_TYPE,
  PostOwnershipDto,
  PutOwnershipDto,
} from '@edanalytics/models';

const mockOwnership = { id: 1, teamId: 2, roleId: 3, edorgId: 10 };

const mockRepo = {
  save: jest.fn(async (entity) => ({ ...mockOwnership, ...entity, id: entity.id ?? 1 })),
  findOneByOrFail: jest.fn(async ({ id }) => {
    if (id === 1) return { ...mockOwnership };
    throw new Error('Not found');
  }),
  findBy: jest.fn(async () => []),
  remove: jest.fn(async () => undefined),
};

const mockAuthService = {
  reloadTeamOwnershipCache: jest.fn(),
};

describe('OwnershipsGlobalService', () => {
  let service: OwnershipsGlobalService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OwnershipsGlobalService,
        { provide: getRepositoryToken(Ownership), useValue: mockRepo },
        { provide: getEntityManagerToken(), useValue: {} },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();
    service = module.get(OwnershipsGlobalService);
  });

  it('create() throws when duplicate ownership exists', async () => {
    mockRepo.findBy.mockResolvedValueOnce([mockOwnership]);
    const dto = {
      teamId: 2,
      edorgId: 10,
      type: OWNERSHIP_RESOURCE_TYPE.edorg,
      createdById: 1,
      roleId: 3,
    } as unknown as PostOwnershipDto;
    await expect(service.create(dto)).rejects.toThrow();
  });

  it('create() saves a new ownership and reloads cache', async () => {
    const dto = {
      teamId: 2,
      edorgId: 10,
      type: OWNERSHIP_RESOURCE_TYPE.edorg,
      createdById: 1,
      roleId: 3,
      odsId: undefined,
      edfiTenantId: undefined,
      sbEnvironmentId: undefined,
      integrationProviderId: undefined,
    } as unknown as PostOwnershipDto;
    await service.create(dto);
    expect(mockRepo.save).toHaveBeenCalled();
    expect(mockAuthService.reloadTeamOwnershipCache).toHaveBeenCalledWith(2);
  });

  it('findOne() returns an ownership by id', async () => {
    const result = await service.findOne(1);
    expect(result).toMatchObject({ id: 1, teamId: 2 });
  });

  it('update() saves updated ownership and reloads cache', async () => {
    const dto: PutOwnershipDto = { id: 1, roleId: 5, modifiedById: 1 };
    await service.update(1, dto);
    expect(mockRepo.save).toHaveBeenCalled();
    expect(mockAuthService.reloadTeamOwnershipCache).toHaveBeenCalledWith(2);
  });

  it('remove() removes ownership and reloads cache', async () => {
    const result = await service.remove(1, { id: 99 } as unknown as GetUserDto);
    expect(mockRepo.remove).toHaveBeenCalled();
    expect(mockAuthService.reloadTeamOwnershipCache).toHaveBeenCalledWith(2);
    expect(result).toBeUndefined();
  });

  it('remove() throws NotFoundException when ownership not found', async () => {
    const { NotFoundException } = await import('@nestjs/common');
    await expect(service.remove(999, { id: 1 } as unknown as GetUserDto)).rejects.toThrow(NotFoundException);
  });
});
