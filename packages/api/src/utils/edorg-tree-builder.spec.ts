import { buildEdOrgTree } from './edorg-tree-builder';
import { EducationOrganizationDto } from '@edanalytics/models';

describe('buildEdOrgTree', () => {
  it('should build a simple parent-child tree', () => {
    const flatEdOrgs: EducationOrganizationDto[] = [
      {
        educationOrganizationId: 31,
        nameOfInstitution: 'Grand Bend State',
        shortNameOfInstitution: null,
        discriminator: 'edfi.StateEducationAgency',
        parentId: null,
        instanceId: 1,
        instanceName: 'ODS One',
      },
      {
        educationOrganizationId: 255901,
        nameOfInstitution: 'Grand Bend ISD',
        shortNameOfInstitution: null,
        discriminator: 'edfi.LocalEducationAgency',
        parentId: 31,
        instanceId: 1,
        instanceName: 'ODS One',
      },
    ];

    const tree = buildEdOrgTree(flatEdOrgs);

    expect(tree).toHaveLength(1);
    expect(tree[0].educationorganizationid).toBe(31);
    expect(tree[0].nameofinstitution).toBe('Grand Bend State');
    expect(tree[0].discriminator).toBe('edfi.StateEducationAgency');
    expect(tree[0].edorgs).toHaveLength(1);
    expect(tree[0].edorgs[0].educationorganizationid).toBe(255901);
    expect(tree[0].edorgs[0].nameofinstitution).toBe('Grand Bend ISD');
  });

  it('should build a multi-level tree', () => {
    const flatEdOrgs: EducationOrganizationDto[] = [
      {
        educationOrganizationId: 31,
        nameOfInstitution: 'Grand Bend State',
        shortNameOfInstitution: null,
        discriminator: 'edfi.StateEducationAgency',
        parentId: null,
        instanceId: 1,
        instanceName: 'ODS One',
      },
      {
        educationOrganizationId: 255901,
        nameOfInstitution: 'Grand Bend ISD',
        shortNameOfInstitution: null,
        discriminator: 'edfi.LocalEducationAgency',
        parentId: 31,
        instanceId: 1,
        instanceName: 'ODS One',
      },
      {
        educationOrganizationId: 255901107,
        nameOfInstitution: 'Grand Bend High School',
        shortNameOfInstitution: null,
        discriminator: 'edfi.School',
        parentId: 255901,
        instanceId: 1,
        instanceName: 'ODS One',
      },
    ];

    const tree = buildEdOrgTree(flatEdOrgs);

    expect(tree).toHaveLength(1);
    expect(tree[0].educationorganizationid).toBe(31);
    expect(tree[0].edorgs).toHaveLength(1);
    expect(tree[0].edorgs[0].educationorganizationid).toBe(255901);
    expect(tree[0].edorgs[0].edorgs).toHaveLength(1);
    expect(tree[0].edorgs[0].edorgs[0].educationorganizationid).toBe(255901107);
    expect(tree[0].edorgs[0].edorgs[0].nameofinstitution).toBe('Grand Bend High School');
  });

  it('should handle multiple root nodes', () => {
    const flatEdOrgs: EducationOrganizationDto[] = [
      {
        educationOrganizationId: 31,
        nameOfInstitution: 'State One',
        shortNameOfInstitution: null,
        discriminator: 'edfi.StateEducationAgency',
        parentId: null,
        instanceId: 1,
        instanceName: 'ODS One',
      },
      {
        educationOrganizationId: 32,
        nameOfInstitution: 'State Two',
        shortNameOfInstitution: null,
        discriminator: 'edfi.StateEducationAgency',
        parentId: null,
        instanceId: 1,
        instanceName: 'ODS One',
      },
    ];

    const tree = buildEdOrgTree(flatEdOrgs);

    expect(tree).toHaveLength(2);
    expect(tree[0].educationorganizationid).toBe(31);
    expect(tree[1].educationorganizationid).toBe(32);
  });

  it('should handle siblings at the same level', () => {
    const flatEdOrgs: EducationOrganizationDto[] = [
      {
        educationOrganizationId: 31,
        nameOfInstitution: 'Grand Bend State',
        shortNameOfInstitution: null,
        discriminator: 'edfi.StateEducationAgency',
        parentId: null,
        instanceId: 1,
        instanceName: 'ODS One',
      },
      {
        educationOrganizationId: 255901,
        nameOfInstitution: 'Grand Bend ISD',
        shortNameOfInstitution: null,
        discriminator: 'edfi.LocalEducationAgency',
        parentId: 31,
        instanceId: 1,
        instanceName: 'ODS One',
      },
      {
        educationOrganizationId: 255902,
        nameOfInstitution: 'Another ISD',
        shortNameOfInstitution: null,
        discriminator: 'edfi.LocalEducationAgency',
        parentId: 31,
        instanceId: 1,
        instanceName: 'ODS One',
      },
    ];

    const tree = buildEdOrgTree(flatEdOrgs);

    expect(tree).toHaveLength(1);
    expect(tree[0].edorgs).toHaveLength(2);
    expect(tree[0].edorgs[0].educationorganizationid).toBe(255901);
    expect(tree[0].edorgs[1].educationorganizationid).toBe(255902);
  });

  it('should handle empty array', () => {
    const tree = buildEdOrgTree([]);

    expect(tree).toEqual([]);
  });

  it('should handle orphaned nodes (parent not in list)', () => {
    const flatEdOrgs: EducationOrganizationDto[] = [
      {
        educationOrganizationId: 255901,
        nameOfInstitution: 'Grand Bend ISD',
        shortNameOfInstitution: null,
        discriminator: 'edfi.LocalEducationAgency',
        parentId: 999, // Parent doesn't exist
        instanceId: 1,
        instanceName: 'ODS One',
      },
    ];

    const tree = buildEdOrgTree(flatEdOrgs);

    // Orphaned node should become a root
    expect(tree).toHaveLength(1);
    expect(tree[0].educationorganizationid).toBe(255901);
  });

  it('should preserve shortNameOfInstitution when present', () => {
    const flatEdOrgs: EducationOrganizationDto[] = [
      {
        educationOrganizationId: 31,
        nameOfInstitution: 'Grand Bend State',
        shortNameOfInstitution: 'GBS',
        discriminator: 'edfi.StateEducationAgency',
        parentId: null,
        instanceId: 1,
        instanceName: 'ODS One',
      },
    ];

    const tree = buildEdOrgTree(flatEdOrgs);

    expect(tree[0].shortnameofinstitution).toBe('GBS');
  });

  it('should set shortNameOfInstitution to null when not present', () => {
    const flatEdOrgs: EducationOrganizationDto[] = [
      {
        educationOrganizationId: 31,
        nameOfInstitution: 'Grand Bend State',
        shortNameOfInstitution: null,
        discriminator: 'edfi.StateEducationAgency',
        parentId: null,
        instanceId: 1,
        instanceName: 'ODS One',
      },
    ];

    const tree = buildEdOrgTree(flatEdOrgs);

    expect(tree[0].shortnameofinstitution).toBeNull();
  });
});
