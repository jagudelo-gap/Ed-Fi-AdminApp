import { AddEdorgDtoV2, EducationOrganizationDto } from '@edanalytics/models';
import { EdfiTenant, Edorg, Ods, SbEnvironment, regarding } from '@edanalytics/models-server';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CustomHttpException, ValidationHttpException, buildEdOrgTree } from '../../../utils';
import { StartingBlocksServiceV2 } from '../starting-blocks';
import { persistSyncTenant, SyncableOds } from '../../../sb-sync/sync-ods';
import { AdminApiServiceV2 } from '../starting-blocks/v2/admin-api.v2.service';
import { AdminApiServiceV3 } from '../starting-blocks/v3/admin-api.v3.service';

@Injectable()
export class EdorgsService {
  private readonly logger = new Logger(EdorgsService.name);

  constructor(
    @InjectRepository(Edorg)
    private edorgsRepository: Repository<Edorg>,
    @InjectRepository(Ods)
    private odsRepository: Repository<Ods>,
    private sbServiceV2: StartingBlocksServiceV2,
    private adminApiServiceV2: AdminApiServiceV2,
    private adminApiServiceV3: AdminApiServiceV3,
    private dataSource: DataSource
  ) {}

  findAll(edfiTenantId: EdfiTenant['id']) {
    return this.edorgsRepository.findBy({ edfiTenantId });
  }

  findOne(id: number) {
    return this.edorgsRepository.findOneBy({ id });
  }

  async add(sbEnvironment: SbEnvironment, edfiTenant: EdfiTenant, dto: AddEdorgDtoV2) {
    const addResult = await this.sbServiceV2.createEdorg(sbEnvironment, edfiTenant, dto);

    if (addResult.status === 'ALREADY_EXISTS') {
      throw new ValidationHttpException({
        field: 'EdOrgId',
        message: 'Education organization already exists in ODS',
      });
    }
    if (addResult.status === 'NO_CONFIG') {
      throw new CustomHttpException(
        {
          title: 'Bad system configuration',
          message: 'Check function ARNs or report this error.',
          type: 'Error',
          regarding: regarding(edfiTenant),
        },
        500
      );
    }
    if (addResult.status !== 'SUCCESS') {
      throw new CustomHttpException(
        {
          title: 'Failed to add education organization',
          message: addResult.data?.errorMessage,
          type: 'Error',
          regarding: regarding(edfiTenant),
        },
        500
      );
    }
    return undefined;
  }

  async remove(
    sbEnvironment: SbEnvironment,
    edfiTenant: EdfiTenant,
    odsName: string,
    educationOrganizationId: string
  ) {
    const addResult = await this.sbServiceV2.deleteEdorg(
      sbEnvironment,
      edfiTenant,
      odsName,
      educationOrganizationId
    );

    if (addResult.status !== 'SUCCESS') {
      throw new CustomHttpException(
        {
          title: 'Failed to remove education organization',
          message: addResult.data?.errorMessage,
          type: 'Error',
          regarding: regarding(edfiTenant),
        },
        500
      );
    }
    return undefined;
  }

  /**
   * Sync all education organizations across all ODS instances for a tenant
   * Fetches Ed-Orgs from the tenant's Admin API version (v2 or v3) and persists them to the database
   * Uses persistSyncTenant to handle all ODS instances atomically
   *
   * @param sbEnvironment - The tenant's environment, used to select the v2/v3 Admin API service
   * @param edfiTenant - The tenant to sync Ed-Orgs for
   * @returns Summary of sync operation with counts
   */
  async syncAllEdOrgs(
    sbEnvironment: SbEnvironment,
    edfiTenant: EdfiTenant
  ): Promise<{ synced: number; skipped: number }> {
    this.logger.log(`Starting Ed-Org sync for tenant ${edfiTenant.name} (id=${edfiTenant.id})`);

    try {
      // Step 1: Fetch all Ed-Orgs from the tenant's Admin API version
      const allEdOrgs =
        sbEnvironment.version === 'v3'
          ? await this.adminApiServiceV3.getAllEdOrgsForTenant(edfiTenant)
          : await this.adminApiServiceV2.getAllEdOrgsForTenant(edfiTenant);
      this.logger.log(`Fetched ${allEdOrgs.length} Ed-Orgs from Admin API`);

      if (allEdOrgs.length === 0) {
        this.logger.log('No Ed-Orgs returned from Admin API, nothing to sync');
        return { synced: 0, skipped: 0 };
      }

      // Step 2: Fetch all ODS instances for this tenant ONCE (avoids N+1 queries)
      const allOdsInstances = await this.odsRepository.find({
        where: { edfiTenantId: edfiTenant.id },
      });

      // Build lookup map: odsInstanceId -> ODS entity
      const odsMap = new Map<number, Ods>(
        allOdsInstances
          .filter((ods) => ods.odsInstanceId !== null)
          .map((ods) => [ods.odsInstanceId, ods])
      );

      this.logger.log(`Found ${odsMap.size} ODS instance(s) with odsInstanceId in database`);

      // Step 3: Group Ed-Orgs by instanceId
      const edOrgsByInstance = new Map<number, EducationOrganizationDto[]>();
      let skippedCount = 0;

      allEdOrgs.forEach((edOrg) => {
        if (edOrg.instanceId !== null && edOrg.instanceId !== undefined) {
          if (!edOrgsByInstance.has(edOrg.instanceId)) {
            edOrgsByInstance.set(edOrg.instanceId, []);
          }
          edOrgsByInstance.get(edOrg.instanceId).push(edOrg);
        } else {
          this.logger.warn(
            `Ed-Org ${edOrg.educationOrganizationId} "${edOrg.nameOfInstitution}" has no instanceId, skipping`
          );
          skippedCount++;
        }
      });

      this.logger.log(
        `Grouped Ed-Orgs into ${edOrgsByInstance.size} ODS instance(s), skipped ${skippedCount} Ed-Org(s) without instanceId`
      );

      // Step 4: Build SyncableOds array for all ODS instances
      const syncableOdsList: SyncableOds[] = [];

      for (const [odsInstanceId, edOrgs] of edOrgsByInstance.entries()) {
        const ods = odsMap.get(odsInstanceId);

        if (!ods) {
          this.logger.warn(
            `No ODS entity found for odsInstanceId ${odsInstanceId}, skipping ${edOrgs.length} Ed-Org(s)`
          );
          skippedCount += edOrgs.length;
          continue;
        }

        this.logger.log(
          `Preparing ${edOrgs.length} Ed-Org(s) for ODS instance ${odsInstanceId} (dbName: ${ods.dbName})`
        );

        // Build EdOrg tree preserving parent-child relationships
        const edOrgTree = buildEdOrgTree(edOrgs);

        syncableOdsList.push({
          id: odsInstanceId,
          name: ods.odsInstanceName,
          dbName: ods.dbName,
          edorgs: edOrgTree,
        });
      }

      if (syncableOdsList.length === 0) {
        this.logger.log('No ODS instances matched, nothing to sync');
        return { synced: 0, skipped: skippedCount };
      }

      // Step 5: Persist all ODS instances atomically using persistSyncTenant
      this.logger.log(
        `Persisting ${syncableOdsList.length} ODS instance(s) with Ed-Org trees`
      );

      let syncedCount = 0;

      await this.dataSource.transaction(async (em) => {
        const result = await persistSyncTenant({
          em,
          edfiTenant,
          odss: syncableOdsList,
        });

        if (result.status === 'SUCCESS') {
          syncedCount = allEdOrgs.length - skippedCount;
          
          this.logger.log(
            `Successfully synced Ed-Orgs for tenant ${edfiTenant.name}: ` +
            `${result.data.edorg.inserted} inserted, ` +
            `${result.data.edorg.updated} updated, ` +
            `${result.data.edorg.deleted} deleted | ` +
            `ODS: ${result.data.ods.inserted} inserted, ` +
            `${result.data.ods.updated} updated, ` +
            `${result.data.ods.deleted} deleted`
          );
        }
      });

      this.logger.log(
        `Ed-Org sync completed for tenant ${edfiTenant.name}: ${syncedCount} synced, ${skippedCount} skipped`
      );

      return { synced: syncedCount, skipped: skippedCount };
    } catch (error) {
      this.logger.error(
        `Error syncing Ed-Orgs for tenant ${edfiTenant.name}: ${error.message}`,
        error.stack
      );
      throw new CustomHttpException(
        {
          title: 'Failed to sync education organizations',
          message: error.message || 'An error occurred during sync',
          type: 'Error',
          regarding: regarding(edfiTenant),
        },
        500
      );
    }
  }
}
