import { PostOdsDto, PutOdsDto, toGetOdsDto } from '@edanalytics/models';
import { EdfiTenant, Edorg, Ods, SbEnvironment, regarding } from '@edanalytics/models-server';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CustomHttpException, ValidationHttpException, buildEdOrgTree } from '../../../utils';
import { Repository } from 'typeorm';
import { persistSyncOds, SyncableOds } from '../../../sb-sync/sync-ods';
import { AdminApiServiceV2, StartingBlocksServiceV2 } from '../starting-blocks';

@Injectable()
export class OdssService {
  constructor(
    @InjectRepository(Ods)
    private odssRepository: Repository<Ods>,
    @InjectRepository(Edorg)
    private edorgsRepository: Repository<Edorg>,
    private readonly startingBlocksServiceV2: StartingBlocksServiceV2,
    private readonly adminApiServiceV2: AdminApiServiceV2
  ) {}

  async findAll(edfiTenantId: number) {
    return this.odssRepository.findBy({ edfiTenantId });
  }

  findOne(id: number) {
    return this.odssRepository.findOneBy({ id });
  }

  async create(sbEnvironment: SbEnvironment, edfiTenant: EdfiTenant, dto: PostOdsDto) {
    if (!dto.templateName) {
      throw new ValidationHttpException({
        field: 'templateName',
        message: 'Template is required.',
      });
    }
    
    const result = await this.startingBlocksServiceV2.createOds(
      sbEnvironment,
      edfiTenant,
      dto.name,
      dto.templateName
    );
    if (result.status === 'SUCCESS') {
      return this.odssRepository
        .findOneBy({ odsInstanceName: dto.name })
        .then((ods) => toGetOdsDto(ods));
    }
    if (result.status === 'ALREADY_EXISTS') {
      throw new ValidationHttpException({
        field: 'name',
        message: 'An ODS by this name already exists.',
      });
    }
    throw new CustomHttpException(
      {
        title: 'Failed to create ODS.',
        type: 'Error',
        message: ('data' in result && result.data?.errorMessage) ?? result.status,
        regarding: regarding(edfiTenant),
      },
      500
    );
  }
  
  async UpdateOdsInstanceId(odsId: number, dto: PutOdsDto) {

    const ods = await this.odssRepository.findOneBy({ id: odsId });
    if (!ods) {
      throw new NotFoundException('ODS not found');
    }
    ods.odsInstanceId = dto.odsInstanceId;

    // Update all EdOrgs that belong to this ODS
    const edorgs = await this.edorgsRepository.findBy({ odsId: odsId });
    for (const edorg of edorgs) {
      edorg.odsInstanceId = dto.odsInstanceId;
    }

    await this.edorgsRepository.save(edorgs);
    await this.odssRepository.save(ods);
  }

  async delete(sbEnvironment: SbEnvironment, edfiTenant: EdfiTenant, id: Ods['id']) {
    const ods = await this.odssRepository.findOneBy({ id });
    if (ods === null) {
      throw new NotFoundException('ODS not found');
    }
    const result = await this.startingBlocksServiceV2.deleteOds(sbEnvironment, edfiTenant, ods);
    if (result.status === 'SUCCESS') {
      return undefined;
    }
    throw new CustomHttpException(
      {
        title: 'Failed to delete ODS.',
        type: 'Error',
        message: ('data' in result && result.data?.errorMessage) ?? result.status,
        regarding: regarding(ods),
      },
      500
    );
  }

  async getOdsRowCount(
    sbEnvironment: SbEnvironment,
    edfiTenant: Pick<EdfiTenant, 'name'>,
    ods: Ods
  ) {
    if (sbEnvironment.version === 'v2') {
      const rowCount = await this.startingBlocksServiceV2.odsRowCountService.rowCount({
        sbEnvironment,
        edfiTenant,
        ods,
      });
      if (rowCount.status !== 'SUCCESS') {
        throw new CustomHttpException(
          {
            title: 'Ods-row-count unsuccessful.',
            type: 'Error',
            message: rowCount.status + '. ' + (rowCount?.data?.errorMessage ?? 'Unknown error.'),
            regarding: regarding(sbEnvironment),
          },
          500
        );
      }
      return rowCount.data;
    } else {
      throw new NotFoundException('Only v2 environments support row counting.');
    }
  }

  async syncEdOrgs(
    sbEnvironment: SbEnvironment,
    edfiTenant: EdfiTenant,
    odsId: number
  ): Promise<void> {
    if (sbEnvironment.version !== 'v2') {
      throw new NotFoundException('Only v2 environments support Ed-Org sync.');
    }
    const ods = await this.odssRepository.findOneBy({ id: odsId });
    if (!ods) {
      throw new NotFoundException('ODS not found');
    }
    if (ods.odsInstanceId === null) {
      throw new BadRequestException('ODS does not have an Admin API instance ID');
    }

    const rawEdOrgs = await this.adminApiServiceV2.getEdOrgsForOdsInstance(
      edfiTenant,
      ods.odsInstanceId
    );

    // Build EdOrg tree from flat API response
    const edorgRoots = buildEdOrgTree(rawEdOrgs);

    const syncableOds: SyncableOds = {
      id: ods.odsInstanceId,
      name: ods.odsInstanceName,
      dbName: ods.dbName,
      edorgs: edorgRoots,
    };

    await this.odssRepository.manager.transaction(async (em) => {
      await persistSyncOds({ em, edfiTenant, ods: syncableOds });
    });
  }
}
