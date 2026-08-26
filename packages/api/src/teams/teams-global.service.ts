import { GetUserDto, PostTeamDto, PutTeamDto } from '@edanalytics/models';
import { Team } from '@edanalytics/models-server';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { applyDtoUpdates, throwNotFound } from '../utils';

@Injectable()
export class TeamsGlobalService {
  constructor(
    @InjectRepository(Team)
    private teamsRepository: Repository<Team>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager
  ) {}
  create(createTeamDto: PostTeamDto) {
    return this.teamsRepository.save(this.teamsRepository.create(createTeamDto));
  }

  async findOne(id: number) {
    return this.teamsRepository.findOneByOrFail({ id });
  }

  async update(id: number, updateTeamDto: PutTeamDto) {
    const old = await this.findOne(id);
    const updated = applyDtoUpdates(old, updateTeamDto, ['name', 'modifiedById']);
    return this.teamsRepository.save(updated);
  }

  async remove(id: number, _user: GetUserDto) {
    const old = await this.findOne(id).catch(throwNotFound);
    await this.teamsRepository.remove(old);
    return undefined;
  }
}
