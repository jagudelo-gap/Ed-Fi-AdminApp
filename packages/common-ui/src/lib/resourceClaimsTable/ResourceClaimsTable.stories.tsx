import { Meta } from '@storybook/react-vite';
import { ResourceClaimsTable } from '.';
import { GetClaimsetDto } from '@edanalytics/models';
import { DeepPartial } from '@chakra-ui/react';

const meta: Meta<typeof ResourceClaimsTable> = {
  title: 'ResourceClaimsTable',
  component: ResourceClaimsTable,
};
export default meta;

const exampleClaimset = Object.assign(new GetClaimsetDto(), {
  id: 14,
  name: 'Education Preparation Program',
  resourceClaims: [
    {
      name: 'systemDescriptors',
      read: true,
      create: false,
      update: false,
      delete: false,
      defaultAuthStrategiesForCRUD: [
        { authStrategyName: 'NamespaceBased', isInheritedFromParent: false },
        { authStrategyName: 'NoFurtherAuthorizationRequired', isInheritedFromParent: false },
        { authStrategyName: 'NamespaceBased', isInheritedFromParent: false },
        { authStrategyName: 'NamespaceBased', isInheritedFromParent: false },
      ],
      authStrategyOverridesForCRUD: [null, null, null, null],
      children: [],
    },
    {
      name: 'educationOrganizations',
      read: true,
      create: true,
      update: true,
      delete: true,
      defaultAuthStrategiesForCRUD: [
        { authStrategyName: 'NoFurtherAuthorizationRequired', isInheritedFromParent: false },
        { authStrategyName: 'NoFurtherAuthorizationRequired', isInheritedFromParent: false },
        { authStrategyName: 'NoFurtherAuthorizationRequired', isInheritedFromParent: false },
        { authStrategyName: 'NoFurtherAuthorizationRequired', isInheritedFromParent: false },
      ],
      authStrategyOverridesForCRUD: [null, null, null, null],
      children: [],
    },
    {
      name: 'surveyDomain',
      read: true,
      create: true,
      update: true,
      delete: true,
      defaultAuthStrategiesForCRUD: [
        { authStrategyName: 'NamespaceBased', isInheritedFromParent: false },
        { authStrategyName: 'NamespaceBased', isInheritedFromParent: false },
        { authStrategyName: 'NamespaceBased', isInheritedFromParent: false },
        { authStrategyName: 'NamespaceBased', isInheritedFromParent: false },
      ],
      authStrategyOverridesForCRUD: [
        { authStrategyName: 'NoFurtherAuthorizationRequired', isInheritedFromParent: false },
        { authStrategyName: 'NoFurtherAuthorizationRequired', isInheritedFromParent: false },
        { authStrategyName: 'NoFurtherAuthorizationRequired', isInheritedFromParent: false },
        { authStrategyName: 'NoFurtherAuthorizationRequired', isInheritedFromParent: false },
      ],
      children: [
        {
          name: 'credential',
          read: true,
          create: true,
          update: true,
          delete: true,
          defaultAuthStrategiesForCRUD: [
            { authStrategyName: 'NoFurtherAuthorizationRequired', isInheritedFromParent: true },
            { authStrategyName: 'NoFurtherAuthorizationRequired', isInheritedFromParent: true },
            { authStrategyName: 'NoFurtherAuthorizationRequired', isInheritedFromParent: true },
            { authStrategyName: 'NoFurtherAuthorizationRequired', isInheritedFromParent: true },
          ],
          authStrategyOverridesForCRUD: [null, null, null, null],
          children: [],
        },
        {
          name: 'person',
          read: true,
          create: true,
          update: true,
          delete: true,
          defaultAuthStrategiesForCRUD: [
            { authStrategyName: 'NoFurtherAuthorizationRequired', isInheritedFromParent: true },
            { authStrategyName: 'NoFurtherAuthorizationRequired', isInheritedFromParent: true },
            { authStrategyName: 'NoFurtherAuthorizationRequired', isInheritedFromParent: true },
            { authStrategyName: 'NoFurtherAuthorizationRequired', isInheritedFromParent: true },
          ],
          authStrategyOverridesForCRUD: [null, null, null, null],
          children: [
            {
              name: 'candidatePreparation',
              read: true,
              create: true,
              update: true,
              delete: true,
              defaultAuthStrategiesForCRUD: [
                { authStrategyName: null, isInheritedFromParent: false },
                { authStrategyName: null, isInheritedFromParent: false },
                { authStrategyName: null, isInheritedFromParent: false },
                { authStrategyName: null, isInheritedFromParent: false },
              ],
              authStrategyOverridesForCRUD: [null, null, null, null],
              children: [],
            },
            {
              name: 'educatorPreparationProgram',
              read: true,
              create: true,
              update: true,
              delete: true,
              defaultAuthStrategiesForCRUD: [
                { authStrategyName: 'RelationshipsWithEdOrgsOnly', isInheritedFromParent: false },
                { authStrategyName: 'RelationshipsWithEdOrgsOnly', isInheritedFromParent: false },
                { authStrategyName: 'RelationshipsWithEdOrgsOnly', isInheritedFromParent: false },
                { authStrategyName: 'RelationshipsWithEdOrgsOnly', isInheritedFromParent: false },
              ],
              authStrategyOverridesForCRUD: [null, null, null, null],
              children: [],
            },
          ],
        },
        {
          name: 'student',
          read: true,
          create: true,
          update: true,
          delete: true,
          defaultAuthStrategiesForCRUD: [
            { authStrategyName: 'NoFurtherAuthorizationRequired', isInheritedFromParent: true },
            { authStrategyName: 'RelationshipsWithEdOrgsAndPeople', isInheritedFromParent: false },
            { authStrategyName: 'RelationshipsWithEdOrgsAndPeople', isInheritedFromParent: false },
            { authStrategyName: 'NoFurtherAuthorizationRequired', isInheritedFromParent: true },
          ],
          authStrategyOverridesForCRUD: [null, null, null, null],
          children: [],
        },
      ],
    },
    {
      name: 'performanceEvaluation',
      read: true,
      create: true,
      update: true,
      delete: true,
      defaultAuthStrategiesForCRUD: [
        { authStrategyName: 'RelationshipsWithEdOrgsOnly', isInheritedFromParent: false },
        { authStrategyName: 'RelationshipsWithEdOrgsOnly', isInheritedFromParent: false },
        { authStrategyName: 'RelationshipsWithEdOrgsOnly', isInheritedFromParent: false },
        { authStrategyName: 'RelationshipsWithEdOrgsOnly', isInheritedFromParent: false },
      ],
      authStrategyOverridesForCRUD: [null, null, null, null],
      children: [
        {
          name: 'studentSchoolAssociation',
          read: true,
          create: true,
          update: true,
          delete: true,
          defaultAuthStrategiesForCRUD: [
            { authStrategyName: 'RelationshipsWithEdOrgsOnly', isInheritedFromParent: true },
            { authStrategyName: 'RelationshipsWithEdOrgsAndPeople', isInheritedFromParent: true },
            { authStrategyName: 'RelationshipsWithEdOrgsAndPeople', isInheritedFromParent: true },
            { authStrategyName: 'RelationshipsWithEdOrgsAndPeople', isInheritedFromParent: true },
          ],
          authStrategyOverridesForCRUD: [null, null, null, null],
          children: [],
        },
      ],
    },
    {
      name: 'candidate',
      read: true,
      create: true,
      update: true,
      delete: true,
      defaultAuthStrategiesForCRUD: [
        { authStrategyName: 'NoFurtherAuthorizationRequired', isInheritedFromParent: false },
        { authStrategyName: 'NoFurtherAuthorizationRequired', isInheritedFromParent: false },
        { authStrategyName: 'NoFurtherAuthorizationRequired', isInheritedFromParent: false },
        { authStrategyName: 'NoFurtherAuthorizationRequired', isInheritedFromParent: false },
      ],
      authStrategyOverridesForCRUD: [null, null, null, null],
      children: [],
    },
  ],
  isSystemReserved: true,
  applicationsCount: 0,
} as DeepPartial<GetClaimsetDto>);

export const Default = () => <ResourceClaimsTable claimset={exampleClaimset} />;
