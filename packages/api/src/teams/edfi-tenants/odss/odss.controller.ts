import { GetSessionDataDto, Ids, PostOdsDto, PutOdsDto, toGetOdsDto, toOdsRowCountsDto } from '@edanalytics/models';
import { addUserCreating, addUserModifying, EdfiTenant, Ods, SbEnvironment } from '@edanalytics/models-server';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ReqEdfiTenant,
  ReqSbEnvironment,
  SbEnvironmentEdfiTenantInterceptor,
} from '../../../app/sb-environment-edfi-tenant.interceptor';
import { Authorize, SbVersion } from '../../../auth/authorization';
import { InjectFilter } from '../../../auth/helpers/inject-filter';
import { whereIds } from '../../../auth/helpers/where-ids';
import { StartingBlocksServiceV2 } from '../starting-blocks';
import { OdssService } from './odss.service';
import { ReqUser } from '../../../auth/helpers/user.decorator';

@ApiTags('Ods')
@UseInterceptors(SbEnvironmentEdfiTenantInterceptor)
@Controller()
export class OdssController {
  constructor(
    private readonly odsService: OdssService,
    @InjectRepository(Ods)
    private odssRepository: Repository<Ods>,
    private readonly startingBlocksServiceV2: StartingBlocksServiceV2
  ) {}

  @Get()
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods:read',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async findAll(
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @InjectFilter('team.sb-environment.edfi-tenant.ods:read') validIds: Ids
  ) {
    return toGetOdsDto(
      await this.odssRepository.findBy({
        ...whereIds(validIds),
        edfiTenantId,
      })
    );
  }

  @Get(':odsId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods:read',
    subject: {
      id: 'odsId',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async findOne(
    @Param('odsId', new ParseIntPipe()) odsId: number,
    @Param('teamId', new ParseIntPipe()) _teamId: number,
    @Param('edfiTenantId', new ParseIntPipe()) _edfiTenantId: number
  ) {
    return toGetOdsDto(await this.odsService.findOne(odsId));
  }
  @Post()
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant:create-ods',
    subject: {
      teamId: 'teamId',
      edfiTenantId: 'edfiTenantId',
      id: '__filtered__',
    },
  })
  post(
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @ReqSbEnvironment() sbEnvironment: SbEnvironment,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Body() dto: PostOdsDto,
    @ReqUser() user: GetSessionDataDto
  ) {
    return this.odsService.create(sbEnvironment, edfiTenant, addUserCreating(dto, user));
  }
  @Put(':odsId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:create',
    subject: {
      id: 'odsId',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  put(
    @Param('odsId', new ParseIntPipe()) odsId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @ReqSbEnvironment() sbEnvironment: SbEnvironment,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Body() dto: PutOdsDto,
    @ReqUser() user: GetSessionDataDto
  ) {
    return this.odsService.UpdateOdsInstanceId(odsId, addUserModifying(dto, user));
  }
  @Delete(':odsId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant:delete-ods',
    subject: {
      // authorized by edfiTenant but still deleted by ODS's own id.
      teamId: 'teamId',
      edfiTenantId: 'edfiTenantId',
      id: 'odsId',
    },
  })
  delete(
    @Param('odsId', new ParseIntPipe()) odsId: number,
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqSbEnvironment() sbEnvironment: SbEnvironment,
    @ReqEdfiTenant() edfiTenant: EdfiTenant
  ) {
    return this.odsService.delete(sbEnvironment, edfiTenant, odsId);
  }

  @Get(':odsId/row-count')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods:read-row-counts',
    subject: {
      id: 'odsId',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async getOdsRowCounts(
    @Param('odsId', new ParseIntPipe()) odsId: number,
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @ReqEdfiTenant() edfiTenant: Pick<EdfiTenant, 'name'>,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqSbEnvironment() sbEnvironment: SbEnvironment
  ) {
    const ods = await this.odsService.findOne(odsId);
    if (!ods) {
      throw new NotFoundException('ods not found (odss.controller/getOdsRowCount)');
    }

    const result = await this.odsService.getOdsRowCount(sbEnvironment, edfiTenant, ods);
    // TODO remove conditional once Lambda is updated
    if (typeof result === 'string') {
      const parsedResult = JSON.parse(result);
      return toOdsRowCountsDto(parsedResult);
    }
    return toOdsRowCountsDto(result);
  }

  @SbVersion('v2')
  @Post(':odsId/sync-edorgs')
  @HttpCode(204)
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods:read',
    subject: {
      id: 'odsId',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async syncEdOrgs(
    @Param('odsId', new ParseIntPipe()) odsId: number,
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqSbEnvironment() sbEnvironment: SbEnvironment,
    @ReqEdfiTenant() edfiTenant: EdfiTenant
  ) {
    await this.odsService.syncEdOrgs(sbEnvironment, edfiTenant, odsId);
  }
}
