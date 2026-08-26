import { Expose } from 'class-transformer';
import { SbV1MetaEdorg, SbV1MetaEnv } from './starting-blocks.v1.dto';
import { IsIn, IsNotEmpty, IsNumberString, IsString } from 'class-validator';
import { TrimWhitespace } from '../utils';
import { SbV2MetaEnv } from './starting-blocks.v2.dto';
export type SbV3MetaEdorg = SbV1MetaEdorg;

export interface SbV3MetaOds {
  /** odsInstanceId in Admin API */
  id: number;
  /** name in Dynamo DB */
  name: string;
  /** name of database in Postgres */
  dbname: string;
  edorgs?: SbV3MetaEdorg[];
}

export interface SbV3MetaTenant {
  name: string;
  allowedEdorgs: string[];
}

export interface SbV3TenantResourceTree {
  odss?: SbV3MetaOds[];
}

export interface SbV3MetaEnv {
  envlabel: string;
  mode: 'MultiTenant' | 'SingleTenant';
  domainName: string;
  adminApiUrl: string;
  tenantManagementFunctionArn: string;
  tenantResourceTreeFunctionArn: string;
  odsManagementFunctionArn: string;
  edorgManagementFunctionArn: string;
  dataFreshnessFunctionArn: string;
}

export type SbV3MetaSaved = Omit<SbV3MetaEnv, 'tenants' | 'envLabel'>;

export const isSbV3MetaEnv = (obj: SbV3MetaEnv | SbV2MetaEnv | SbV1MetaEnv): obj is SbV3MetaEnv =>
  'tenantManagementFunctionArn' in obj;

export class RemoveEdorgDtoV3 {
  @Expose()
  @IsString()
  @TrimWhitespace()
  ODSName: string;

  @Expose()
  @IsNumberString()
  EdOrgId: string;
}

export const edorgCategories = ['Local Education Agency', 'State Education Agency'];
export class AddEdorgDtoV3 {
  @Expose()
  @IsString()
  @TrimWhitespace()
  ODSName: string;

  @Expose()
  @IsString()
  @IsIn(edorgCategories)
  @TrimWhitespace()
  EdOrgCategory: string;

  @Expose()
  @IsNumberString()
  EdOrgId: string;

  @Expose()
  @IsString()
  @IsNotEmpty()
  @TrimWhitespace()
  NameOfInstitution: string;
}
