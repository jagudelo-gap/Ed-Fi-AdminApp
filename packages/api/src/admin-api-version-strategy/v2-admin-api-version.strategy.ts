import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SbEnvironment, SbSyncQueue } from '@edanalytics/models-server';
import {
  ISbEnvironmentConfigPrivateV2,
  ISbEnvironmentConfigPublicV2,
  SbEnvironmentConfigPublic,
  SbV2MetaEnv,
  TenantDto,
} from '@edanalytics/models';
import axios from 'axios';
import { randomBytes, randomUUID } from 'crypto';
import { AdminApiServiceV2 } from '../teams/edfi-tenants/starting-blocks';
import { ENV_SYNC_CHNL } from '../sb-sync/sb-sync.module';
import { IJobQueueService } from '../sb-sync/job-queue/job-queue.interface';
import {
  AdminApiVersionStrategy,
  AnyAdminApiService,
  BuildConfigPublicInput,
  DispatchSyncResult,
} from './admin-api-version-strategy.interface';

@Injectable()
export class V2AdminApiVersionStrategy implements AdminApiVersionStrategy {
  readonly version: 'v1' | 'v2' | 'v3' = 'v2';
  readonly supportsMultiTenant = true;
  protected readonly logger = new Logger(V2AdminApiVersionStrategy.name);

  constructor(
    @Inject('IJobQueueService')
    protected readonly jobQueue: IJobQueueService,
    @InjectRepository(SbSyncQueue)
    protected readonly queueRepository: Repository<SbSyncQueue>,
    @InjectRepository(SbEnvironment)
    protected readonly sbEnvironmentsRepository: Repository<SbEnvironment>,
    // Optional (TypeScript-only, via `?:`) so subclasses (e.g. V3AdminApiVersionStrategy,
    // which overrides getAdminApiService()) can call super() without a real
    // AdminApiServiceV2. AdminApiServiceV2 is always registered as a provider, so Nest's
    // own DI for a real V2 strategy instance will still supply it; no @Optional() decorator
    // is needed (and adding one caused Nest to misresolve V3's own constructor params,
    // since self-declared dependency metadata is inherited through the prototype chain).
    protected readonly adminApiServiceV2?: AdminApiServiceV2
  ) {}

  getAdminApiService(): AnyAdminApiService {
    // Always defined for a real V2 strategy instance; only undefined when a
    // subclass (V3) that overrides this method calls super() without it.
    return this.adminApiServiceV2!;
  }

  buildConfigPublic({ createSbEnvironmentDto, odsApiMetaResponse, tenantMode }: BuildConfigPublicInput) {
    return {
      startingBlocks: createSbEnvironmentDto.startingBlocks,
      odsApiMeta: odsApiMetaResponse,
      adminApiUrl: createSbEnvironmentDto.adminApiUrl,
      version: this.version as 'v2',
      values: {
        meta: {
          envlabel: createSbEnvironmentDto.environmentLabel,
          mode: tenantMode,
          domainName: createSbEnvironmentDto.odsApiDiscoveryUrl,
          adminApiUrl: createSbEnvironmentDto.adminApiUrl,
          tenantManagementFunctionArn: '',
          tenantResourceTreeFunctionArn: '',
          odsManagementFunctionArn: '',
          edorgManagementFunctionArn: '',
          dataFreshnessFunctionArn: '',
        } satisfies SbV2MetaEnv,
        adminApiUuid: randomUUID(),
      },
    } as SbEnvironmentConfigPublic;
  }

  applyOdsUrlUpdate(
    existingConfigPublic: SbEnvironmentConfigPublic,
    newOdsApiDiscoveryUrl: string
  ): Record<string, unknown> {
    const existingValues: Partial<ISbEnvironmentConfigPublicV2> =
      (existingConfigPublic?.values as ISbEnvironmentConfigPublicV2 | undefined) ?? {};
    return {
      ...existingValues,
      meta: {
        ...existingValues.meta,
        domainName: newOdsApiDiscoveryUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''),
      },
    };
  }

  getTenantModeDefault(existingEnvironment: SbEnvironment): boolean {
    const values = existingEnvironment.configPublic?.values;
    return (
      !!values &&
      'meta' in values &&
      (values as ISbEnvironmentConfigPublicV2).meta?.mode === 'MultiTenant'
    );
  }

  shouldTriggerResync(hasUrlUpdates: boolean): boolean {
    return hasUrlUpdates;
  }

  getRegistrationHeaders(isMultitenant: boolean, tenant?: string): Record<string, string> {
    return isMultitenant
      ? { 'Content-Type': 'application/x-www-form-urlencoded', tenant: tenant! }
      : { 'Content-Type': 'application/x-www-form-urlencoded' };
  }

  async dispatchSync(sbEnvironment: SbEnvironment): Promise<DispatchSyncResult> {
    const id = await this.jobQueue.send(
      ENV_SYNC_CHNL,
      { sbEnvironmentId: sbEnvironment.id },
      { expireInHours: 2 }
    );

    const pendingStates = new Set(['created', 'retry', 'active']);
    const maxAttempts = 20;
    const pollIntervalMs = 500;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise<void>((resolve) => setTimeout(resolve, pollIntervalMs));
      const queueItem = await this.queueRepository.findOneBy({ id });
      if (queueItem && !pendingStates.has(queueItem.state)) {
        return { kind: 'queued', syncQueue: queueItem };
      }
    }

    const queueItem = await this.queueRepository.findOneBy({ id });
    if (queueItem) return { kind: 'queued', syncQueue: queueItem };

    const fallback = new SbSyncQueue();
    fallback.id = id;
    fallback.state = 'active';
    return { kind: 'queued', syncQueue: fallback };
  }

  async bootstrapCredentials(sbEnvironment: SbEnvironment): Promise<void> {
    const configPublic = sbEnvironment.configPublic;
    if (!configPublic?.values) return;

    const config = configPublic.values as ISbEnvironmentConfigPublicV2;
    if (Object.keys(config?.tenants || {}).length > 0) {
      this.logger.log(`Environment ${sbEnvironment.name} already has credentials, skipping bootstrap`);
      return;
    }

    const isMultiTenant = config?.meta?.mode === 'MultiTenant';
    let tenantNames: string[];

    if (isMultiTenant) {
      try {
        const rootClient = axios.create({ baseURL: sbEnvironment.adminApiUrl!.replace(/\/$/, '') });
        const rootResponse = await rootClient
          .get<{ tenancy?: { multitenantMode?: boolean; tenants?: string[] } }>('/')
          .then((r) => r.data);

        if (
          rootResponse?.tenancy?.multitenantMode === true &&
          Array.isArray(rootResponse.tenancy.tenants) &&
          rootResponse.tenancy.tenants.length > 0
        ) {
          tenantNames = rootResponse.tenancy.tenants;
          this.logger.log(`Bootstrap: discovered tenants from root: [${tenantNames.join(', ')}]`);
        } else {
          tenantNames = ['default'];
          this.logger.log('Bootstrap: root endpoint did not return tenant list, falling back to default');
        }
      } catch (error) {
        this.logger.error(`Bootstrap: failed to reach Admin API root: ${error.message}`);
        return;
      }
    } else {
      tenantNames = ['default'];
    }

    if (!sbEnvironment.configPrivate) {
      sbEnvironment.configPrivate = { tenants: {} } as ISbEnvironmentConfigPrivateV2;
    }
    if (!config.tenants) config.tenants = {};

    for (const tenantName of tenantNames) {
      try {
        const { clientId, clientSecret } = await this.registerCredentials(
          sbEnvironment.adminApiUrl!,
          tenantName,
          isMultiTenant
        );
        config.tenants![tenantName] = { adminApiKey: clientId };

        const privateConfig = sbEnvironment.configPrivate as ISbEnvironmentConfigPrivateV2;
        if (!privateConfig.tenants) privateConfig.tenants = {};
        privateConfig.tenants[tenantName] = { adminApiSecret: clientSecret };

        this.logger.log(`Bootstrap: registered credentials for tenant '${tenantName}'`);
      } catch (error) {
        this.logger.error(`Bootstrap: failed to register credentials for tenant '${tenantName}': ${error.message}`);
      }
    }

    await this.sbEnvironmentsRepository.save(sbEnvironment);
    this.logger.log(`Bootstrap complete for environment: ${sbEnvironment.name}`);
  }

  async provisionCredentialsForNewTenants(
    sbEnvironment: SbEnvironment,
    discoveredTenants: TenantDto[]
  ): Promise<void> {
    const configPublic = sbEnvironment.configPublic;
    if (!configPublic?.values) return;

    const config = configPublic.values as ISbEnvironmentConfigPublicV2;
    const configPrivate = sbEnvironment.configPrivate as ISbEnvironmentConfigPrivateV2 | null;

    const existingTenants = Object.keys(config.tenants || {});
    const discoveredTenantNames = discoveredTenants.map((t) => t.name);
    const newTenants = discoveredTenantNames.filter((name) => !existingTenants.includes(name));

    if (newTenants.length === 0) {
      this.logger.log('No new tenants to provision credentials for');
      return;
    }

    this.logger.log(`Provisioning credentials for ${newTenants.length} new tenant(s): ${newTenants.join(', ')}`);

    if (!config.tenants) config.tenants = {};
    if (!configPrivate?.tenants) {
      if (!sbEnvironment.configPrivate) {
        sbEnvironment.configPrivate = { tenants: {} } as ISbEnvironmentConfigPrivateV2;
      } else {
        (sbEnvironment.configPrivate as ISbEnvironmentConfigPrivateV2).tenants = {};
      }
    }

    for (const tenantName of newTenants) {
      try {
        const { clientId, clientSecret } = await this.registerCredentials(
          sbEnvironment.adminApiUrl!,
          tenantName,
          true
        );
        config.tenants![tenantName] = { adminApiKey: clientId };

        const privateConfig = sbEnvironment.configPrivate as ISbEnvironmentConfigPrivateV2;
        if (!privateConfig.tenants) privateConfig.tenants = {};
        privateConfig.tenants[tenantName] = { adminApiSecret: clientSecret };

        this.logger.log(`Successfully provisioned credentials for tenant: ${tenantName}`);
      } catch (error) {
        this.logger.error(`Failed to provision credentials for tenant ${tenantName}: ${error.message}`, error.stack);
      }
    }

    await this.sbEnvironmentsRepository.save(sbEnvironment);
    this.logger.log(`Updated environment config with credentials for ${newTenants.length} new tenant(s)`);
  }

  /** Registers Admin API client credentials via /connect/register. Throws a plain Error on failure. */
  protected async registerCredentials(
    adminApiUrl: string,
    tenantName: string,
    isMultiTenant: boolean
  ): Promise<{ clientId: string; clientSecret: string; displayName: string }> {
    const registerUrl = `${adminApiUrl}/connect/register`;
    const secretCharset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const secretBytes = randomBytes(32);
    const clientSecret = Array.from(secretBytes, (byte) => secretCharset[byte % secretCharset.length]).join('');
    const clientId = `client_${randomUUID()}`;
    const nameSuffixBytes = randomBytes(4);
    const displayNameSuffix = Array.from(nameSuffixBytes, (byte) => (byte % 36).toString(36)).join('');
    const displayName = `AdminApp-v4-${displayNameSuffix}`;

    const formData = new URLSearchParams();
    formData.append('ClientId', clientId);
    formData.append('ClientSecret', clientSecret);
    formData.append('DisplayName', displayName);

    try {
      const registerResponse = await axios.post(registerUrl, formData.toString(), {
        headers: this.getRegistrationHeaders(isMultiTenant, tenantName),
      });
      if (!registerResponse.status || registerResponse.status !== 200) {
        throw new Error(`Registration failed! status: ${registerResponse.status}`);
      }
      return { clientId, displayName, clientSecret };
    } catch (error) {
      this.logger.error(`Failed to register client credentials for tenant ${tenantName}:`, error);
      if (error.response?.status === 400 && isMultiTenant) {
        throw new Error(
          `Tenant '${tenantName}' does not exist or is not properly configured in the Admin API`,
          { cause: error }
        );
      }
      throw new Error(`Failed to create credentials: ${error.message}`, { cause: error });
    }
  }
}
