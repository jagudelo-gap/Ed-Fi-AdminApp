import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  GetUserDto,
  PostUserTeamMembershipDto,
  PutUserTeamMembershipDto,
} from '@edanalytics/models';
import { Repository } from 'typeorm';
import { throwNotFound } from '../../utils';
import { UserTeamMembership } from '@edanalytics/models-server';

@Injectable()
export class UserTeamMembershipsService {
  constructor(
    @InjectRepository(UserTeamMembership)
    private userTeamMembershipsRepository: Repository<UserTeamMembership>
  ) {}

  create(createUserTeamMembershipDto: PostUserTeamMembershipDto) {
    return this.userTeamMembershipsRepository.save(
      this.userTeamMembershipsRepository.create(createUserTeamMembershipDto)
    );
  }

  findAll(teamId: number) {
    return this.userTeamMembershipsRepository.findBy({
      teamId,
    });
  }

  findOne(teamId: number, id: number) {
    return this.userTeamMembershipsRepository.findOneByOrFail({ teamId, id }).catch(throwNotFound);
  }

  async update(teamId: number, id: number, updateUserTeamMembershipDto: PutUserTeamMembershipDto) {
    const old = await this.findOne(teamId, id);
    return this.userTeamMembershipsRepository.save({
      ...old,
      ...updateUserTeamMembershipDto,
    });
  }

  async remove(teamId: number, id: number, _user: GetUserDto) {
    const old = await this.findOne(teamId, id).catch(throwNotFound);
    await this.userTeamMembershipsRepository.remove(old);
    return undefined;
  }
}
