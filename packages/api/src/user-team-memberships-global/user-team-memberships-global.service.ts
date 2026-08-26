import {
  GetUserDto,
  PostUserTeamMembershipDto,
  PutUserTeamMembershipDto,
} from '@edanalytics/models';
import { UserTeamMembership } from '@edanalytics/models-server';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { applyDtoUpdates, throwNotFound } from '../utils';

@Injectable()
export class UserTeamMembershipsGlobalService {
  constructor(
    @InjectRepository(UserTeamMembership)
    private userTeamMembershipsRepository: Repository<UserTeamMembership>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager
  ) {}
  create(createUserTeamMembershipDto: PostUserTeamMembershipDto) {
    return this.userTeamMembershipsRepository.save(
      this.userTeamMembershipsRepository.create(createUserTeamMembershipDto)
    );
  }

  async findOne(id: number) {
    return this.userTeamMembershipsRepository.findOneByOrFail({ id });
  }

  async update(id: number, updateUserTeamMembershipDto: PutUserTeamMembershipDto) {
    const old = await this.findOne(id);
    const updated = applyDtoUpdates(old, updateUserTeamMembershipDto, ['roleId', 'modifiedById']);
    return this.userTeamMembershipsRepository.save(updated);
  }

  async remove(id: number, _user: GetUserDto) {
    const old = await this.findOne(id).catch(throwNotFound);
    await this.userTeamMembershipsRepository.remove(old);
    return undefined;
  }
}
