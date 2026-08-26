import 'reflect-metadata';
import { useOdsTerminology } from './useOdsTerminology';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';

jest.mock('../../helpers', () => ({
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
}));

const mockNav = useTeamEdfiTenantNavContextLoaded as jest.Mock;

describe('useOdsTerminology', () => {
  it('returns Data Store labels for a v3 environment', () => {
    mockNav.mockReturnValue({ sbEnvironment: { version: 'v3' } });
    expect(useOdsTerminology()).toEqual({
      singular: 'Data Store',
      plural: 'Data Stores',
      listTitle: 'Data Stores',
      createTitle: 'Create new Data Store',
    });
  });

  it('returns ODS labels for a v2 environment', () => {
    mockNav.mockReturnValue({ sbEnvironment: { version: 'v2' } });
    expect(useOdsTerminology()).toEqual({
      singular: 'ODS',
      plural: "ODS's",
      listTitle: 'Operational Data Stores',
      createTitle: 'Create new ODS',
    });
  });

  it('returns ODS labels when version is undefined (v1/legacy)', () => {
    mockNav.mockReturnValue({ sbEnvironment: {} });
    expect(useOdsTerminology().singular).toBe('ODS');
  });
});
