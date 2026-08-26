import { EdorgType } from '../enums';

export interface SbV1MetaEdorg {
  educationorganizationid: number;
  nameofinstitution: string;
  shortnameofinstitution: string | null;
  discriminator: EdorgType;
  edorgs?: SbV1MetaEdorg[];
}
export interface SbV1MetaOds {
  /** odsInstanceId from Admin API — present for non-SB V1 (form-driven); absent for SB V1 Lambda responses */
  id?: number | null;
  /** Human-readable ODS name — present for non-SB V1 (form-driven); absent for SB V1 Lambda responses */
  name?: string | null;
  dbname: string;
  edorgs?: SbV1MetaEdorg[];
}
export interface SbV1MetaEnv {
  envlabel: string;
  mode: string;
  domainName: string;
  odss?: SbV1MetaOds[];
}
