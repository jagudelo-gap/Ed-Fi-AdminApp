import { Expose, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsNotEmpty,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TrimWhitespace } from '../utils';
import { makeSerializer } from '../utils/make-serializer';
import {
  PostApiClientResponseDtoBase,
  PostApplicationDtoBase,
  PostApplicationFormBase,
  PostApplicationResponseDtoBase,
  PostVendorDto,
} from './edfi-admin-api.dto';

export class PostVendorDtoV2 extends PostVendorDto {}

export class GetVendorDtoV2 extends PostVendorDtoV2 {
  @Expose()
  @IsNumber()
  id: number;

  get displayName() {
    return this.company;
  }
}
export class PutVendorDtoV2 extends GetVendorDtoV2 {}
export const toGetVendorDtoV2 = makeSerializer(GetVendorDtoV2);

export class GetProfileDtoV2 {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  definition?: string | undefined;

  get displayName() {
    return this.name;
  }
}

export class PostProfileDtoV2 {
  @Expose()
  @IsNotEmpty()
  @TrimWhitespace()
  name: string;

  @Expose()
  @IsString()
  @IsNotEmpty()
  @TrimWhitespace()
  definition: string;
}

export class PutProfileDtoV2 extends PostProfileDtoV2 {
  id: number;
}

export const toGetProfileDtoV2 = makeSerializer(GetProfileDtoV2);

export class GetActionDtoV2 {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  uri: string;
}

export const toGetActionDtoV2 = makeSerializer(GetActionDtoV2);

export class GetApiClientDtoV2 {
  @Expose()
  id: number;
  @Expose()
  name: string;
  @Expose()
  key: string;
  @Expose()
  isApproved: boolean;
  @Expose()
  useSandbox: boolean;
  @Expose()
  sandboxType: number;
  @Expose()
  applicationId: number;
  @Expose()
  keyStatus: string;
  @Expose()
  odsInstanceIds: number[];

  get displayName() {
    return this.name;
  }
}

export class PostApiClientDtoV2 {
  @Expose()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name: string;

  @Expose()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  key: string;

  @Expose()
  @IsBoolean()
  isApproved: boolean;
}

export class PutApiClientDtoV2 {
  @Expose()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name: string;

  @Expose()
  @IsBoolean()
  isApproved: boolean;

  @Expose()
  @IsNumber()
  id: number;

  @Expose()
  @IsNumber()
  applicationId: number;

  @Expose()
  @IsNumber(undefined, { each: true })
  @ArrayNotEmpty()
  odsInstanceIds: number[];
}

export class PostApiClientResponseDtoV2 extends PostApiClientResponseDtoBase {
  @Expose()
  id: number;
}

export class PostApiClientFormDtoV2 {
  @Expose()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name: string;

  @Expose()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  key: string;

  @Expose()
  @IsBoolean()
  isApproved: boolean;
  
  @Expose()
  @IsNumber()
  odsInstanceId: number;
}

export class PutApiClientFormDtoV2 {
  @Expose()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name: string;

  @Expose()
  @IsBoolean()
  isApproved: boolean;

  @Expose()
  @IsNumber()
  odsInstanceId: number;

  @Expose()
  @IsNumber()
  id: number;

  @Expose()
  @IsNumber()
  applicationId: number;
}

export const toGetApiClientDtoV2 = makeSerializer(GetApiClientDtoV2);

export class GetApplicationDtoV2 {
  @Expose()
  id: number;
  @Expose()
  applicationName: string;
  @Expose()
  vendorId: number;
  @Expose()
  claimSetName: string;
  @Expose()
  profileIds: GetProfileDtoV2['id'][];
  @Expose()
  educationOrganizationIds: number[];
  @Expose()
  odsInstanceIds: number[];

  get displayName() {
    return this.applicationName;
  }

  static apiUrl(startingBlocks: boolean, domain: string, applicationName: string, tenantName: string) {
    const url = new URL(domain);
    url.protocol = 'https:';
    if (startingBlocks)
    {
      const safe = (str: string) =>
        str
          .toLowerCase()
          .replace(/\s/g, '-')
          .replace(/[^a-z0-9-]/g, '');

      const appName = safe(applicationName).slice(0, 40);
      url.pathname = url.pathname.replace(/\/+$/, '') + '/' + tenantName;
      url.hostname = `${appName}.${url.hostname}`;
    }
    return url.toString();
  }
}

export const toGetApplicationDtoV2 = makeSerializer(GetApplicationDtoV2);
export class PostApplicationDtoV2 extends PostApplicationDtoBase {
  @Expose()
  @IsOptional()
  @IsNumber(undefined, { each: true })
  profileIds: number[];

  @Expose()
  @IsNumber(undefined, { each: true })
  educationOrganizationIds: number[];

  @Expose()
  @IsNumber()
  odsInstanceIds: number[];

  @Expose()
  @IsNumber()
  integrationProviderId: number;
}
export class PutApplicationDtoV2 extends PostApplicationDtoV2 {}

export class PostApplicationFormDtoV2 extends PostApplicationFormBase {
  @Expose()
  @IsOptional()
  @IsNumber(undefined, { each: true })
  profileIds?: number[];

  @Expose()
  @IsNumber(undefined, { each: true })
  @ArrayNotEmpty()
  educationOrganizationIds: number[];

  @Expose()
  @IsNumber()
  odsInstanceId: number;

  @Expose()
  @IsNumber()
  @IsOptional()
  integrationProviderId?: number;
}

export class PutApplicationFormDtoV2 extends PostApplicationFormDtoV2 {
  id: number;
}

export class PostApplicationResponseDtoV2 extends PostApplicationResponseDtoBase {
  @Expose()
  id: number;
}

export const toPostApplicationResponseDtoV2 = makeSerializer(PostApplicationResponseDtoV2);

export class GetAuthStrategyDtoV2 {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  displayName: string;
}

export const toGetAuthStrategyDtoV2 = makeSerializer(GetAuthStrategyDtoV2);

export class GetClaimsetMultipleDtoV2 {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  _isSystemReserved: boolean;

  @Expose()
  _applications: GetApplicationDtoV2[];

  get applicationsCount() {
    return this._applications.length;
  }

  get displayName() {
    return this.name;
  }
}

export const toGetClaimsetMultipleDtoV2 = makeSerializer(GetClaimsetMultipleDtoV2);

export class GetClaimsetSingleDtoV2 extends GetClaimsetMultipleDtoV2 {
  @Expose()
  @Type(() => GetResourceClaimDtoV2)
  resourceClaims: GetResourceClaimDtoV2[];
}

export const toGetClaimsetSingleDtoV2 = makeSerializer(GetClaimsetSingleDtoV2);

export class ImportClaimsetSingleDtoV2 {
  @Expose()
  @TrimWhitespace()
  name: string;

  @Expose()
  @Type(() => ResourceClaimDtoV2)
  resourceClaims: ResourceClaimDtoV2[];
}
export const toImportClaimsetSingleDtoV2 = makeSerializer(ImportClaimsetSingleDtoV2);

export class ResourceClaimDtoV2 {
  @Expose()
  id: string;

  @Expose()
  @TrimWhitespace()
  name: string;

  @Expose()
  @Type(() => ClaimsetResourceClaimActionDtoV2)
  actions: ClaimsetResourceClaimActionDtoV2[];

  @Expose()
  @Type(() => ClaimsetActionAuthStrategyDtoV2)
  authorizationStrategyOverridesForCRUD: ClaimsetActionAuthStrategyDtoV2[];

  @Expose()
  @Type(() => GetResourceClaimDtoV2)
  children: GetResourceClaimDtoV2[];
}

export class GetResourceClaimDtoV2 extends ResourceClaimDtoV2 {
  @Expose()
  @Type(() => ClaimsetActionAuthStrategyDtoV2)
  _defaultAuthorizationStrategiesForCRUD: ClaimsetActionAuthStrategyDtoV2[];
}
export class ClaimsetResourceClaimActionDtoV2 {
  @Expose()
  name: string;

  @Expose()
  enabled: boolean;
}

export class ClaimsetActionAuthStrategyDtoV2 {
  @Expose()
  actionId: number;

  @Expose()
  actionName: string;

  @Expose()
  @Type(() => ClaimsetAuthStrategyDtoV2)
  authorizationStrategies: ClaimsetAuthStrategyDtoV2[];
}

export class ClaimsetAuthStrategyDtoV2 {
  @Expose()
  authStrategyId: number;

  @Expose()
  authStrategyName: string;

  @Expose()
  isInheritedFromParent: boolean;
}

export class PutClaimsetDtoV2 {
  @Expose()
  @IsString()
  @MinLength(1)
  name: string;
}

export class PostClaimsetDtoV2 extends PutClaimsetDtoV2 {}

export class PutClaimsetFormDtoV2 extends PutClaimsetDtoV2 {
  id: number;
}

export class PutClaimsetResourceClaimActionsDtoV2 {
  @Expose()
  @Type(() => ClaimsetResourceClaimActionDtoV2)
  @ValidateNested({ each: true })
  resourceClaimActions: ClaimsetResourceClaimActionDtoV2[];
}

export class PostClaimsetResourceClaimActionsDtoV2 extends PutClaimsetResourceClaimActionsDtoV2 {
  @Expose()
  @IsNumber()
  resourceClaimId: number;
}

export class PostActionAuthStrategiesDtoV2 {
  @Expose()
  @IsNumber()
  actionName: number;

  @Expose()
  @IsString({ each: true })
  authorizationStrategies: string[];
}

export class CopyClaimsetDtoV2 {
  @Expose()
  @IsNumber()
  originalId: number;

  @Expose()
  @IsString()
  @TrimWhitespace()
  name: string;
}

// Just calling out there's no need for the below. The UX wouldn't benefit from it. We let Admin API do the validation and just pass on whatever it says.
// export class ImportClaimsetDtoV2 {}

export class GetOdsInstanceSummaryDtoV2 {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  instanceType: string;
}

export const toGetOdsInstanceSummaryDtoV2 = makeSerializer(GetOdsInstanceSummaryDtoV2);

export class PostCreateOdsInstanceDtoV2 {
  @Expose()
  @IsString()
  @TrimWhitespace()
  name: string;

  @Expose()
  @IsString()
  @TrimWhitespace()
  instanceType: string;

  @Expose()
  @IsString()
  @TrimWhitespace()
  connectionString: string;
}

export class GetOdsInstanceDetailDtoV2 {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  instanceType: string;

  @Expose()
  @Type(() => GetOdsInstanceContextDtoV2)
  odsInstanceContexts: GetOdsInstanceContextDtoV2[];

  @Expose()
  @Type(() => GetOdsInstanceDerivativeDtoV2)
  odsInstanceDerivatives: GetOdsInstanceDerivativeDtoV2[];
}
export class PostOdsInstanceContextDtoV2 {
  @Expose()
  @IsNumber()
  odsInstanceId: number;

  @Expose()
  @IsString()
  @TrimWhitespace()
  contextKey: string;

  @Expose()
  @IsString()
  @TrimWhitespace()
  contextValue: string;
}

export class PutOdsInstanceContextDtoV2 extends PostOdsInstanceContextDtoV2 {}

export class GetOdsInstanceContextDtoV2 extends PostOdsInstanceContextDtoV2 {
  @Expose()
  id: number;
}

export const toGetOdsInstanceContextDtoV2 = makeSerializer(GetOdsInstanceContextDtoV2);

export class OdsInstanceDerivativeDtoBase {
  @IsNumber()
  @Expose()
  odsInstanceId: number;

  @IsString()
  @Expose()
  derivativeType: string;
}

export class GetOdsInstanceDerivativeDtoV2 extends OdsInstanceDerivativeDtoBase {
  @Expose()
  id: number;
}
export const toGetOdsInstanceDerivativeDtoV2 = makeSerializer(GetOdsInstanceDerivativeDtoV2);

export class PutOdsInstanceDerivativeDtoV2 extends OdsInstanceDerivativeDtoBase {
  @Expose()
  @IsString()
  @TrimWhitespace()
  connectionString: string;
}
export class PostOdsInstanceDerivativeDtoV2 extends PutOdsInstanceDerivativeDtoV2 {}
export class PutOdsInstanceDtoV2 extends PutOdsInstanceDerivativeDtoV2 {}
export class PostOdsInstanceDtoV2 extends PutOdsInstanceDerivativeDtoV2 {}

export const toGetOdsInstanceDetailDtoV2 = makeSerializer(GetOdsInstanceDetailDtoV2);

export class PutUpdateOdsInstanceDtoV2 {
  @Expose()
  @IsString()
  @TrimWhitespace()
  name: string;

  @Expose()
  @IsString()
  @TrimWhitespace()
  instanceType: string;

  @Expose()
  @IsString()
  @TrimWhitespace()
  connectionString: string;
}

export class GetApplicationAssignedToOdsInstanceDtoV2 {
  @Expose()
  id: number;

  @Expose()
  applicationName: string;

  @Expose()
  vendorId: number;

  @Expose()
  claimSetName: string;

  @Expose()
  profileIds: number[];

  @Expose()
  educationOrganizationIds: number[];

  @Expose()
  odsInstanceId: number;
}

export const toGetApplicationAssignedToOdsInstanceDtoV2 = makeSerializer(
  GetApplicationAssignedToOdsInstanceDtoV2
);

export class PutUpdateOdsInstanceContextDtoV2 extends PostOdsInstanceContextDtoV2 {}

export class GetResourceClaimDetailDtoV2 {
  @Expose()
  id: number;

  @Expose()
  @IsString()
  name: string;

  @Expose()
  parentId: number | null;

  @Expose()
  @IsString()
  parentName: string;

  @Expose()
  @Type(() => GetResourceClaimDetailDtoV2)
  children: GetResourceClaimDetailDtoV2[];
}

export const toGetResourceClaimDetailDtoV2 = makeSerializer(GetResourceClaimDetailDtoV2);
