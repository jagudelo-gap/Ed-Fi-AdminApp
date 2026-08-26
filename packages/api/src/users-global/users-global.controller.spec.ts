import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '@edanalytics/models-server';
import { GetSessionDataDto, PostUserDto, PutUserDto } from '@edanalytics/models';
import { UsersGlobalController } from './users-global.controller';
import { UsersGlobalService } from './users-global.service';
import { ValidationHttpException } from '../utils';

const mockUser = { id: 1, username: 'alice', userType: 'human' };

const mockService = {
  create: jest.fn(async () => mockUser),
  findOne: jest.fn(async () => mockUser),
  update: jest.fn(async () => mockUser),
  remove: jest.fn(async () => undefined),
};

const mockUsersRepo = {
  find: jest.fn(async () => [mockUser]),
};

const mockSessionUser = { id: 99, username: 'admin' } as unknown as GetSessionDataDto;

describe('UsersGlobalController', () => {
  let controller: UsersGlobalController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersGlobalController],
      providers: [
        { provide: UsersGlobalService, useValue: mockService },
        { provide: getRepositoryToken(User), useValue: mockUsersRepo },
      ],
    }).compile();
    controller = module.get(UsersGlobalController);
  });

  describe('create()', () => {
    it('throws ValidationHttpException when machine user has no clientId', async () => {
      const dto = { userType: 'machine', description: 'bot' } as unknown as PostUserDto;
      await expect(controller.create(dto, mockSessionUser)).rejects.toThrow(ValidationHttpException);
    });

    it('throws ValidationHttpException when human user has a clientId', async () => {
      const dto = { userType: 'human', clientId: 'abc-123' } as unknown as PostUserDto;
      await expect(controller.create(dto, mockSessionUser)).rejects.toThrow(ValidationHttpException);
    });

    it('throws ValidationHttpException when machine user has no description', async () => {
      const dto = { userType: 'machine', clientId: 'abc-123' } as unknown as PostUserDto;
      await expect(controller.create(dto, mockSessionUser)).rejects.toThrow(ValidationHttpException);
    });

    it('throws ValidationHttpException when human user has a description', async () => {
      const dto = { userType: 'human', description: 'should not be here' } as unknown as PostUserDto;
      await expect(controller.create(dto, mockSessionUser)).rejects.toThrow(ValidationHttpException);
    });

    it('creates a valid machine user successfully', async () => {
      const dto = { userType: 'machine', clientId: 'abc-123', description: 'A bot' } as unknown as PostUserDto;
      const result = await controller.create(dto, mockSessionUser);
      expect(mockService.create).toHaveBeenCalled();
      expect(result).toBeTruthy();
    });

    it('creates a valid human user successfully', async () => {
      const dto = { userType: 'human', username: 'alice' } as unknown as PostUserDto;
      const result = await controller.create(dto, mockSessionUser);
      expect(mockService.create).toHaveBeenCalled();
      expect(result).toBeTruthy();
    });

    it('throws ValidationHttpException with "Username already exists" on 23505 username duplicate', async () => {
      const dbError = Object.assign(new Error('unique'), { code: '23505', detail: 'username already exists' });
      mockService.create.mockRejectedValueOnce(dbError);
      const dto = { userType: 'human', username: 'alice' } as unknown as PostUserDto;
      await expect(controller.create(dto, mockSessionUser)).rejects.toThrow(ValidationHttpException);
    });

    it('throws ValidationHttpException with "Client ID already exists" on 23505 clientId duplicate', async () => {
      const dbError = Object.assign(new Error('unique'), { code: '23505', detail: 'clientId already exists' });
      mockService.create.mockRejectedValueOnce(dbError);
      const dto = { userType: 'machine', clientId: 'abc', description: 'A bot' } as unknown as PostUserDto;
      await expect(controller.create(dto, mockSessionUser)).rejects.toThrow(ValidationHttpException);
    });

    it('re-throws non-23505 errors from the service', async () => {
      const unknownError = new Error('unexpected failure');
      mockService.create.mockRejectedValueOnce(unknownError);
      const dto = { userType: 'human', username: 'alice' } as unknown as PostUserDto;
      await expect(controller.create(dto, mockSessionUser)).rejects.toThrow('unexpected failure');
    });
  });

  describe('findAll()', () => {
    it('returns all users from the repository', async () => {
      const result = await controller.findAll();
      expect(mockUsersRepo.find).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('findOne()', () => {
    it('returns a single user by id', async () => {
      const result = await controller.findOne(1);
      expect(mockService.findOne).toHaveBeenCalledWith(1);
      expect(result).toBeTruthy();
    });
  });

  describe('update()', () => {
    it('throws ValidationHttpException with "Username already exists" on 23505', async () => {
      const dbError = Object.assign(new Error('unique'), { code: '23505', detail: 'username' });
      mockService.update.mockRejectedValueOnce(dbError);
      const dto = { username: 'alice' } as unknown as PutUserDto;
      await expect(controller.update(1, dto, mockSessionUser)).rejects.toThrow(ValidationHttpException);
    });

    it('re-throws non-23505 errors during update', async () => {
      mockService.update.mockRejectedValueOnce(new Error('server error'));
      const dto = { username: 'alice' } as unknown as PutUserDto;
      await expect(controller.update(1, dto, mockSessionUser)).rejects.toThrow('server error');
    });
  });

  describe('remove()', () => {
    it('removes a user', async () => {
      const result = await controller.remove(1, mockSessionUser);
      expect(mockService.remove).toHaveBeenCalledWith(1, mockSessionUser);
      expect(result).toBeUndefined();
    });
  });
});
