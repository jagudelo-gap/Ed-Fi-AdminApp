import 'reflect-metadata';
import { validate } from 'class-validator';
import {
  CopyClaimsetDtoV3,
  GetApiClientDtoV3,
  GetClaimsetMultipleDtoV3,
  GetClaimsetSingleDtoV3,
  GetDataStoreDetailDtoV3,
  GetDataStoreSummaryDtoV3,
  ImportClaimsetSingleDtoV3,
  PostInstanceDtoV3,
  toGetApiClientDtoV3,
  toGetClaimsetMultipleDtoV3,
  toGetClaimsetSingleDtoV3,
  toGetDataStoreDetailDtoV3,
  toGetDataStoreSummaryDtoV3,
} from './edfi-admin-api.v3.dto';

describe('edfi-admin-api.v3.dto', () => {
  it('serializes GetDataStoreSummaryDtoV3 using dataStoreType (not instanceType)', () => {
    const raw = { id: 1, name: 'Ods1', dataStoreType: 'Ods' };
    const result = toGetDataStoreSummaryDtoV3(raw);

    expect(result).toBeInstanceOf(GetDataStoreSummaryDtoV3);
    expect(result.dataStoreType).toBe('Ods');
  });

  it('serializes GetApiClientDtoV3 using dataStoreIds (not odsInstanceIds)', () => {
    const raw = {
      id: 1,
      name: 'client',
      key: 'key',
      isApproved: true,
      useSandbox: false,
      sandboxType: 0,
      applicationId: 2,
      keyStatus: 'Active',
      dataStoreIds: [10, 20],
    };
    const result = toGetApiClientDtoV3(raw);

    expect(result).toBeInstanceOf(GetApiClientDtoV3);
    expect(result.dataStoreIds).toEqual([10, 20]);
    expect(result.displayName).toBe('client');
  });

  it('serializes nested GetDataStoreDetailDtoV3 contexts/derivatives under renamed keys', () => {
    const raw = {
      id: 1,
      name: 'Ods1',
      dataStoreType: 'Ods',
      dataStoreContexts: [{ id: 5, dataStoreId: 1, contextKey: 'k', contextValue: 'v' }],
      dataStoreDerivatives: [{ id: 6, dataStoreId: 1, derivativeType: 'ReadReplica' }],
    };
    const result = toGetDataStoreDetailDtoV3(raw);

    expect(result).toBeInstanceOf(GetDataStoreDetailDtoV3);
    expect(result.dataStoreContexts[0].dataStoreId).toBe(1);
    expect(result.dataStoreDerivatives[0].derivativeType).toBe('ReadReplica');
  });

  it('serializes GetClaimsetMultipleDtoV3 using claimSetName (not name) from the wire', () => {
    const raw = {
      id: 1,
      claimSetName: 'SIS Vendor',
      _isSystemReserved: true,
      _applications: [{ applicationName: 'Test Application' }],
    };
    const result = toGetClaimsetMultipleDtoV3(raw);

    expect(result).toBeInstanceOf(GetClaimsetMultipleDtoV3);
    expect(result.name).toBe('SIS Vendor');
    expect(result.displayName).toBe('SIS Vendor');
    expect(result.applicationsCount).toBe(1);
  });

  it('serializes GetClaimsetSingleDtoV3 resourceClaims as a flat list with claimName/parentClaimName', () => {
    const raw = {
      id: 1,
      claimSetName: 'SIS Vendor',
      _isSystemReserved: true,
      _applications: [],
      resourceClaims: [
        {
          name: 'managedDescriptors',
          claimName: 'http://ed-fi.org/ods/identity/claims/domains/managedDescriptors',
          parentClaimName: null,
          actions: [{ name: 'Create', enabled: true }],
          _defaultAuthorizationStrategies: [
            { actionName: 'Create', authorizationStrategies: [{ authStrategyName: 'NamespaceBased' }] },
          ],
          authorizationStrategyOverrides: [],
        },
        {
          name: 'school',
          claimName: 'http://ed-fi.org/identity/claims/ed-fi/school',
          parentClaimName: 'http://ed-fi.org/ods/identity/claims/domains/managedDescriptors',
          actions: [{ name: 'Read', enabled: true }],
          _defaultAuthorizationStrategies: [],
          authorizationStrategyOverrides: [
            { actionName: 'Read', authorizationStrategies: [{ authStrategyName: 'NoFurtherAuthorizationRequired' }] },
          ],
        },
      ],
    };
    const result = toGetClaimsetSingleDtoV3(raw);

    expect(result).toBeInstanceOf(GetClaimsetSingleDtoV3);
    expect(result.resourceClaims).toHaveLength(2);
    expect(result.resourceClaims[0].claimName).toBe(
      'http://ed-fi.org/ods/identity/claims/domains/managedDescriptors'
    );
    expect(result.resourceClaims[1].parentClaimName).toBe(
      'http://ed-fi.org/ods/identity/claims/domains/managedDescriptors'
    );
    expect(result.resourceClaims[1].authorizationStrategyOverrides[0].authorizationStrategies[0].authStrategyName).toBe(
      'NoFurtherAuthorizationRequired'
    );
    // Fields removed in V3 must not survive serialization onto the instance.
    expect((result.resourceClaims[0] as unknown as { id?: unknown }).id).toBeUndefined();
    expect((result.resourceClaims[0] as unknown as { children?: unknown }).children).toBeUndefined();
  });
});

describe('PostInstanceDtoV3', () => {
  it('requires name and databaseTemplate', async () => {
    const dto = new PostInstanceDtoV3();
    const result = await validate(dto);
    const fieldsWithErrors = result.map((error) => error.property);

    expect(fieldsWithErrors).toContain('name');
    expect(fieldsWithErrors).toContain('databaseTemplate');
  });

  it('accepts name and databaseTemplate', async () => {
    const dto = Object.assign(new PostInstanceDtoV3(), {
      name: 'My DB Instance',
      databaseTemplate: 'Minimal',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});

describe('V3 claim set name validation', () => {
  const namesOf = async (dto: object) => (await validate(dto)).map((e) => e.property);

  describe('CopyClaimsetDtoV3', () => {
    const make = (name: string) =>
      Object.assign(new CopyClaimsetDtoV3(), { originalId: 1, name });

    it('rejects a name containing an inner space', async () => {
      expect(await namesOf(make('AB Connect'))).toContain('name');
    });

    it('rejects a name containing an inner tab', async () => {
      expect(await namesOf(make('AB\tConnect'))).toContain('name');
    });

    it('accepts a whitespace-free name with punctuation', async () => {
      expect(await namesOf(make('Dash-Under_Dot.Ok'))).not.toContain('name');
    });

    it('rejects a name of 300 characters', async () => {
      expect(await namesOf(make('A'.repeat(300)))).toContain('name');
    });

    it('accepts a 254-character name', async () => {
      expect(await namesOf(make('A'.repeat(254)))).not.toContain('name');
    });

    it('rejects an empty name', async () => {
      expect(await namesOf(make(''))).toContain('name');
    });

    it('rejects an empty name with an isNotEmpty constraint, not just the whitespace matches rule', async () => {
      const errors = await validate(make(''));
      const nameError = errors.find((e) => e.property === 'name');

      expect(nameError?.constraints).toHaveProperty('isNotEmpty');
    });

    it('rejects a whitespace-only name', async () => {
      expect(await namesOf(make('   '))).toContain('name');
    });
  });

  describe('ImportClaimsetSingleDtoV3', () => {
    const make = (name: string) =>
      Object.assign(new ImportClaimsetSingleDtoV3(), { name, resourceClaims: [] });

    it('rejects a name containing an inner space', async () => {
      expect(await namesOf(make('AB Connect'))).toContain('name');
    });

    it('rejects a name containing an inner tab', async () => {
      expect(await namesOf(make('AB\tConnect'))).toContain('name');
    });

    it('accepts a whitespace-free name', async () => {
      expect(await namesOf(make('ABConnect'))).not.toContain('name');
    });

    it('rejects a name of 300 characters', async () => {
      expect(await namesOf(make('A'.repeat(300)))).toContain('name');
    });

    it('rejects an empty name', async () => {
      expect(await namesOf(make(''))).toContain('name');
    });

    it('rejects an empty name with an isNotEmpty constraint, not just the whitespace matches rule', async () => {
      const errors = await validate(make(''));
      const nameError = errors.find((e) => e.property === 'name');

      expect(nameError?.constraints).toHaveProperty('isNotEmpty');
    });

    it('rejects a whitespace-only name', async () => {
      expect(await namesOf(make('   '))).toContain('name');
    });
  });
});
