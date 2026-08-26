import { Expose } from 'class-transformer';
import { IsNotIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { TrimWhitespace } from '../utils';
import { IEdfiTenant } from '../interfaces/edfi-tenant.interface';
import { DtoGetBase, GetDto } from '../utils/get-base.dto';
import { makeSerializer } from '../utils/make-serializer';
import { DtoPostBase, PostDto } from '../utils/post-base.dto';
import { GetSbEnvironmentDto } from './sb-environment.dto';

export class GetEdfiTenantDto
  extends DtoGetBase
  implements
    GetDto<
      IEdfiTenant,
      'ownerships' | 'odss' | 'edorgs' | 'configPrivate' | 'sbEnvironment' | 'integrationApps'
    >
{
  @Expose()
  name: string;

  @Expose()
  sbEnvironmentId: number;

  @Expose()
  sbEnvironment: GetSbEnvironmentDto;

  override get displayName() {
    return this.name;
  }
}
export const toGetEdfiTenantDto = makeSerializer<GetEdfiTenantDto, IEdfiTenant>(GetEdfiTenantDto);

export class PostEdfiTenantDto
  extends DtoPostBase
  implements
    PostDto<
      IEdfiTenant,
      | 'ownerships'
      | 'envLabel'
      | 'odss'
      | 'edorgs'
      | 'configPrivate'
      | 'configPublic'
      | 'sbEnvironment'
      | 'sbEnvironmentId'
      | 'integrationApps'
    >
{
  @Expose()
  @MinLength(3)
  @MaxLength(29)
  @Matches(/^[a-z0-9]+$/, { message: 'Name must only contain numbers and lowercase letters.' })
  @IsNotIn(['default', 'template'], { message: 'Name cannot be "default" or "template".' })
  @TrimWhitespace()
  name: string;

  @Expose()
  @IsOptional()
  @Matches(/^[\s,]*\d+(?:[\s,]+\d+)*[\s,]*$/, {
    message: 'Allowed Ed-Orgs must be a list of comma-separated numbers.',
  })
  allowedEdorgs?: string;
}

export class PutEdfiTenantAdminApiRegister {
  modifiedById?: number | undefined;
  id: number;

  @IsString()
  @Expose()
  @TrimWhitespace()
  adminRegisterUrl?: string;
}
export class PutEdfiTenantAdminApi {
  modifiedById?: number | undefined;
  id: number;

  @IsString()
  @IsOptional()
  @Expose()
  @TrimWhitespace()
  url?: string;

  @IsString()
  @IsOptional()
  @Expose()
  @TrimWhitespace()
  adminKey?: string;

  @IsString()
  @IsOptional()
  @Expose()
  @TrimWhitespace()
  adminSecret?: string;
}
