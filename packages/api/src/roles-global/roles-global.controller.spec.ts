import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Role } from '@edanalytics/models-server';
import { GetSessionDataDto, PostRoleDto, PutRoleDto, RoleType } from '@edanalytics/models';
import { CheckAbilityType } from '../auth/authorization';
import { RolesGlobalController } from './roles-global.controller';
import { RolesGlobalService } from './roles-global.service';
import { ValidationHttpException } from '../utils/customExceptions';

const mockRole = { id: 1, name: 'Admin', type: RoleType.UserGlobal, privilegeIds: ['me:read', 'role:read'] };

const mockService = {
  create: jest.fn(async () => mockRole),
  findOne: jest.fn(async () => mockRole),
  update: jest.fn(async () => mockRole),
  remove: jest.fn(async () => undefined),
};

const mockRolesRepo = {
  find: jest.fn(async () => [mockRole]),
  findOneByOrFail: jest.fn(async ({ id }) => {
    if (id === 1) return { ...mockRole };
    throw new Error('Not found');
  }),
};

const mockSessionUser = { id: 99 } as unknown as GetSessionDataDto;

describe('RolesGlobalController', () => {
  let controller: RolesGlobalController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesGlobalController],
      providers: [
        { provide: RolesGlobalService, useValue: mockService },
        { provide: getRepositoryToken(Role), useValue: mockRolesRepo },
      ],
    }).compile();
    controller = module.get(RolesGlobalController);
  });

  describe('create()', () => {
    it('throws ValidationHttpException when UserGlobal role is missing me:read', async () => {
      const dto = { type: RoleType.UserGlobal, privilegeIds: ['role:read'], name: 'Custom' } as unknown as PostRoleDto;
      await expect(controller.create(dto, mockSessionUser)).rejects.toThrow(ValidationHttpException);
    });

    it('creates successfully when UserGlobal role includes me:read', async () => {
      const dto = { type: RoleType.UserGlobal, privilegeIds: ['me:read', 'role:read'], name: 'Custom' } as unknown as PostRoleDto;
      const result = await controller.create(dto, mockSessionUser);
      expect(mockService.create).toHaveBeenCalled();
      expect(result).toBeTruthy();
    });

    it('creates successfully for non-UserGlobal roles without me:read', async () => {
      const dto = { type: RoleType.UserTeam, privilegeIds: ['role:read'], name: 'TeamRole' } as unknown as PostRoleDto;
      const result = await controller.create(dto, mockSessionUser);
      expect(mockService.create).toHaveBeenCalled();
      expect(result).toBeTruthy();
    });
  });

  describe('findAll()', () => {
    it('returns all roles from the repository', async () => {
      const result = await controller.findAll();
      expect(mockRolesRepo.find).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('findOne()', () => {
    it('returns a single role by id', async () => {
      const result = await controller.findOne(1);
      expect(mockService.findOne).toHaveBeenCalledWith(1);
      expect(result).toBeTruthy();
    });
  });

  describe('update()', () => {
    it('throws ValidationHttpException when updating a UserGlobal role without me:read', async () => {
      mockRolesRepo.findOneByOrFail.mockResolvedValueOnce({ ...mockRole, type: RoleType.UserGlobal });
      const dto = { privilegeIds: ['role:read'], name: 'Updated' } as unknown as PutRoleDto;
      await expect(controller.update(1, dto, mockSessionUser)).rejects.toThrow(ValidationHttpException);
    });

    it('updates successfully when UserGlobal role retains me:read', async () => {
      mockRolesRepo.findOneByOrFail.mockResolvedValueOnce({ ...mockRole, type: RoleType.UserGlobal });
      const dto = { privilegeIds: ['me:read', 'role:read'], name: 'Updated' } as unknown as PutRoleDto;
      const result = await controller.update(1, dto, mockSessionUser);
      expect(mockService.update).toHaveBeenCalled();
      expect(result).toBeTruthy();
    });

    it('updates successfully for non-UserGlobal roles without me:read', async () => {
      mockRolesRepo.findOneByOrFail.mockResolvedValueOnce({ ...mockRole, type: RoleType.UserTeam });
      const dto = { privilegeIds: ['role:read'], name: 'Updated' } as unknown as PutRoleDto;
      const result = await controller.update(1, dto, mockSessionUser);
      expect(mockService.update).toHaveBeenCalled();
      expect(result).toBeTruthy();
    });
  });

  describe('remove()', () => {
    it('removes a role passing force and checkAbility', async () => {
      const checkAbility = jest.fn(() => true) as unknown as CheckAbilityType;
      const result = await controller.remove(1, false, mockSessionUser, checkAbility);
      expect(mockService.remove).toHaveBeenCalledWith(1, mockSessionUser, false, checkAbility);
      expect(result).toBeUndefined();
    });
  });
});
