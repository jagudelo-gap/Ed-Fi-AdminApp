import { GetUserDto, PRIVILEGES, PostRoleDto, PutRoleDto } from '@edanalytics/models';
import { Ownership, Role, User, UserTeamMembership, regarding } from '@edanalytics/models-server';
import { joinStrsNice } from '@edanalytics/utils';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import _ from 'lodash';
import { EntityManager, Repository } from 'typeorm';
import { CheckAbilityType } from '../auth/authorization';
import { throwNotFound } from '../utils';
import { CustomHttpException } from '../utils/customExceptions';

@Injectable()
export class RolesGlobalService {
  constructor(
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    @InjectRepository(UserTeamMembership)
    private utmRepository: Repository<UserTeamMembership>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Ownership)
    private ownershipsRepository: Repository<Ownership>
  ) {}
  async create(createRoleDto: PostRoleDto) {
    const uniqueReqPrivileges = _.uniq(createRoleDto.privilegeIds);
    if (uniqueReqPrivileges.some((code) => !PRIVILEGES[code])) {
      throw new BadRequestException('Invalid privileges');
    }
    return this.rolesRepository.save({
      teamId: createRoleDto.teamId,
      type: createRoleDto.type,
      name: createRoleDto.name,
      description: createRoleDto.description,
      privilegeIds: uniqueReqPrivileges,
    });
  }

  async findOne(id: number) {
    return this.rolesRepository.findOneByOrFail({ id });
  }

  async update(id: number, updateRoleDto: PutRoleDto) {
    const old = await this.findOne(id);
    const uniqueReqPrivileges = _.uniq(updateRoleDto.privilegeIds);
    if (uniqueReqPrivileges.some((code) => !PRIVILEGES[code])) {
      throw new BadRequestException('Invalid privileges');
    }
    return this.rolesRepository.save({
      ...old,
      name: updateRoleDto.name,
      description: updateRoleDto.description,
      privilegeIds: uniqueReqPrivileges,
    });
  }

  async remove(id: number, user: GetUserDto, force?: false): Promise<undefined>;
  async remove(
    id: number,
    user: GetUserDto,
    force: boolean,
    checkAbility: CheckAbilityType
  ): Promise<undefined>;
  async remove(id: number, user: GetUserDto, force = false, checkAbility?: CheckAbilityType) {
    const old = await this.findOne(id).catch(throwNotFound);
    const memberships = await this.utmRepository.findBy({ roleId: id });
    const users = await this.usersRepository.findBy({ roleId: id });
    const ownerships = await this.ownershipsRepository.findBy({ roleId: id });

    if (!force) {
      if (memberships.length || ownerships.length || users.length) {
        throw new CustomHttpException({
          type: 'RequiresForceDelete',
          title: 'Oops, it looks like this role is still being used.',
          message: `It's currently applied to one or more ${joinStrsNice([
            ...(memberships.length ? ['memberships'] : []),
            ...(users.length ? ['users'] : []),
            ...(ownerships.length ? ['ownerships'] : []),
          ])}.`,
          regarding: regarding(old),
        });
      }
    } else {
      const unauthorizedFks: string[] = [];
      if (
        users.length &&
        !checkAbility({
          privilege: 'user:update',
          subject: {
            id: '__filtered__',
          },
        })
      ) {
        unauthorizedFks.push('users');
      }
      if (
        memberships.length &&
        !checkAbility({
          privilege: 'user-team-membership:update',
          subject: {
            id: '__filtered__',
          },
        })
      ) {
        unauthorizedFks.push('team memberships');
      }
      if (
        ownerships.length &&
        !checkAbility({
          privilege: 'ownership:update',
          subject: {
            id: '__filtered__',
          },
        })
      ) {
        unauthorizedFks.push('resource ownerships');
      }

      if (unauthorizedFks.length) {
        throw new CustomHttpException(
          {
            type: 'Error',
            title: 'Insufficient privileges for force delete',
            message: `You don't have permission to delete this role because it's still being used by ${joinStrsNice(
              unauthorizedFks
            )} and you lack the privileges necessary to modify those.`,
          },
          403
        );
      }
    }
    await this.rolesRepository.remove(old);
    return undefined;
  }
}
