jest.mock('../../helpers', () => ({
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
}));

import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { createVersionedResource } from './versioned';

const mockUseNavContext = useTeamEdfiTenantNavContextLoaded as jest.Mock;

const setVersion = (version: 'v1' | 'v2' | 'v3' | undefined) => {
  mockUseNavContext.mockReturnValue({ edfiTenant: { sbEnvironment: { version } } });
};

type TestConfig = { version: 'v2'; label: string } | { version: 'v3'; label: string };

const v2Config: TestConfig = { version: 'v2', label: 'v2-resource' };
const v3Config: TestConfig = { version: 'v3', label: 'v3-resource' };

describe('createVersionedResource', () => {
  afterEach(() => jest.clearAllMocks());

  const useResource = createVersionedResource<TestConfig>({ v2: v2Config, v3: v3Config });

  it('returns the v2 resource when the tenant is on v2', () => {
    setVersion('v2');
    expect(useResource()).toBe(v2Config);
  });

  it('returns the v3 resource when the tenant is on v3', () => {
    setVersion('v3');
    expect(useResource()).toBe(v3Config);
  });

  it('throws when the resolved version has no mapped resource', () => {
    setVersion('v1');
    expect(() => useResource()).toThrow('No resource registered for admin API version "v1"');
  });

  it('throws when version is undefined', () => {
    setVersion(undefined);
    expect(() => useResource()).toThrow('No resource registered for admin API version "undefined"');
  });

  describe('.match()', () => {
    it('calls the v2 handler with the correctly-narrowed v2 config, not the v3 handler', () => {
      setVersion('v2');
      const v2Handler = jest.fn((cfg: Extract<TestConfig, { version: 'v2' }>) => cfg.label);
      const v3Handler = jest.fn();

      const result = useResource.match({ v2: v2Handler, v3: v3Handler });

      expect(v2Handler).toHaveBeenCalledWith(v2Config);
      expect(v3Handler).not.toHaveBeenCalled();
      expect(result).toBe('v2-resource');
    });

    it('calls the v3 handler with the correctly-narrowed v3 config, not the v2 handler', () => {
      setVersion('v3');
      const v2Handler = jest.fn();
      const v3Handler = jest.fn((cfg: Extract<TestConfig, { version: 'v3' }>) => cfg.label);

      const result = useResource.match({ v2: v2Handler, v3: v3Handler });

      expect(v3Handler).toHaveBeenCalledWith(v3Config);
      expect(v2Handler).not.toHaveBeenCalled();
      expect(result).toBe('v3-resource');
    });

    it('throws when the resolved version has no mapped resource', () => {
      setVersion('v1');
      expect(() =>
        // v1 has no handler in this test's Config, so match() itself would
        // reject it at compile time; cast to bypass that and exercise the
        // runtime failure path (createVersionedResource() throwing before
        // any handler is invoked).
        (useResource.match as (h: Record<string, (c: TestConfig) => unknown>) => unknown)({
          v2: jest.fn(),
          v3: jest.fn(),
        })
      ).toThrow('No resource registered for admin API version "v1"');
    });
  });
});
