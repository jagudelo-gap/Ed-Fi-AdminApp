import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getEntityManagerToken, getRepositoryToken } from '@nestjs/typeorm';
import { UserTeamMembership } from '@edanalytics/models-server';
import {
  GetUserDto,
  PostUserTeamMembershipDto,
  PutUserTeamMembershipDto,
} from '@edanalytics/models';
import { UserTeamMembershipsGlobalService } from './user-team-memberships-global.service';

const mockMembership = { id: 1, userId: 10, teamId: 2, roleId: 3 };

const mockRepo = {
  create: jest.fn((dto) => ({ ...dto })),
  save: jest.fn(async (entity) => ({ ...mockMembership, ...entity, id: entity.id ?? 1 })),
  findOneByOrFail: jest.fn(async ({ id }: { id: number }) => {
    if (id === 1) return { ...mockMembership };
    throw new Error('Not found');
  }),
  remove: jest.fn(async () => undefined),
};

describe('UserTeamMembershipsGlobalService', () => {
  let service: UserTeamMembershipsGlobalService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserTeamMembershipsGlobalService,
        { provide: getRepositoryToken(UserTeamMembership), useValue: mockRepo },
        { provide: getEntityManagerToken(), useValue: {} },
      ],
    }).compile();
    service = module.get(UserTeamMembershipsGlobalService);
  });

  it('create() saves a new membership', async () => {
    const dto: PostUserTeamMembershipDto = { userId: 5, teamId: 1, roleId: 2 };
    await service.create(dto);
    expect(mockRepo.create).toHaveBeenCalledWith(dto);
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('findOne() returns a membership by id', async () => {
    const result = await service.findOne(1);
    expect(result).toMatchObject({ id: 1, userId: 10 });
    expect(mockRepo.findOneByOrFail).toHaveBeenCalledWith({ id: 1 });
  });

  it('findOne() throws when not found', async () => {
    await expect(service.findOne(999)).rejects.toThrow();
  });

  it('update() applies allowed fields and saves', async () => {
    const dto: PutUserTeamMembershipDto = { id: 1, roleId: 5 };
    await service.update(1, dto);
    expect(mockRepo.save).toHaveBeenCalled();
    const savedArg = mockRepo.save.mock.calls[0][0];
    expect(savedArg.roleId).toBe(5);
  });

  it('remove() removes and returns undefined', async () => {
    const result = await service.remove(1, { id: 99 } as unknown as GetUserDto);
    expect(mockRepo.remove).toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('remove() throws NotFoundException when not found', async () => {
    const { NotFoundException } = await import('@nestjs/common');
    await expect(service.remove(999, { id: 1 } as unknown as GetUserDto)).rejects.toThrow(NotFoundException);
  });
});
