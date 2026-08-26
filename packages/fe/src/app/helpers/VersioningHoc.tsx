import { SbaaAdminApiVersion } from '@edanalytics/models';
import type { ReactElement } from 'react';
import { useEdfiTenantNavContextLoaded } from './navContext';

export const VersioningHoc = (props: Partial<Record<SbaaAdminApiVersion, ReactElement>>) => {
  const { sbEnvironment } = useEdfiTenantNavContextLoaded();
  const adminApiVersion = sbEnvironment.configPublic?.version;
  const rightChild = adminApiVersion ? props[adminApiVersion] : undefined;
  return rightChild ?? null;
};
