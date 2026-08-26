import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getEntityManagerToken, getRepositoryToken } from '@nestjs/typeorm';
import { Ownership, Role, User, UserTeamMembership } from '@edanalytics/models-server';
import { GetUserDto, PostRoleDto, PutRoleDto } from '@edanalytics/models';
import { CheckAbilityType } from '../auth/authorization';
import { RolesGlobalService } from './roles-global.service';

const mockRole = { id: 1, name: 'Admin', privilegeIds: ['me:read', 'role:read'], displayName: 'Admin' };

const mockRoleRepo = {
  save: jest.fn(async (entity) => ({ ...mockRole, ...entity, id: entity.id ?? 1 })),
  findOneByOrFail: jest.fn(async ({ id }) => {
    if (id === 1) return { ...mockRole };
    throw new Error('Not found');
  }),
  remove: jest.fn(async () => undefined),
};
const mockUtmRepo = { findBy: jest.fn(async () => []) };
const mockUserRepo = { findBy: jest.fn(async () => []) };
const mockOwnershipRepo = { findBy: jest.fn(async () => []) };

describe('RolesGlobalService', () => {
  let service: RolesGlobalService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGlobalService,
        { provide: getRepositoryToken(Role), useValue: mockRoleRepo },
        { provide: getRepositoryToken(UserTeamMembership), useValue: mockUtmRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Ownership), useValue: mockOwnershipRepo },
        { provide: getEntityManagerToken(), useValue: {} },
      ],
    }).compile();
    service = module.get(RolesGlobalService);
  });

  it('create() saves a new role with unique privilege ids', async () => {
    const dto = { name: 'Editor', privilegeIds: ['me:read', 'role:read', 'me:read'], type: 'UserGlobal', teamId: null } as unknown as PostRoleDto;
    await service.create(dto);
    expect(mockRoleRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ privilegeIds: ['me:read', 'role:read'] })
    );
  });

  it('create() throws BadRequestException for invalid privileges', async () => {
    const dto = { name: 'Bad', privilegeIds: ['nonexistent:priv'], type: 'UserGlobal', teamId: null } as unknown as PostRoleDto;
    await expect(service.create(dto)).rejects.toThrow(BadRequestException);
  });

  it('findOne() returns a role by id', async () => {
    const result = await service.findOne(1);
    expect(result).toMatchObject({ id: 1, name: 'Admin' });
  });

  it('update() saves with updated fields', async () => {
    const dto = { name: 'Super Admin', privilegeIds: ['me:read'] } as unknown as PutRoleDto;
    await service.update(1, dto);
    expect(mockRoleRepo.save).toHaveBeenCalled();
  });

  it('remove() without force throws when role has memberships', async () => {
    mockUtmRepo.findBy.mockResolvedValueOnce([{ id: 10 }]);
    await expect(service.remove(1, { id: 99 } as unknown as GetUserDto, false)).rejects.toThrow();
  });

  it('remove() without force deletes successfully when no related records exist', async () => {
    const result = await service.remove(1, { id: 99 } as unknown as GetUserDto, false);
    expect(mockRoleRepo.remove).toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('remove() with force proceeds when checkAbility allows', async () => {
    mockUserRepo.findBy.mockResolvedValueOnce([{ id: 5 }]);
    const checkAbility = jest.fn(() => true);
    const result = await service.remove(1, { id: 99 } as unknown as GetUserDto, true, checkAbility as unknown as CheckAbilityType);
    expect(mockRoleRepo.remove).toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('remove() with force throws when checkAbility denies user update', async () => {
    mockUserRepo.findBy.mockResolvedValueOnce([{ id: 5 }]);
    const checkAbility = jest.fn(() => false);
    await expect(service.remove(1, { id: 99 } as unknown as GetUserDto, true, checkAbility as unknown as CheckAbilityType)).rejects.toThrow();
  });
});

