import { Expose, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsNotEmpty,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { sanitizeForUrl, trimTrailingSlashes } from '@edanalytics/utils';
import { TrimWhitespace } from '../utils';
import { makeSerializer } from '../utils/make-serializer';
import {
  PostApiClientResponseDtoBase,
  PostApplicationDtoBase,
  PostApplicationFormBase,
  PostApplicationResponseDtoBase,
  PostVendorDto,
} from './edfi-admin-api.dto';

export class PostVendorDtoV3 extends PostVendorDto {}

export class GetVendorDtoV3 extends PostVendorDtoV3 {
  @Expose()
  @IsNumber()
  id: number;

  get displayName() {
    return this.company;
  }
}
export class PutVendorDtoV3 extends GetVendorDtoV3 {}
export const toGetVendorDtoV3 = makeSerializer(GetVendorDtoV3);

export class GetProfileDtoV3 {
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

export class PostProfileDtoV3 {
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

export class PutProfileDtoV3 extends PostProfileDtoV3 {
  id: number;
}

export const toGetProfileDtoV3 = makeSerializer(GetProfileDtoV3);

export class GetActionDtoV3 {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  uri: string;
}

export const toGetActionDtoV3 = makeSerializer(GetActionDtoV3);

export class GetApiClientDtoV3 {
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
  dataStoreIds: number[];

  get displayName() {
    return this.name;
  }

  static apiUrl(startingBlocks: boolean, domain: string, apiClientName: string, tenantName: string) {
    const url = new URL(domain);
    url.protocol = 'https:';
    if (startingBlocks)
    {
      const appName = sanitizeForUrl(apiClientName).slice(0, 40);
      const pathname = trimTrailingSlashes(url.pathname);

      url.pathname = `${pathname}/${tenantName}`;
      url.hostname = `${appName}.${url.hostname}`;
    }
    return url.toString();
  }
}

export class PostApiClientDtoV3 {
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
  applicationId: number;

  @Expose()
  @IsNumber(undefined, { each: true })
  @ArrayNotEmpty()
  dataStoreIds: number[];
}

export class PutApiClientDtoV3 {
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
  dataStoreIds: number[];
}

export class PostApiClientResponseDtoV3 extends PostApiClientResponseDtoBase {
  @Expose()
  id: number;
}

export class PostApiClientFormDtoV3 {
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
  applicationId: number;

  @Expose()
  @IsNumber()
  dataStoreId: number;
}

export class PutApiClientFormDtoV3 {
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
  dataStoreId: number;

  @Expose()
  @IsNumber()
  id: number;

  @Expose()
  @IsNumber()
  applicationId: number;
}

export const toGetApiClientDtoV3 = makeSerializer(GetApiClientDtoV3);

export const toPostApiClientResponseDtoV3 = makeSerializer(PostApiClientResponseDtoV3);

export class GetApplicationDtoV3 {
  @Expose()
  id: number;
  @Expose()
  applicationName: string;
  @Expose()
  vendorId: number;
  @Expose()
  claimSetName: string;
  @Expose()
  profileIds: GetProfileDtoV3['id'][];
  @Expose()
  educationOrganizationIds: number[];
  @Expose()
  dataStoreIds: number[];

  get displayName() {
    return this.applicationName;
  }

  static apiUrl(startingBlocks: boolean, domain: string, applicationName: string, tenantName: string) {
    const url = new URL(domain);
    url.protocol = 'https:';
    if (startingBlocks)
    {
      const appName = sanitizeForUrl(applicationName).slice(0, 40);
      const pathname = trimTrailingSlashes(url.pathname);

      url.pathname = `${pathname}/${tenantName}`;
      url.hostname = `${appName}.${url.hostname}`;
    }
    return url.toString();
  }
}

export const toGetApplicationDtoV3 = makeSerializer(GetApplicationDtoV3);
export class PostApplicationDtoV3 extends PostApplicationDtoBase {
  @Expose()
  @IsOptional()
  @IsNumber(undefined, { each: true })
  profileIds: number[];

  @Expose()
  @IsNumber(undefined, { each: true })
  educationOrganizationIds: number[];

  @Expose()
  @IsNumber()
  dataStoreIds: number[];

  @Expose()
  @IsNumber()
  integrationProviderId: number;
}
export class PutApplicationDtoV3 extends PostApplicationDtoV3 {}

export class PostApplicationFormDtoV3 extends PostApplicationFormBase {
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
  dataStoreId: number;

  @Expose()
  @IsNumber()
  @IsOptional()
  integrationProviderId?: number;
}

export class PutApplicationFormDtoV3 extends PostApplicationFormDtoV3 {
  id: number;
}

export class PostApplicationResponseDtoV3 extends PostApplicationResponseDtoBase {
  @Expose()
  id: number;
}

export const toPostApplicationResponseDtoV3 = makeSerializer(PostApplicationResponseDtoV3);

export class GetAuthStrategyDtoV3 {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  displayName: string;
}

export const toGetAuthStrategyDtoV3 = makeSerializer(GetAuthStrategyDtoV3);

export class GetClaimsetApplicationDtoV3 {
  @Expose()
  applicationName: string;
}

export class GetClaimsetMultipleDtoV3 {
  @Expose()
  id: number;

  // Wire field is `claimSetName` in V3 (verified live against a V3-enabled
  // Admin API — see 530-design.md); mapping it onto `name` here means every
  // consumer (displayName getter, CopyClaimset, NameCell) reads the same
  // property name regardless of version.
  @Expose({ name: 'claimSetName' })
  name: string;

  @Expose()
  _isSystemReserved: boolean;

  @Expose()
  @Type(() => GetClaimsetApplicationDtoV3)
  _applications: GetClaimsetApplicationDtoV3[];

  get applicationsCount() {
    return this._applications.length;
  }

  get displayName() {
    return this.name;
  }
}

// makeSerializer's default InputType is derived from the class shape itself
// (name: string), which no longer matches the wire shape now that `name` is
// populated from `claimSetName` via @Expose({ name: ... }). applicationsCount
// and displayName are getters computed from other fields and were never part
// of the wire payload either. Overriding InputType explicitly keeps the
// runtime rename working while the input type reflects what Admin API V3
// actually sends.
//
// Exported so callers building the raw HTTP request (e.g. axios generics in
// AdminApiServiceV3) can type the pre-transform response as what the wire
// actually sends, rather than incorrectly reusing the post-transform DTO.
export type ClaimsetMultipleWireDtoV3 = Omit<
  GetClaimsetMultipleDtoV3,
  'name' | 'applicationsCount' | 'displayName'
> & { claimSetName: string };

export const toGetClaimsetMultipleDtoV3 = makeSerializer<
  GetClaimsetMultipleDtoV3,
  ClaimsetMultipleWireDtoV3
>(GetClaimsetMultipleDtoV3);

export class GetClaimsetSingleDtoV3 extends GetClaimsetMultipleDtoV3 {
  @Expose()
  @Type(() => GetResourceClaimDtoV3)
  resourceClaims: GetResourceClaimDtoV3[];
}

export type ClaimsetSingleWireDtoV3 = Omit<
  GetClaimsetSingleDtoV3,
  'name' | 'applicationsCount' | 'displayName'
> & { claimSetName: string };

export const toGetClaimsetSingleDtoV3 = makeSerializer<
  GetClaimsetSingleDtoV3,
  ClaimsetSingleWireDtoV3
>(GetClaimsetSingleDtoV3);

export class ImportClaimsetSingleDtoV3 {
  @Expose()
  @TrimWhitespace()
  // Admin API V3 rejects any whitespace character in a claim set name (verified
  // live: inner space and inner tab both return 400 "Claim set name must not
  // contain white spaces."). Neither this nor the length cap is declared in
  // swagger, so both are mirrored here to fail before the API round-trip.
  // V2 has no whitespace rule — do not copy this to the V2 DTO.
  @IsNotEmpty()
  @Matches(/^\S*$/, { message: 'Name must not contain white spaces.' })
  @MaxLength(254)
  name: string;

  @Expose()
  @Type(() => ResourceClaimDtoV3)
  resourceClaims: ResourceClaimDtoV3[];
}
export const toImportClaimsetSingleDtoV3 = makeSerializer(ImportClaimsetSingleDtoV3);

export class ResourceClaimDtoV3 {
  @Expose()
  @TrimWhitespace()
  name: string;

  // Full claim URI (e.g. "http://ed-fi.org/identity/claims/ed-fi/school") —
  // V2 only ever put the short name in `name`. Resource claims are
  // identified by name/claimName in V3; there is no `id` field on the wire.
  @Expose()
  claimName: string;

  // V3 sends a flat resourceClaims list joined by parentClaimName instead of
  // V2's nested `children` array — null means a root/domain-level entry.
  @Expose()
  parentClaimName: string | null;

  @Expose()
  @Type(() => ClaimsetResourceClaimActionDtoV3)
  actions: ClaimsetResourceClaimActionDtoV3[];

  @Expose()
  @Type(() => ClaimsetActionAuthStrategyDtoV3)
  authorizationStrategyOverrides: ClaimsetActionAuthStrategyDtoV3[];
}

export class GetResourceClaimDtoV3 extends ResourceClaimDtoV3 {
  @Expose()
  @Type(() => ClaimsetActionAuthStrategyDtoV3)
  _defaultAuthorizationStrategies: ClaimsetActionAuthStrategyDtoV3[];
}
export class ClaimsetResourceClaimActionDtoV3 {
  @Expose()
  name: string;

  @Expose()
  enabled: boolean;
}

export class ClaimsetActionAuthStrategyDtoV3 {
  @Expose()
  actionName: string;

  @Expose()
  @Type(() => ClaimsetAuthStrategyDtoV3)
  authorizationStrategies: ClaimsetAuthStrategyDtoV3[];
}

export class ClaimsetAuthStrategyDtoV3 {
  @Expose()
  authStrategyName: string;
}

export class PutClaimsetDtoV3 {
  @Expose()
  @IsString()
  @MinLength(1)
  name: string;
}

export class PostClaimsetDtoV3 extends PutClaimsetDtoV3 {}

export class PutClaimsetFormDtoV3 extends PutClaimsetDtoV3 {
  id: number;
}

export class PutClaimsetResourceClaimActionsDtoV3 {
  @Expose()
  @Type(() => ClaimsetResourceClaimActionDtoV3)
  @ValidateNested({ each: true })
  resourceClaimActions: ClaimsetResourceClaimActionDtoV3[];
}

export class PostClaimsetResourceClaimActionsDtoV3 extends PutClaimsetResourceClaimActionsDtoV3 {
  @Expose()
  @IsNumber()
  resourceClaimId: number;
}

export class PostActionAuthStrategiesDtoV3 {
  @Expose()
  @IsNumber()
  actionName: number;

  @Expose()
  @IsString({ each: true })
  authorizationStrategies: string[];
}

export class CopyClaimsetDtoV3 {
  @Expose()
  @IsNumber()
  originalId: number;

  @Expose()
  @IsString()
  @TrimWhitespace()
  // See ImportClaimsetSingleDtoV3.name — same V3-only rules.
  @IsNotEmpty()
  @Matches(/^\S*$/, { message: 'Name must not contain white spaces.' })
  @MaxLength(254)
  name: string;
}

// Just calling out there's no need for the below. The UX wouldn't benefit from it. We let Admin API do the validation and just pass on whatever it says.
// export class ImportClaimsetDtoV3 {}

export class GetDataStoreSummaryDtoV3 {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  dataStoreType: string;
}

export const toGetDataStoreSummaryDtoV3 = makeSerializer(GetDataStoreSummaryDtoV3);

export class PostInstanceDtoV3 {
  @Expose()
  @IsString()
  @TrimWhitespace()
  name: string;

  @Expose()
  @IsString()
  @TrimWhitespace()
  databaseTemplate: string;
}

export class PostCreateDataStoreDtoV3 {
  @Expose()
  @IsString()
  @TrimWhitespace()
  name: string;

  @Expose()
  @IsString()
  @TrimWhitespace()
  dataStoreType: string;

  @Expose()
  @IsString()
  @TrimWhitespace()
  connectionString: string;
}

export class GetDataStoreDetailDtoV3 {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  dataStoreType: string;

  @Expose()
  @Type(() => GetDataStoreContextDtoV3)
  dataStoreContexts: GetDataStoreContextDtoV3[];

  @Expose()
  @Type(() => GetDataStoreDerivativeDtoV3)
  dataStoreDerivatives: GetDataStoreDerivativeDtoV3[];
}
export class PostDataStoreContextDtoV3 {
  @Expose()
  @IsNumber()
  dataStoreId: number;

  @Expose()
  @IsString()
  @TrimWhitespace()
  contextKey: string;

  @Expose()
  @IsString()
  @TrimWhitespace()
  contextValue: string;
}

export class PutDataStoreContextDtoV3 extends PostDataStoreContextDtoV3 {}

export class GetDataStoreContextDtoV3 extends PostDataStoreContextDtoV3 {
  @Expose()
  id: number;
}

export const toGetDataStoreContextDtoV3 = makeSerializer(GetDataStoreContextDtoV3);

export class DataStoreDerivativeDtoBase {
  @IsNumber()
  @Expose()
  dataStoreId: number;

  @IsString()
  @Expose()
  derivativeType: string;
}

export class GetDataStoreDerivativeDtoV3 extends DataStoreDerivativeDtoBase {
  @Expose()
  id: number;
}
export const toGetDataStoreDerivativeDtoV3 = makeSerializer(GetDataStoreDerivativeDtoV3);

export class PutDataStoreDerivativeDtoV3 extends DataStoreDerivativeDtoBase {
  @Expose()
  @IsString()
  @TrimWhitespace()
  connectionString: string;
}
export class PostDataStoreDerivativeDtoV3 extends PutDataStoreDerivativeDtoV3 {}
export class PutDataStoreDtoV3 extends PutDataStoreDerivativeDtoV3 {}
export class PostDataStoreDtoV3 extends PutDataStoreDerivativeDtoV3 {}

export const toGetDataStoreDetailDtoV3 = makeSerializer(GetDataStoreDetailDtoV3);

export class PutUpdateDataStoreDtoV3 {
  @Expose()
  @IsString()
  @TrimWhitespace()
  name: string;

  @Expose()
  @IsString()
  @TrimWhitespace()
  dataStoreType: string;

  @Expose()
  @IsString()
  @TrimWhitespace()
  connectionString: string;
}

export class GetApplicationAssignedToDataStoreDtoV3 {
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
  dataStoreId: number;
}

export const toGetApplicationAssignedToDataStoreDtoV3 = makeSerializer(
  GetApplicationAssignedToDataStoreDtoV3
);

export class PutUpdateDataStoreContextDtoV3 extends PostDataStoreContextDtoV3 {}

export class GetResourceClaimDetailDtoV3 {
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
  @Type(() => GetResourceClaimDetailDtoV3)
  children: GetResourceClaimDetailDtoV3[];
}

export const toGetResourceClaimDetailDtoV3 = makeSerializer(GetResourceClaimDetailDtoV3);
