import {
  ISbEnvironmentConfigPrivateV1,
  ISbEnvironmentConfigPublicV1,
  SbV1MetaEnv,
} from '@edanalytics/models';
import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import { Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { DeltaCounts, SyncableOds, persistSyncTenant } from '../../../../sb-sync/sync-ods';

/* eslint @typescript-eslint/no-explicit-any: 0 */ // --> OFF
@Injectable()
export class StartingBlocksServiceV1 {
  private readonly logger = new Logger(StartingBlocksServiceV1.name);
  constructor(
    @InjectRepository(EdfiTenant)
    private edfiTenantsRepository: Repository<EdfiTenant>,
    @InjectRepository(SbEnvironment)
    private sbEnvironmentsRepository: Repository<SbEnvironment>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager
  ) {}
  async saveAdminApiCredentials(
    sbEnvironment: SbEnvironment,
    credentials: {
      ClientId: string;
      ClientSecret: string;
      /** If omitted doesn't get updated */
      url?: string;
    }
  ) {
    if (sbEnvironment.version !== 'v1') {
      throw new Error(
        'Environment is not v1. You may need to run the sync before saving Admin API credentials.'
      );
    }
    if (!sbEnvironment.configPrivate) {
      sbEnvironment.configPrivate = {};
    }

    const configPublic = sbEnvironment.configPublic;
    if (credentials.url !== undefined) {
      configPublic.adminApiUrl = credentials.url;
    }
    configPublic.values = {
      ...(configPublic.values as ISbEnvironmentConfigPublicV1),
      adminApiKey: credentials.ClientId,
    };

    (sbEnvironment.configPrivate as ISbEnvironmentConfigPrivateV1).adminApiSecret =
      credentials.ClientSecret;
    return await this.sbEnvironmentsRepository.save(sbEnvironment);
  }
  async saveSbEnvironmentMeta(sbEnvironment: SbEnvironment, meta: SbV1MetaEnv) {
    const configPublic = sbEnvironment.configPublic;
    configPublic.version = 'v1';
    if (!configPublic.adminApiUrl) {
      const protocol = !meta.domainName.startsWith('htt') ? 'https://' : '';
      const url = new URL(protocol + meta.domainName);
      url.hostname = 'adminapi.' + url.hostname;
      configPublic.adminApiUrl = url.toString();
    }

    try {
      configPublic.odsApiMeta = await fetch(sbEnvironment.usableDomain).then((r) => r.json());
    } catch (_cantRetrieveMetaError) {
      this.logger.warn('Failed to GET ODS API root URL at ' + sbEnvironment.usableDomain);
    }

    if (configPublic.startingBlocks) {
      configPublic.values = { ...configPublic.values, edfiHostname: meta.domainName };
    }
    
    sbEnvironment.envLabel = meta.envlabel;
    return await this.sbEnvironmentsRepository.save(sbEnvironment);
  }

  async syncEnvironmentEverything(sbEnvironment: SbEnvironment, meta: SbV1MetaEnv) {
    await this.saveSbEnvironmentMeta(sbEnvironment, meta);
    const edfiTenants = await this.edfiTenantsRepository.find({
      where: { sbEnvironmentId: sbEnvironment.id },
    });
    let edfiTenant: EdfiTenant;

    const result: {
      tenant: 'created' | null;
      edorg?: DeltaCounts;
      ods?: DeltaCounts;
    } = {
      tenant: null,
    };
    if (edfiTenants.length === 0) {
      edfiTenant = await this.edfiTenantsRepository.save({
        name: 'default',
        sbEnvironmentId: sbEnvironment.id,
      });
      result.tenant = 'created';
    } else {
      edfiTenant = edfiTenants[0];
    }
    const treeSyncResult = await this.syncTenantResourceTree(edfiTenant, meta);
    if (treeSyncResult.status !== 'SUCCESS') {
      return treeSyncResult;
    }
    result.edorg = treeSyncResult.data.edorg;
    result.ods = treeSyncResult.data.ods;
    return {
      status: 'SUCCESS' as const,
      data: result,
    };
  }

  async syncTenantResourceTree(edfiTenant: EdfiTenant, meta: SbV1MetaEnv) {
    const sbEnvironment = await this.sbEnvironmentsRepository.findOne({
      where: { id: edfiTenant.sbEnvironmentId },
      relations: ['edfiTenants'],
    });

    if (sbEnvironment.edfiTenants.length !== 1) {
      return {
        status: 'INVALID_ENVIRONMENT_TENANTS' as const,
      };
    }
    const metaTenant = meta;

    try {
      const odss = (metaTenant.odss ?? []).map(
        (ods): SyncableOds => ({
          id: ods.id ?? null,
          name: ods.name ?? null,
          dbName: ods.dbname,
          edorgs: ods.edorgs,
        })
      );
      return await this.entityManager.transaction((em) =>
        persistSyncTenant({ em, odss, edfiTenant })
      );
    } catch (operationError) {
      this.logger.log(operationError);
      return {
        status: 'FAILURE' as const,
        error: operationError.message
          ? (operationError.message as string)
          : 'Failed to sync tenant resource tree',
      };
    }
  }
}
