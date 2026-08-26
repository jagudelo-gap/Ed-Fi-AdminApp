import { GetSessionDataDto, Ids, PostEdfiTenantDto, toGetEdfiTenantDto } from '@edanalytics/models';
import { addUserCreating, EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ReqEdfiTenant,
  ReqSbEnvironment,
  SbEnvironmentEdfiTenantInterceptor,
} from '../../app/sb-environment-edfi-tenant.interceptor';
import { Authorize } from '../../auth/authorization/authorize.decorator';
import { InjectFilter } from '../../auth/helpers/inject-filter';
import { whereIds } from '../../auth/helpers/where-ids';
import { EdfiTenantsService } from './edfi-tenants.service';
import { StartingBlocksServiceV2 } from './starting-blocks';
import { AuthService } from '../../auth/auth.service';
import { Operation, SbVersion } from '../../auth/authorization';
import { ReqUser } from '../../auth/helpers/user.decorator';

@ApiTags('EdfiTenant')
@UseInterceptors(SbEnvironmentEdfiTenantInterceptor)
@Controller()
export class EdfiTenantsController {
  constructor(
    private readonly edfiTenantService: EdfiTenantsService,
    private readonly startingBlocksServiceV2: StartingBlocksServiceV2,
    @InjectRepository(EdfiTenant)
    private edfiTenantsRepository: Repository<EdfiTenant>,
    private readonly authService: AuthService
  ) {}

  @Get()
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant:read',
    subject: {
      id: '__filtered__',
      teamId: 'teamId',
      sbEnvironmentId: 'sbEnvironmentId',
    },
  })
  async findAll(
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @Param('sbEnvironmentId', new ParseIntPipe()) sbEnvironmentId: number,
    @InjectFilter('team.sb-environment.edfi-tenant:read') validIds: Ids
  ) {
    return toGetEdfiTenantDto(
      await this.edfiTenantsRepository.findBy({
        ...whereIds(validIds),
        sbEnvironmentId,
      })
    );
  }

  @Get(':edfiTenantId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant:read',
    subject: {
      id: 'edfiTenantId',
      teamId: 'teamId',
      sbEnvironmentId: 'sbEnvironmentId',
    },
  })
  async findOne(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('sbEnvironmentId', new ParseIntPipe()) sbEnvironmentId: number,
    @Param('teamId', new ParseIntPipe()) _teamId: number
  ) {
    return toGetEdfiTenantDto(
      await this.edfiTenantsRepository.findOneBy({
        id: edfiTenantId,
        sbEnvironmentId,
      })
    );
  }

  @SbVersion('v2')
  @Operation('Creating tenants')
  @Post()
  @Authorize({
    privilege: 'team.sb-environment:create-tenant',
    subject: {
      // authorized by sbEnvironment.
      id: 'sbEnvironmentId',
      teamId: 'teamId',
    },
  })
  async post(
    @Param('sbEnvironmentId', new ParseIntPipe()) sbEnvironmentId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqSbEnvironment() sbEnvironment: SbEnvironment,
    @Body() tenant: PostEdfiTenantDto,
    @ReqUser() user: GetSessionDataDto
  ) {
    const result = await this.edfiTenantService.create(sbEnvironment, addUserCreating(tenant, user));
    await this.authService.reloadTeamOwnershipCache(teamId);
    return result;
  }

  @SbVersion('v2')
  @Operation('Deleting tenants')
  @Delete(':edfiTenantId')
  @Authorize({
    privilege: 'team.sb-environment:delete-tenant',
    subject: {
      // authorized by sbEnvironment but still deleted by tenant's own name.
      id: 'sbEnvironmentId',
      teamId: 'teamId',
    },
  })
  delete(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('sbEnvironmentId', new ParseIntPipe()) sbEnvironmentId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqSbEnvironment() sbEnvironment: SbEnvironment,
    @ReqEdfiTenant() edfiTenant: EdfiTenant
  ) {
    return this.edfiTenantService.delete(sbEnvironment, edfiTenant);
  }
}
