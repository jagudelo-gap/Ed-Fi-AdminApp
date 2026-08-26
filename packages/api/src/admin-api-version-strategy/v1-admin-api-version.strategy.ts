import { Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import {
  EdorgType,
  PostSbEnvironmentDto,
  PostSbEnvironmentTenantDTO,
  SbEnvironmentConfigPublic,
  SbV1MetaOds,
  TenantDto,
} from '@edanalytics/models';
import axios from 'axios';
import { randomBytes, randomUUID } from 'crypto';
import { AdminApiServiceV1, StartingBlocksServiceV1 } from '../teams/edfi-tenants/starting-blocks';
import { persistSyncTenant, SyncableOds } from '../sb-sync/sync-ods';
import { ValidationHttpException } from '../utils';
import { AdminApiVersionStrategy, BuildConfigPublicInput, DispatchSyncResult } from './admin-api-version-strategy.interface';

@Injectable()
export class V1AdminApiVersionStrategy implements AdminApiVersionStrategy {
  readonly version = 'v1' as const;
  readonly supportsMultiTenant = false;
  private readonly logger = new Logger(V1AdminApiVersionStrategy.name);

  constructor(
    private readonly adminApiServiceV1: AdminApiServiceV1,
    private readonly startingBlocksServiceV1: StartingBlocksServiceV1,
    @InjectRepository(EdfiTenant)
    private readonly edfiTenantsRepository: Repository<EdfiTenant>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager
  ) {}

  getAdminApiService() {
    return this.adminApiServiceV1;
  }

  buildConfigPublic({ createSbEnvironmentDto, odsApiMetaResponse }: BuildConfigPublicInput) {
    return {
      startingBlocks: createSbEnvironmentDto.startingBlocks,
      odsApiMeta: odsApiMetaResponse,
      adminApiUrl: createSbEnvironmentDto.adminApiUrl,
      version: 'v1' as const,
      values: {
        edfiHostname: createSbEnvironmentDto.odsApiDiscoveryUrl,
        adminApiUrl: createSbEnvironmentDto.adminApiUrl,
      },
    } as SbEnvironmentConfigPublic;
  }

  applyOdsUrlUpdate(_existingConfigPublic: unknown, newOdsApiDiscoveryUrl: string) {
    return { edfiHostname: newOdsApiDiscoveryUrl.replace(/^https?:\/\//, '') };
  }

  getTenantModeDefault(_existingEnvironment: SbEnvironment): boolean {
    return false; // v1 is always single-tenant
  }

  shouldTriggerResync(_hasUrlUpdates: boolean): boolean {
    return false; // handled by updateEnvironment()'s own v1 credential-recreation branch
  }

  getRegistrationHeaders(_isMultitenant: boolean, _tenant?: string): Record<string, string> {
    return { 'Content-Type': 'application/x-www-form-urlencoded' };
  }

  async bootstrapCredentials(_sbEnvironment: SbEnvironment): Promise<void> {
    // no-op: v1 credentials are created synchronously in dispatchSync(), never bootstrapped mid-sync
  }

  async provisionCredentialsForNewTenants(_sbEnvironment: SbEnvironment, _discoveredTenants: TenantDto[]): Promise<void> {
    // no-op: v1 is single-tenant, there is no "newly discovered tenant" concept
  }

  async dispatchSync(
    sbEnvironment: SbEnvironment,
    createSbEnvironmentDto?: PostSbEnvironmentDto
  ): Promise<DispatchSyncResult> {
    if (!createSbEnvironmentDto) {
      throw new Error('V1AdminApiVersionStrategy.dispatchSync requires createSbEnvironmentDto');
    }
    if (!createSbEnvironmentDto.tenants || createSbEnvironmentDto.tenants.length === 0) {
      throw new ValidationHttpException({
        field: 'tenants',
        message: 'At least one tenant is required for v1 deployment',
      });
    }

    const defaultTenantDto = createSbEnvironmentDto.tenants[0];
    const edfiTenant = await this.findOrCreateTenant(sbEnvironment, defaultTenantDto.name);
    await this.syncTenantDataV1(defaultTenantDto, edfiTenant);

    const { clientId, clientSecret } = await this.createClientCredentials(createSbEnvironmentDto.adminApiUrl);
    await this.startingBlocksServiceV1.saveAdminApiCredentials(sbEnvironment, {
      ClientId: clientId,
      ClientSecret: clientSecret,
      url: createSbEnvironmentDto.adminApiUrl,
    });

    return { kind: 'inline' };
  }

  private async createClientCredentials(
    adminApiUrl: string
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
        headers: this.getRegistrationHeaders(false),
      });
      if (!registerResponse.status || registerResponse.status !== 200) {
        throw new Error(`Registration failed! status: ${registerResponse.status}`);
      }
      return { clientId, displayName, clientSecret };
    } catch (error) {
      this.logger.error('Failed to register client credentials:', error);
      throw new ValidationHttpException({
        field: 'adminApiUrl',
        message: error.message,
      });
    }
  }

  private async findOrCreateTenant(sbEnvironment: SbEnvironment, tenantName: string): Promise<EdfiTenant> {
    const existingTenants = await this.edfiTenantsRepository.find({
      where: { sbEnvironmentId: sbEnvironment.id },
    });
    if (existingTenants.length === 0) {
      return this.edfiTenantsRepository.save({
        name: tenantName,
        sbEnvironmentId: sbEnvironment.id,
      } as EdfiTenant);
    }
    return existingTenants[0];
  }

  private async syncTenantDataV1(tenantDto: PostSbEnvironmentTenantDTO, tenantEntity: EdfiTenant) {
    const metaOds = this.createODSObjectV1(tenantDto);
    await this.saveSyncableOdsV1(metaOds, tenantEntity);
  }

  private createODSObjectV1(tenant: PostSbEnvironmentTenantDTO): SbV1MetaOds[] {
    return (
      tenant.odss?.map((ods) => ({
        id: ods.id,
        name: ods.name,
        dbname: ods.dbName,
        edorgs: ods.allowedEdOrgs
          ?.split(',')
          .map((id) => id.trim())
          .filter((edorg) => edorg !== '' && !isNaN(Number(edorg)))
          .map((edorg) => ({
            educationorganizationid: parseInt(edorg),
            nameofinstitution: `Institution #${edorg}`,
            shortnameofinstitution: `I#${edorg}`,
            id: parseInt(edorg),
            discriminator: EdorgType['edfi.Other'],
          })),
      })) || []
    );
  }

  private async saveSyncableOdsV1(
    metaOds: SbV1MetaOds[],
    tenantEntity: { name: string; sbEnvironmentId: number } & EdfiTenant
  ) {
    const odss = (metaOds ?? []).map(
      (o): SyncableOds => ({
        id: o.id ?? null,
        name: o.name ?? o.dbname,
        dbName: o.dbname,
        edorgs: o.edorgs,
      })
    );
    await this.entityManager.transaction((em) => persistSyncTenant({ em, odss, edfiTenant: tenantEntity }));
  }
}
