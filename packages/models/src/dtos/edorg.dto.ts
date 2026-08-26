import { Expose } from 'class-transformer';
import { EdorgType, EdorgTypeShort } from '../enums';
import { IEdorg } from '../interfaces/edorg.interface';
import { DtoGetBase, GetDto } from '../utils/get-base.dto';
import { makeSerializer } from '../utils/make-serializer';

export class GetEdorgDto
  extends DtoGetBase
  implements GetDto<IEdorg, 'ownerships' | 'ods' | 'parent' | 'children' | 'edfiTenant'>
{
  @Expose()
  sbEnvironmentId: number;

  @Expose()
  edfiTenantId: number;
  @Expose()
  odsId: number;
  @Expose()
  odsDbName: string;
  @Expose()
  odsInstanceId: number | null;

  @Expose()
  parentId?: number;

  @Expose()
  educationOrganizationId: number;
  @Expose()
  nameOfInstitution: string;
  @Expose()
  shortNameOfInstitution: string;
  @Expose()
  discriminator: EdorgType;

  get discriminatorShort() {
    return EdorgTypeShort[this.discriminator];
  }

  override get displayName() {
    return this.nameOfInstitution;
  }
}
export const toGetEdorgDto = makeSerializer<GetEdorgDto, IEdorg>(GetEdorgDto);

export class SyncEdOrgsResponseDto {
  @Expose()
  synced: number;

  @Expose()
  skipped: number;
}

