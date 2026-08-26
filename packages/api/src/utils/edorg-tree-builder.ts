import { EducationOrganizationDto, EdorgType, SbV1MetaEdorg } from '@edanalytics/models';

/**
 * Build an EdOrg tree from flat list of EdOrgs with parentId references
 * Converts flat structure to nested tree structure expected by persistence layer
 *
 * @param edOrgs - Flat array of EdOrgs from Admin API
 * @returns Array of root EdOrg nodes with nested children
 *
 * @example
 * ```typescript
 * const flatEdOrgs = [
 *   { educationOrganizationId: 31, parentId: null, discriminator: 'edfi.StateEducationAgency', ... },
 *   { educationOrganizationId: 255901, parentId: 31, discriminator: 'edfi.LocalEducationAgency', ... },
 *   { educationOrganizationId: 255901107, parentId: 255901, discriminator: 'edfi.School', ... }
 * ];
 *
 * const tree = buildEdOrgTree(flatEdOrgs);
 * // Returns:
 * // [
 * //   {
 * //     educationorganizationid: 31,
 * //     discriminator: 'edfi.StateEducationAgency',
 * //     edorgs: [
 * //       {
 * //         educationorganizationid: 255901,
 * //         discriminator: 'edfi.LocalEducationAgency',
 * //         edorgs: [
 * //           {
 * //             educationorganizationid: 255901107,
 * //             discriminator: 'edfi.School',
 * //             edorgs: []
 * //           }
 * //         ]
 * //       }
 * //     ]
 * //   }
 * // ]
 * ```
 */
export function buildEdOrgTree(edOrgs: EducationOrganizationDto[]): SbV1MetaEdorg[] {
  // Create a map of all EdOrg nodes
  const edorgNodeMap = new Map<number, SbV1MetaEdorg>(
    edOrgs.map((e) => [
      e.educationOrganizationId,
      {
        educationorganizationid: e.educationOrganizationId,
        nameofinstitution: e.nameOfInstitution,
        shortnameofinstitution: e.shortNameOfInstitution ?? null,
        discriminator: e.discriminator as EdorgType,
        edorgs: [], // Will be populated with children
      },
    ])
  );

  // Build tree by nesting children under their parents
  const edorgRoots: SbV1MetaEdorg[] = [];
  for (const edOrg of edOrgs) {
    const node = edorgNodeMap.get(edOrg.educationOrganizationId);
    if (edOrg.parentId != null && edorgNodeMap.has(edOrg.parentId)) {
      // This EdOrg has a parent - add it as a child
      edorgNodeMap.get(edOrg.parentId).edorgs.push(node);
    } else {
      // This is a root EdOrg (no parent)
      edorgRoots.push(node);
    }
  }

  return edorgRoots;
}
