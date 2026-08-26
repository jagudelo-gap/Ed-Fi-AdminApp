import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getEntityManagerToken, getRepositoryToken } from '@nestjs/typeorm';
import { Team } from '@edanalytics/models-server';
import { PostTeamDto, PutTeamDto, GetUserDto } from '@edanalytics/models';
import { TeamsGlobalService } from './teams-global.service';

const mockTeam = { id: 1, name: 'Engineering', displayName: 'Engineering' };

const mockRepo = {
  create: jest.fn((dto) => ({ ...dto })),
  save: jest.fn(async (entity) => ({ ...mockTeam, ...entity, id: entity.id ?? 1 })),
  findOneByOrFail: jest.fn(async ({ id }: { id: number }) => {
    if (id === 1) return { ...mockTeam };
    throw new Error('Not found');
  }),
  remove: jest.fn(async () => undefined),
};

describe('TeamsGlobalService', () => {
  let service: TeamsGlobalService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsGlobalService,
        { provide: getRepositoryToken(Team), useValue: mockRepo },
        { provide: getEntityManagerToken(), useValue: {} },
      ],
    }).compile();
    service = module.get(TeamsGlobalService);
  });

  it('create() saves a new team', async () => {
    const dto = { name: 'Science' } as PostTeamDto;
    await service.create(dto);
    expect(mockRepo.create).toHaveBeenCalledWith(dto);
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('findOne() returns a team by id', async () => {
    const result = await service.findOne(1);
    expect(result).toMatchObject({ id: 1, name: 'Engineering' });
    expect(mockRepo.findOneByOrFail).toHaveBeenCalledWith({ id: 1 });
  });

  it('findOne() throws when not found', async () => {
    await expect(service.findOne(999)).rejects.toThrow();
  });

  it('update() applies allowed fields and saves', async () => {
    const dto = { name: 'Infra' } as PutTeamDto;
    await service.update(1, dto);
    expect(mockRepo.save).toHaveBeenCalled();
    const savedArg = mockRepo.save.mock.calls[0][0];
    expect(savedArg.name).toBe('Infra');
  });

  it('remove() removes the team and returns undefined', async () => {
    const result = await service.remove(1, { id: 99 } as GetUserDto);
    expect(mockRepo.remove).toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('remove() throws NotFoundException when team not found', async () => {
    const { NotFoundException } = await import('@nestjs/common');
    await expect(service.remove(999, { id: 1 } as GetUserDto)).rejects.toThrow(NotFoundException);
  });
});
