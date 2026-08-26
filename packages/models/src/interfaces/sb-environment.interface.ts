import { IEdfiTenant, IIntegrationApp, IOwnership } from '.';
import { SbV2MetaSaved } from '../dtos/starting-blocks.v2.dto';
import { SbV3MetaSaved } from '../dtos/starting-blocks.v3.dto';
import { IEntityBase } from '../utils/entity-base.interface';

export type SbaaAdminApiVersion = 'v1' | 'v2' | 'v3';

export type OdsApiMeta = {
  version: string;
  informationalVersion: string;
  suite: string;
  build: string;
  apiMode: string | undefined;
  dataModels: [
    {
      name: 'Ed-Fi';
      version: string;
      informationalVersion: string;
    }
  ];
  urls: {
    dependencies: string;
    openApiMetadata: string;
    oauth: string;
    dataManagementApi: string;
    xsdMetadata: string;
    changeQueries: string;
    composites: string;
  };
};

export type SbEnvironmentConfigPublic = {
  sbEnvironmentMetaArn: string;
  odsApiMeta?: OdsApiMeta;
  adminApiUrl: string;
  lastSuccessfulPull?: Date;
  adminApiVersion: SbaaAdminApiVersion; //Maybe it will be required in case we add DMS
  startingBlocks?: boolean;
} & (
  | {
      version: 'v1';
      values: ISbEnvironmentConfigPublicV1;
    }
  | {
      version: 'v2';
      values: ISbEnvironmentConfigPublicV2;
    }
  | {
      version: 'v3';
      values: ISbEnvironmentConfigPublicV3;
    }
  | {
      version?: undefined;
      values?: undefined;
    }
);

export interface ISbEnvironmentConfigPublicV3 {
  meta: SbV3MetaSaved;
  /** UUID to ensure different SBAA instances don't overwrite each others' creds in SB */
  adminApiUuid?: string;
  tenants?: Record<string, { adminApiKey?: string; allowedEdorgs?: number[] }>;
}
export interface ISbEnvironmentConfigPublicV2 {
  meta: SbV2MetaSaved;
  /** UUID to ensure different SBAA instances don't overwrite each others' creds in SB */
  adminApiUuid?: string;
  tenants?: Record<string, { adminApiKey?: string; allowedEdorgs?: number[] }>;
}
export interface ISbEnvironmentConfigPublicV1 {
  edfiHostname: string;
  adminApiUrl: string;
  adminApiKey: string;
  adminApiClientDisplayName: string;
}

export interface ISbEnvironmentConfigPrivateV1 {
  adminApiSecret: string;
}
export interface ISbEnvironmentConfigPrivateV2 {
  tenants?: Record<string, { adminApiSecret: string }>;
}
export type SbEnvironmentConfigPrivate =
  | ISbEnvironmentConfigPrivateV1
  | ISbEnvironmentConfigPrivateV2;

export interface ISbEnvironment extends IEntityBase {
  ownerships: IOwnership[];

  edfiTenants: IEdfiTenant[];

  integrationApps: IIntegrationApp[];

  envLabel: string | null;
  name: string;
  configPublic: SbEnvironmentConfigPublic | null;
  configPrivate: SbEnvironmentConfigPrivate | null;

  version: SbaaAdminApiVersion | undefined;
  domain: string | undefined;
  adminApiUrl: string | undefined;
  usableDomain: string | undefined;
  odsApiVersion: string | undefined;
  odsDsVersion: string | undefined;
  startingBlocks: boolean;
}
