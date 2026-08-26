import { InvokeCommand, LambdaClient, LambdaServiceException } from '@aws-sdk/client-lambda';
import { parse, validate } from '@aws-sdk/util-arn-parser';
import {
  AddEdorgDtoV2,
  ISbEnvironmentConfigPublicV2,
  PostEdfiTenantDto,
  SbV2MetaEnv,
  SbV2TenantResourceTree,
} from '@edanalytics/models';
import { EdfiTenant, Ods, SbEnvironment } from '@edanalytics/models-server';
import { createConcurrencyLimiter, wait } from '@edanalytics/utils';
import { Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import _ from 'lodash';
import { EntityManager, In, Repository } from 'typeorm';
import {
  DeltaCounts,
  SyncableOds,
  persistSyncDeleteOds,
  persistSyncOds,
  persistSyncTenant,
} from '../../../../sb-sync/sync-ods';
import { EdorgMgmtServiceV2 } from './edorg-mgmt.v2.service';
import { OdsMgmtServiceV2 } from './ods-mgmt.v2.service';
import { TenantMgmtServiceV2 } from './tenant-mgmt.v2.service';
import { randomUUID } from 'crypto';
import { OdsRowCountService } from './ods-rowcount.service';

// TODO eventually need to limit concurrency per-environment (to 1) but across envs we can run in parallel
const limit = createConcurrencyLimiter(1);

/* eslint @typescript-eslint/no-explicit-any: 0 */ // --> OFF
@Injectable()
export class StartingBlocksServiceV2 {
  private readonly logger = new Logger(StartingBlocksServiceV2.name);
  readonly tenantMgmtService = new TenantMgmtServiceV2();
  readonly odsMgmtService = new OdsMgmtServiceV2();
  readonly odsRowCountService = new OdsRowCountService();
  readonly edorgMgmtService = new EdorgMgmtServiceV2();
  constructor(
    @InjectRepository(EdfiTenant)
    private edfiTenantsRepository: Repository<EdfiTenant>,
    @InjectRepository(SbEnvironment)
    private sbEnvironmentsRepository: Repository<SbEnvironment>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager
  ) {}

  async getTenantResourceTree(edfiTenant: EdfiTenant) {
    const sbEnvironment = await this.sbEnvironmentsRepository.findOneBy({
      id: edfiTenant.sbEnvironmentId,
    });
    const v2config = sbEnvironment.configPublic.values;
    if (!('meta' in v2config)) return { status: 'NO_CONFIG' as const };

    const metaValue = v2config.meta;

    if (!validate(metaValue.tenantResourceTreeFunctionArn ?? '')) {
      this.logger.warn(
        `ARN tenantResourceTreeFunctionArn in ${sbEnvironment.envLabel} is not valid`
      );
      return {
        status: 'NO_CONFIG' as const,
      };
    }
    const arn = parse(metaValue.tenantResourceTreeFunctionArn);
    const client = new LambdaClient({
      region: arn.region,
      retryMode: 'adaptive',
      maxAttempts: 5,
    });
    try {
      const result = await client.send(
        new InvokeCommand({
          FunctionName: metaValue.tenantResourceTreeFunctionArn,
          InvocationType: 'RequestResponse',
          Payload: JSON.stringify({ tenant: edfiTenant.name }),
        })
      );
      const value = JSON.parse(Buffer.from(result.Payload).toString('utf8'));
      if (typeof result.FunctionError === 'string') {
        this.logger.error(value);
        return {
          status: 'FAILURE' as const,
          data: value,
        };
      }
      return {
        status: 'SUCCESS' as const,
        data: value as SbV2TenantResourceTree,
      };
    } catch (LambdaError: unknown) {
      const err = LambdaError as LambdaServiceException;
      this.logger.error(LambdaError);
      return {
        status: 'FAILURE' as const,
        error: err.message ? (err.message as string) : 'Failed to execute SB Lambda',
      };
    }
  }

  async saveSbEnvironmentMeta(sbEnvironment: SbEnvironment, meta: SbV2MetaEnv) {
    const configPublic = sbEnvironment.configPublic;
    configPublic.version = 'v2';
    const oldConfigValues = configPublic.values as ISbEnvironmentConfigPublicV2;
    configPublic.values = {
      ...oldConfigValues,
      meta,
      adminApiUuid: oldConfigValues?.adminApiUuid ?? randomUUID(),
    };

    const protocol = !meta.adminApiUrl.startsWith('htt') ? 'https://' : '';
    const url = new URL(protocol + meta.adminApiUrl);
    configPublic.adminApiUrl = url.toString();

    try {
      configPublic.odsApiMeta = await fetch(sbEnvironment.usableDomain).then((r) => r.json());
    } catch (_cantRetrieveMetaError) {
      this.logger.warn('Failed to GET ODS API root URL at ' + sbEnvironment.usableDomain);
    }

    sbEnvironment.envLabel = meta.envlabel;
    return await this.sbEnvironmentsRepository.save(sbEnvironment);
  }

  /** Reload app database tenants. Starting Blocks is the source of truth. */
  async syncTenants(sbEnvironment: SbEnvironment, mode?: 'MultiTenant' | 'SingleTenant') {
    if ('adminApiKey' in sbEnvironment.configPublic.values)
      throw new Error('Type narrowing - v1 check handled upstream');
    /** No support for SingleTenant mode currently. If tenants.data is not an array, line 142 will error.*/
    if (mode === 'SingleTenant') {
      throw new Error(
        'The SBE you are attempting to sync is in Single Tenant Mode. This Mode is currently not supported by SBAA. Please delete the current environment, switch the SBE mode to Multi-Tenant and resync the SBE in SBAA'
      );
    }
    const tenants = await this.tenantMgmtService.list(sbEnvironment);

    if (tenants.status !== 'SUCCESS') {
      return tenants;
    }
    const tenantNames = tenants.data.map((t) => t.Name);
    const existingTenants = await this.edfiTenantsRepository.find({
      where: { sbEnvironmentId: sbEnvironment.id },
    });

    const newTenants = tenantNames.filter((t) => !existingTenants.some((et) => et.name === t));
    const removedTenants = existingTenants.filter((et) => !tenantNames.some((t) => et.name === t));

    const [newSavedTenants] = await Promise.all([
      this.edfiTenantsRepository.save(
        newTenants.map((t) => {
          const tenant = new EdfiTenant();
          tenant.name = t;
          tenant.sbEnvironment = sbEnvironment;
          return tenant;
        })
      ),
      this.edfiTenantsRepository.delete({ id: In(removedTenants.map((t) => t.id)) }),
    ]);

    const newConfigPublic = _.cloneDeep(sbEnvironment.configPublic.values);

    for (let i = 0; i < tenants.data.length; i++) {
      const t = tenants.data[i];
      _.set(newConfigPublic, ['tenants', t.Name, 'allowedEdorgs'], t.AllowedEdOrgs);
    }
    for (let i = 0; i < removedTenants.length; i++) {
      const removedTenant = removedTenants[i];
      delete newConfigPublic.tenants[removedTenant.name];
    }
    if (!_.isEqual(newConfigPublic, sbEnvironment.configPublic.values)) {
      sbEnvironment.configPublic.values = newConfigPublic;
      await this.sbEnvironmentsRepository.save(sbEnvironment);
    }

    const allSavedTenants = new Map(
      [...existingTenants, ...newSavedTenants].map((t) => [t.name, t])
    );
    for (const tenant of tenants.data) {
      const isAdminApiConnected = !!newConfigPublic.tenants?.[tenant.Name]?.adminApiKey;
      if (!isAdminApiConnected) {
        const keygenResult = await this.regenerateAdminApiCredentials(
          allSavedTenants.get(tenant.Name)!
        );
        if (keygenResult.status !== 'SUCCESS') {
          return {
            status: 'FAILURE' as const,
            error: 'Failed to generate admin API key for tenant ' + tenant.Name,
          };
        }
      }
    }
    return {
      status: 'SUCCESS' as const,
      data: {
        inserted: newTenants,
        deleted: removedTenants.map((t) => t.name),
      },
    };
  }

  async syncTenantResourceTree(edfiTenant: EdfiTenant) {
    const resourceTreeResponse = await this.getTenantResourceTree(edfiTenant);
    if (resourceTreeResponse.status !== 'SUCCESS') {
      return resourceTreeResponse;
    }
    const metaTenant = resourceTreeResponse.data;

    try {
      const odss = (metaTenant.odss ?? []).map(
        (o): SyncableOds => ({
          ...o,
          dbName: o.dbname,
        })
      );
      return await this.entityManager.transaction((em) =>
        persistSyncTenant({ em, odss, edfiTenant })
      );
    } catch (operationError) {
      this.logger.error(operationError);
      return {
        status: 'FAILURE' as const,
        error: operationError.message
          ? (operationError.message as string)
          : 'Failed to sync tenant resource tree',
      };
    }
  }
  async syncOdsResourceTree(edfiTenant: EdfiTenant, odsName: string) {
    const resourceTreeResponse = await this.getTenantResourceTree(edfiTenant); // TODO use actual ods version when that's available
    if (resourceTreeResponse.status !== 'SUCCESS') {
      return resourceTreeResponse;
    }
    const metaTenant = resourceTreeResponse.data;
    const metaOds = metaTenant.odss?.find((o) => o.name === odsName);

    try {
      return await this.entityManager.transaction((em) =>
        persistSyncOds({ em, ods: { ...metaOds, dbName: metaOds.dbname }, edfiTenant })
      );
    } catch (operationError) {
      this.logger.error(operationError);
      return {
        status: 'FAILURE' as const,
        error: operationError.message
          ? (operationError.message as string)
          : 'Failed to sync tenant resource tree',
      };
    }
  }

  async syncEnvironmentEverything(sbEnvironment: SbEnvironment, meta: SbV2MetaEnv) {
    await this.saveSbEnvironmentMeta(sbEnvironment, meta);
    const resultsByTenant: Record<
      string,
      {
        action: 'created' | 'deleted' | null;
        hasChanges: boolean | undefined;
        ods?: DeltaCounts;
        edorg?: DeltaCounts;
      }
    > = {};
    const mode = meta.mode;
    const tenantResults = await this.syncTenants(sbEnvironment, mode);
    if (tenantResults.status !== 'SUCCESS') {
      return tenantResults;
    }
    tenantResults.data.inserted.forEach((t) => {
      resultsByTenant[t] = {
        action: 'created',
        hasChanges: true,
      };
    });
    tenantResults.data.deleted.forEach((t) => {
      resultsByTenant[t] = {
        action: 'deleted',
        hasChanges: true,
      };
    });

    const tenants = await this.edfiTenantsRepository.find({
      where: { sbEnvironmentId: sbEnvironment.id },
    });

    let success = true;
    await Promise.all(
      tenants.map((tenant) =>
        limit(async () => {
          const result = await this.syncTenantResourceTree(tenant);
          if (result.status !== 'SUCCESS') {
            this.logger.error(result.status);
            this.logger.error(result.error);
            resultsByTenant[tenant.name] = result as any;
            success = false;
            return;
          }
          if (!(tenant.name in resultsByTenant)) {
            resultsByTenant[tenant.name] = { action: null, hasChanges: false };
          }
          resultsByTenant[tenant.name].ods = result.data.ods;
          resultsByTenant[tenant.name].edorg = result.data.edorg;
          resultsByTenant[tenant.name].hasChanges =
            resultsByTenant[tenant.name].hasChanges || result.data.hasChanges;
        })
      )
    );
    let hasChanges = false;
    for (const tenantName in resultsByTenant) {
      if (resultsByTenant[tenantName].hasChanges) {
        hasChanges = true;
        break;
      }
    }
    if (success) {
      return {
        status: 'SUCCESS' as const,
        data: { hasChanges, tenants: resultsByTenant },
      };
    } else {
      return {
        status: 'FAILURE' as const,
        data: { hasChanges: hasChanges ?? undefined, tenants: resultsByTenant },
      };
    }
  }

  async saveAdminApiCredentials(
    edfiTenant: EdfiTenant,
    sbEnvironment: SbEnvironment,
    credentials: {
      ClientId: string;
      ClientSecret: string;
      /** If omitted doesn't get updated */
      url?: string;
    }
  ) {
    if (!sbEnvironment.configPrivate) {
      sbEnvironment.configPrivate = {};
    }
    if (
      'adminApiSecret' in sbEnvironment.configPrivate ||
      'adminApiKey' in sbEnvironment.configPublic.values
    ) {
      // just to narrow types
      throw new Error('Error: bad code calling v2 logic for v1 environment');
    }
    if (credentials.url !== undefined) {
      sbEnvironment.configPublic.adminApiUrl = credentials.url;
    }
    if (!('tenants' in sbEnvironment.configPublic.values)) {
      sbEnvironment.configPublic.values.tenants = {};
    }
    if (!(edfiTenant.name in sbEnvironment.configPublic.values.tenants)) {
      sbEnvironment.configPublic.values.tenants[edfiTenant.name] = { adminApiKey: '' };
    }
    sbEnvironment.configPublic.values.tenants[edfiTenant.name].adminApiKey = credentials.ClientId;
    if (!('tenants' in sbEnvironment.configPrivate)) {
      sbEnvironment.configPrivate.tenants = {};
    }
    if (!(edfiTenant.name in sbEnvironment.configPrivate.tenants)) {
      sbEnvironment.configPrivate.tenants[edfiTenant.name] = { adminApiSecret: '' };
    }
    sbEnvironment.configPrivate.tenants[edfiTenant.name].adminApiSecret = credentials.ClientSecret;
    await this.sbEnvironmentsRepository.save(sbEnvironment);
  }

  async regenerateAdminApiCredentials(edfiTenant: EdfiTenant) {
    const sbEnvironment = await this.sbEnvironmentsRepository.findOneBy({
      id: edfiTenant.sbEnvironmentId,
    });
    const result = await this.tenantMgmtService.keygen(sbEnvironment, edfiTenant.name);
    if (result.status !== 'SUCCESS') {
      return result;
    }
    await this.saveAdminApiCredentials(edfiTenant, sbEnvironment, result.data);
    return {
      status: 'SUCCESS' as const,
    };
  }

  async createTenant(sbEnvironment: SbEnvironment, tenant: PostEdfiTenantDto) {
    const addTenantResult = await this.tenantMgmtService.add(sbEnvironment, tenant);
    if (addTenantResult.status !== 'SUCCESS') {
      return addTenantResult;
    }
    const syncTenantsResult = await this.syncTenants(sbEnvironment);
    if (syncTenantsResult.status !== 'SUCCESS') {
      return {
        status: 'SYNC_FAILED' as const,
        data: syncTenantsResult.data,
      };
    }
    const newTenant = await this.edfiTenantsRepository.findOneBy({
      name: tenant.name,
      sbEnvironmentId: sbEnvironment.id,
    });
    // TODO it's possible this is unnecessary because it's impossible for there to be any resources initially. Not sure.
    const syncResourceTreeResult = await this.syncTenantResourceTree(newTenant);
    if (syncResourceTreeResult.status !== 'SUCCESS') {
      return {
        status: 'SYNC_RESOURCE_TREE_FAILED' as const,
      };
    }
    const reloadTenantsResult = await this.tenantMgmtService.reload(sbEnvironment);
    if (reloadTenantsResult.status !== 'SUCCESS') {
      return {
        status: 'TENANT_RELOAD_FAILED' as const,
      };
    } else {
      // reload returns on successful initiation of reload, not on completion. Just give it a sec.
      await wait(2000);
    }

    return {
      status: 'SUCCESS' as const,
      edfiTenant: newTenant,
    };
  }
  async deleteTenant(sbEnvironment: SbEnvironment, name: string) {
    const removeResult = await this.tenantMgmtService.remove(sbEnvironment, name);
    if (removeResult.status !== 'SUCCESS') {
      return removeResult;
    }
    const syncResult = await this.syncTenants(sbEnvironment);
    if (syncResult.status !== 'SUCCESS') {
      return syncResult;
    }
    const reloadTenantsResult = await this.tenantMgmtService.reload(sbEnvironment);
    if (reloadTenantsResult.status !== 'SUCCESS') {
      return {
        status: 'TENANT_RELOAD_FAILED' as const,
      };
    } else {
      // reload returns on successful initiation of reload, not on completion. Just give it a sec.
      await wait(2000);
    }
    return {
      status: 'SUCCESS' as const,
    };
  }
  async createOds(
    sbEnvironment: SbEnvironment,
    edfiTenant: EdfiTenant,
    name: string,
    templateName: string
  ) {
    const odsMgmtResponse = await this.odsMgmtService.add(
      sbEnvironment,
      edfiTenant,
      name,
      templateName
    );
    if (odsMgmtResponse.status !== 'SUCCESS') {
      return odsMgmtResponse;
    }
    const syncResult = await this.syncOdsResourceTree(edfiTenant, name);
    if (syncResult.status !== 'SUCCESS') {
      return syncResult;
    }
    return {
      status: 'SUCCESS' as const,
      data: undefined,
    };
  }
  async deleteOds(sbEnvironment: SbEnvironment, edfiTenant: EdfiTenant, ods: Ods) {
    if (ods.odsInstanceName === null) {
      return {
        status: 'NO_ODS_NAME_IN_SBAA' as const,
      };
    }
    const removeResult = await this.odsMgmtService.remove(
      sbEnvironment,
      edfiTenant,
      ods.odsInstanceName
    );
    if (removeResult.status !== 'SUCCESS') {
      return removeResult;
    }
    const result = await this.entityManager.transaction((em) =>
      persistSyncDeleteOds({ ods, edfiTenant, em })
    );
    return result;
  }
  async createEdorg(sbEnvironment: SbEnvironment, edfiTenant: EdfiTenant, dto: AddEdorgDtoV2) {
    const result = await this.edorgMgmtService.add(sbEnvironment, edfiTenant, dto);
    if (result.status !== 'SUCCESS') {
      return result;
    }
    const syncResult = await this.syncTenantResourceTree(edfiTenant);
    if (syncResult.status !== 'SUCCESS') {
      return syncResult;
    }
    return {
      status: 'SUCCESS' as const,
      data: undefined,
    };
  }
  async deleteEdorg(
    sbEnvironment: SbEnvironment,
    edfiTenant: EdfiTenant,
    odsName: string,
    educationOrganizationId: string
  ) {
    const result = await this.edorgMgmtService.remove(
      sbEnvironment,
      edfiTenant,
      odsName,
      educationOrganizationId
    );
    if (result.status !== 'SUCCESS') {
      return result;
    }
    const syncResult = await this.syncTenantResourceTree(edfiTenant);
    if (syncResult.status !== 'SUCCESS') {
      return syncResult;
    }
    return {
      status: 'SUCCESS' as const,
      data: undefined,
    };
  }
}
