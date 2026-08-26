import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';

export interface OdsTerminology {
  singular: string;
  plural: string;
  listTitle: string;
  createTitle: string;
}

export const useOdsTerminology = (): OdsTerminology => {
  const { sbEnvironment } = useTeamEdfiTenantNavContextLoaded();
  return sbEnvironment.version === 'v3'
    ? {
        singular: 'Data Store',
        plural: 'Data Stores',
        listTitle: 'Data Stores',
        createTitle: 'Create new Data Store',
      }
    : {
        singular: 'ODS',
        plural: "ODS's",
        listTitle: 'Operational Data Stores',
        createTitle: 'Create new ODS',
      };
};
