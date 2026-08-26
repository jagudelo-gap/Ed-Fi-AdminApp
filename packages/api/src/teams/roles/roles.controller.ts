import { GetSessionDataDto, PostRoleDto, PutRoleDto, toGetRoleDto } from '@edanalytics/models';
import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ReqUser } from '../../auth/helpers/user.decorator';
import { RolesService } from './roles.service';
import { ApiTags } from '@nestjs/swagger';
import { Role, addUserCreating, addUserModifying } from '@edanalytics/models-server';
import { Authorize } from '../../auth/authorization';
import { CustomHttpException } from '../../utils';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@ApiTags('Role')
@Controller()
export class RolesController {
  constructor(
    private readonly roleService: RolesService,
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>
  ) {}

  @Post()
  @Authorize({
    privilege: 'team.role:create',
    subject: {
      id: '__filtered__',
      teamId: 'teamId',
    },
  })
  async create(
    @Body() createRoleDto: PostRoleDto,
    @ReqUser() session: GetSessionDataDto,
    @Param('teamId', new ParseIntPipe()) teamId: number
  ) {
    return toGetRoleDto(
      await this.roleService.create(addUserCreating({ ...createRoleDto, teamId }, session))
    );
  }

  @Get()
  @Authorize({
    privilege: 'team.role:read',
    subject: {
      id: '__filtered__',
      teamId: 'teamId',
    },
  })
  async findAll(@Param('teamId', new ParseIntPipe()) teamId: number) {
    return toGetRoleDto(await this.roleService.findAll(teamId));
  }

  @Get(':roleId')
  @Authorize({
    privilege: 'team.role:read',
    subject: {
      id: 'roleId',
      teamId: 'teamId',
    },
  })
  async findOne(
    @Param('roleId', new ParseIntPipe()) roleId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number
  ) {
    return toGetRoleDto(await this.roleService.findOne(teamId, +roleId));
  }

  @Put(':roleId')
  @Authorize({
    privilege: 'team.role:update',
    subject: {
      id: 'roleId',
      teamId: 'teamId',
    },
  })
  async update(
    @Param('roleId', new ParseIntPipe()) roleId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @Body() updateRoleDto: PutRoleDto,
    @ReqUser() session: GetSessionDataDto
  ) {
    const result = await this.roleService.update(
      teamId,
      roleId,
      addUserModifying({ ...updateRoleDto, teamId }, session)
    );
    if (result.status === 'SUCCESS') {
      return toGetRoleDto(result.result);
    } else {
      if (result.status === 'INVALID_PRIVILEGES') {
        throw new CustomHttpException(
          {
            title: 'Invalid privileges',
            type: 'Error',
          },
          400
        );
      } else if (result.status === 'NOT_FOUND') {
        throw new CustomHttpException(
          {
            title: 'Not found',
            type: 'Error',
          },
          404
        );
      } else if (result.status === 'PUBLIC_ROLE') {
        throw new CustomHttpException(
          {
            title: 'Public role',
            type: 'Error',
          },
          400
        );
      } else if (result.status === 'NOT_TEAM_USER_ROLE') {
        throw new CustomHttpException(
          {
            title: 'Not team user role',
            type: 'Error',
          },
          400
        );
      }
    }
  }

  @Delete(':roleId')
  @Authorize({
    privilege: 'team.role:delete',
    subject: {
      id: 'roleId',
      teamId: 'teamId',
    },
  })
  async remove(
    @Param('roleId', new ParseIntPipe()) roleId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number
  ) {
    const old = await this.rolesRepository.findOneBy({ teamId: teamId, id: roleId });
    if (old === null) {
      throw new NotFoundException();
    }
    await this.rolesRepository.remove(old);
  }
}
