import {
  AreaCatalog,
  CatalogVersion,
  CertificationOdsApi,
  CertificationProcess,
  CertificationProcessScenario,
  EdfiTenant,
  Edorg,
  EnvNav,
  IntegrationApp,
  IntegrationAppDetailed,
  IntegrationProvider,
  Ods,
  Oidc,
  Ownership,
  OwnershipView,
  Role,
  SbEnvironment,
  SbSyncQueue,
  ScenarioCatalog,
  ScenarioStep,
  ScenarioStepError,
  StepCatalog,
  StepParameterCatalog,
  Team,
  User,
  UserTeamMembership,
} from '@edanalytics/models-server';

import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { SqlServerConnectionOptions } from 'typeorm/driver/sqlserver/SqlServerConnectionOptions';
import * as config from 'config';
import { asBool } from '../utils';

// PostgreSQL migrations
import { Initial1688158300508 as PgsqlInitial1688158300508 } from './migrations/pgsql/1687190483471-initial';
import { SbeConfigReorg1687190483472 as PgsqlSbeConfigReorg1687190483472 } from './migrations/pgsql/1687190483472-sbe-config-reorg';
import { AdOdsNaturalKeyToEdorg1687466013005 as PgsqlAdOdsNaturalKeyToEdorg1687466013005 } from './migrations/pgsql/1687466013005-add-ods-natural-key-to-edorg';
import { EducationOrganizationIdToNumber1687881668666 as PgsqlEducationOrganizationIdToNumber1687881668666 } from './migrations/pgsql/1687881668666-educationOrganizationIdToNumber';
import { UniqueOwnershipConstraints1687900131470 as PgsqlUniqueOwnershipConstraints1687900131470 } from './migrations/pgsql/1687900131470-uniqueOwnershipConstraints';
import { EdorgShortname1689282856860 as PgsqlEdorgShortname1689282856860 } from './migrations/pgsql/1689282856860-edorg-shortname';
import { OwnershipUniquenessSoftdelete1691010443030 as PgsqlOwnershipUniquenessSoftdelete1691010443030 } from './migrations/pgsql/1691010443030-ownershipUniquenessSoftdelete';
import { AbandonSoftDeletion1691520653756 as PgsqlAbandonSoftDeletion1691520653756 } from './migrations/pgsql/1691520653756-abandonSoftDeletion';
import { GuaranteeMembershipUniqueness1691694310950 as PgsqlGuaranteeMembershipUniqueness1691694310950 } from './migrations/pgsql/1691694310950-guaranteeMembershipUniqueness';
import { AddSeparateSbeNameField1692280869502 as PgsqlAddSeparateSbeNameField1692280869502 } from './migrations/pgsql/1692280869502-AddSeparateSbeNameField';
import { NewSbSyncQueue1692740626759 as PgsqlNewSbSyncQueue1692740626759 } from './migrations/pgsql/1692740626759-NewSbSyncQueue';
import { NullableEnvlabel1693335908870 as PgsqlNullableEnvlabel1693335908870 } from './migrations/pgsql/1693335908870-NullableEnvlabel';
import { FkOnDeleteTweaks1693514948085 as PgsqlFkOnDeleteTweaks1693514948085 } from './migrations/pgsql/1693514948085-fkOnDeleteTweaks';
import { FkOnDeleteFix1694446892889 as PgsqlFkOnDeleteFix1694446892889 } from './migrations/pgsql/1694446892889-FkOnDeleteFix';
import { LowercaseUniqueUsernames1697054661848 as PgsqlLowercaseUniqueUsernames1697054661848 } from './migrations/pgsql/1697054661848-LowercaseUniqueUsernames';
import { Seeding1697203599392 as PgsqlSeeding1697203599392 } from './migrations/pgsql/1697203599392-Seeding';
import { RemoveRemainingAppLauncherThings1697207080973 as PgsqlRemoveRemainingAppLauncherThings1697207080973 } from './migrations/pgsql/1697207080973-RemoveRemainingAppLauncherThings';
import { V7Changes1709328882890 as PgsqlV7Changes1709328882890 } from './migrations/pgsql/1709328882890-v7-changes';
import { EnvNav1710178189458 as PgsqlEnvNav1710178189458 } from './migrations/pgsql/1710178189458-EnvNav';
import { OdsInstanceName1710454017707 as PgsqlOdsInstanceName1710454017707 } from './migrations/pgsql/1710454017707-OdsInstanceName';
import { RemoveImpliedPrivilege1714074225483 as PgsqlRemoveImpliedPrivilege1714074225483 } from './migrations/pgsql/1714074225483-RemoveImpliedPrivilege';
import { BigIntEdOrg1717166915117 as PgsqlBigIntEdOrg1717166915117 } from './migrations/pgsql/1717166915117-BigIntEdOrgId';
import { AddProfilePrivileges1719427712090 as PgsqlAddProfilePrivileges1719427712090 } from './migrations/pgsql/1719427712090-AddProfilePrivileges';
import { AddNameOfInstitutionToOwnershipView1725479500715 as PgsqlAddNameOfInstitutionToOwnershipView1725479500715 } from './migrations/pgsql/1725479500715-AddNameOfInstitutionToOwnershipView';
import { AddMachineUserColumns1742186909224 as PgsqlAddMachineUserColumns1742186909224 } from './migrations/pgsql/1742891918530-AddMachineUserColumns';
import { IntegrationProviders1744127024224 as PgsqlIntegrationProviders1744127024224 } from './migrations/pgsql/1744127024224-IntegrationProviders';
import { AddIntegrationProviderToOwnership1744919046622 as PgsqlAddIntegrationProviderToOwnership1744919046622 } from './migrations/pgsql/1744919046622-AddIntegrationProviderToOwnership';
import { UniqueClientId1747424374434 as PgsqlUniqueClientId1747424374434 } from './migrations/pgsql/1747424374434-UniqueClientId';
import { CreateIntegrationApps1744933017953 as PgsqlCreateIntegrationApps1744933017953 } from './migrations/pgsql/1744933017953-CreateIntegrationApps';
import { CreateDetailedIntegrationAppsView1745533840578 as PgsqlCreateDetailedIntegrationAppsView1745533840578 } from './migrations/pgsql/1745533840578-CreateDetailedIntegrationAppsView';
import { RemoveUserConfig1764429283532 as PgsqlRemoveUserConfig1764429283532 } from './migrations/pgsql/1764429283532-remove-user-config';
import { CertificationSchema1778026000000 as PgsqlCertificationSchema1778026000000 } from './migrations/pgsql/1778026000000-CertificationSchema';
import { AddOdsInstanceMetadataFields1751299288000 as PgsqlAddOdsInstanceMetadataFields1751299288000 } from './migrations/pgsql/1751299288000-AddOdsInstanceMetadataFields';
import { AddCreateDeleteOdsPrivileges1785181605952 as PgsqlAddCreateDeleteOdsPrivileges1785181605952 } from './migrations/pgsql/1785181605952-AddCreateDeleteOdsPrivileges';
import { RenameDbInstanceIdToInstanceManageId1785365966591 as PgsqlRenameDbInstanceIdToInstanceManageId1785365966591 } from './migrations/pgsql/1785365966591-RenameDbInstanceIdToInstanceManageId';

// MSSQL migrations
import { Initial1688158300508 as MssqlInitial1688158300508 } from './migrations/mssql/1687190483471-initial';
import { SbeConfigReorg1687190483472 as MssqlSbeConfigReorg1687190483472 } from './migrations/mssql/1687190483472-sbe-config-reorg';
import { AdOdsNaturalKeyToEdorg1687466013005 as MssqlAdOdsNaturalKeyToEdorg1687466013005 } from './migrations/mssql/1687466013005-add-ods-natural-key-to-edorg';
import { EducationOrganizationIdToNumber1687881668666 as MssqlEducationOrganizationIdToNumber1687881668666 } from './migrations/mssql/1687881668666-educationOrganizationIdToNumber';
import { UniqueOwnershipConstraints1687900131470 as MssqlUniqueOwnershipConstraints1687900131470 } from './migrations/mssql/1687900131470-uniqueOwnershipConstraints';
import { EdorgShortname1689282856860 as MssqlEdorgShortname1689282856860 } from './migrations/mssql/1689282856860-edorg-shortname';
import { OwnershipUniquenessSoftdelete1691010443030 as MssqlOwnershipUniquenessSoftdelete1691010443030 } from './migrations/mssql/1691010443030-ownershipUniquenessSoftdelete';
import { AbandonSoftDeletion1691520653756 as MssqlAbandonSoftDeletion1691520653756 } from './migrations/mssql/1691520653756-abandonSoftDeletion';
import { GuaranteeMembershipUniqueness1691694310950 as MssqlGuaranteeMembershipUniqueness1691694310950 } from './migrations/mssql/1691694310950-guaranteeMembershipUniqueness';
import { AddSeparateSbeNameField1692280869502 as MssqlAddSeparateSbeNameField1692280869502 } from './migrations/mssql/1692280869502-AddSeparateSbeNameField';
import { NewSbSyncQueue1692740626759 as MssqlNewSbSyncQueue1692740626759 } from './migrations/mssql/1692740626759-NewSbSyncQueue';
import { NullableEnvlabel1693335908870 as MssqlNullableEnvlabel1693335908870 } from './migrations/mssql/1693335908870-NullableEnvlabel';
import { FkOnDeleteTweaks1693514948085 as MssqlFkOnDeleteTweaks1693514948085 } from './migrations/mssql/1693514948085-fkOnDeleteTweaks';
import { FkOnDeleteFix1694446892889 as MssqlFkOnDeleteFix1694446892889 } from './migrations/mssql/1694446892889-FkOnDeleteFix';
import { LowercaseUniqueUsernames1697054661848 as MssqlLowercaseUniqueUsernames1697054661848 } from './migrations/mssql/1697054661848-LowercaseUniqueUsernames';
import { Seeding1697203599392 as MssqlSeeding1697203599392 } from './migrations/mssql/1697203599392-Seeding';
import { RemoveRemainingAppLauncherThings1697207080973 as MssqlRemoveRemainingAppLauncherThings1697207080973 } from './migrations/mssql/1697207080973-RemoveRemainingAppLauncherThings';
import { V7Changes1709328882890 as MssqlV7Changes1709328882890 } from './migrations/mssql/1709328882890-v7-changes';
import { EnvNav1710178189458 as MssqlEnvNav1710178189458 } from './migrations/mssql/1710178189458-EnvNav';
import { OdsInstanceName1710454017707 as MssqlOdsInstanceName1710454017707 } from './migrations/mssql/1710454017707-OdsInstanceName';
import { RemoveImpliedPrivilege1714074225483 as MssqlRemoveImpliedPrivilege1714074225483 } from './migrations/mssql/1714074225483-RemoveImpliedPrivilege';
import { BigIntEdOrg1717166915117 as MssqlBigIntEdOrg1717166915117 } from './migrations/mssql/1717166915117-BigIntEdOrgId';
import { AddProfilePrivileges1719427712090 as MssqlAddProfilePrivileges1719427712090 } from './migrations/mssql/1719427712090-AddProfilePrivileges';
import { AddNameOfInstitutionToOwnershipView1725479500715 as MssqlAddNameOfInstitutionToOwnershipView1725479500715 } from './migrations/mssql/1725479500715-AddNameOfInstitutionToOwnershipView';
import { AddMachineUserColumns1742186909224 as MssqlAddMachineUserColumns1742186909224 } from './migrations/mssql/1742891918530-AddMachineUserColumns';
import { IntegrationProviders1744127024224 as MssqlIntegrationProviders1744127024224 } from './migrations/mssql/1744127024224-IntegrationProviders';
import { AddIntegrationProviderToOwnership1744919046622 as MssqlAddIntegrationProviderToOwnership1744919046622 } from './migrations/mssql/1744919046622-AddIntegrationProviderToOwnership';
import { UniqueClientId1747424374434 as MssqlUniqueClientId1747424374434 } from './migrations/mssql/1747424374434-UniqueClientId';
import { CreateIntegrationApps1744933017953 as MssqlCreateIntegrationApps1744933017953 } from './migrations/mssql/1744933017953-CreateIntegrationApps';
import { CreateDetailedIntegrationAppsView1745533840578 as MssqlCreateDetailedIntegrationAppsView1745533840578 } from './migrations/mssql/1745533840578-CreateDetailedIntegrationAppsView';
import { RemoveUserConfig1764429283532 as MssqlRemoveUserConfig1764429283532 } from './migrations/mssql/1764429283532-remove-user-config';
import { JobQueueAndSyncView1764929283532 as MssqlJobQueueAndSyncView1764929283532 } from './migrations/mssql/1764929283532-JobQueueAndSyncView';
import { CertificationSchema1778026000000 as MssqlCertificationSchema1778026000000 } from './migrations/mssql/1778026000000-CertificationSchema';
import { AddOdsInstanceMetadataFields1751299288000 as MssqlAddOdsInstanceMetadataFields1751299288000 } from './migrations/mssql/1751299288000-AddOdsInstanceMetadataFields';
import { AddCreateDeleteOdsPrivileges1785181605952 as MssqlAddCreateDeleteOdsPrivileges1785181605952 } from './migrations/mssql/1785181605952-AddCreateDeleteOdsPrivileges';
import { RenameDbInstanceIdToInstanceManageId1785365966591 as MssqlRenameDbInstanceIdToInstanceManageId1785365966591 } from './migrations/mssql/1785365966591-RenameDbInstanceIdToInstanceManageId';

// Get migrations based on database engine
const getPostgreSQLMigrations = () => [
  PgsqlInitial1688158300508,
  PgsqlSbeConfigReorg1687190483472,
  PgsqlAdOdsNaturalKeyToEdorg1687466013005,
  PgsqlEducationOrganizationIdToNumber1687881668666,
  PgsqlUniqueOwnershipConstraints1687900131470,
  PgsqlEdorgShortname1689282856860,
  PgsqlOwnershipUniquenessSoftdelete1691010443030,
  PgsqlAbandonSoftDeletion1691520653756,
  PgsqlGuaranteeMembershipUniqueness1691694310950,
  PgsqlAddSeparateSbeNameField1692280869502,
  PgsqlNewSbSyncQueue1692740626759,
  PgsqlNullableEnvlabel1693335908870,
  PgsqlFkOnDeleteTweaks1693514948085,
  PgsqlFkOnDeleteFix1694446892889,
  PgsqlLowercaseUniqueUsernames1697054661848,
  PgsqlSeeding1697203599392,
  PgsqlRemoveRemainingAppLauncherThings1697207080973,
  PgsqlV7Changes1709328882890,
  PgsqlEnvNav1710178189458,
  PgsqlOdsInstanceName1710454017707,
  PgsqlRemoveImpliedPrivilege1714074225483,
  PgsqlBigIntEdOrg1717166915117,
  PgsqlAddProfilePrivileges1719427712090,
  PgsqlAddNameOfInstitutionToOwnershipView1725479500715,
  PgsqlAddMachineUserColumns1742186909224,
  PgsqlIntegrationProviders1744127024224,
  PgsqlAddIntegrationProviderToOwnership1744919046622,
  PgsqlCreateIntegrationApps1744933017953,
  PgsqlCreateDetailedIntegrationAppsView1745533840578,
  PgsqlUniqueClientId1747424374434,
  PgsqlRemoveUserConfig1764429283532,
  PgsqlCertificationSchema1778026000000,
  PgsqlAddOdsInstanceMetadataFields1751299288000,
  PgsqlAddCreateDeleteOdsPrivileges1785181605952,
  PgsqlRenameDbInstanceIdToInstanceManageId1785365966591,
];

const getMSSQLMigrations = () => [
  MssqlInitial1688158300508,
  MssqlSbeConfigReorg1687190483472,
  MssqlAdOdsNaturalKeyToEdorg1687466013005,
  MssqlEducationOrganizationIdToNumber1687881668666,
  MssqlUniqueOwnershipConstraints1687900131470,
  MssqlEdorgShortname1689282856860,
  MssqlOwnershipUniquenessSoftdelete1691010443030,
  MssqlAbandonSoftDeletion1691520653756,
  MssqlGuaranteeMembershipUniqueness1691694310950,
  MssqlAddSeparateSbeNameField1692280869502,
  MssqlNewSbSyncQueue1692740626759,
  MssqlNullableEnvlabel1693335908870,
  MssqlFkOnDeleteTweaks1693514948085,
  MssqlFkOnDeleteFix1694446892889,
  MssqlLowercaseUniqueUsernames1697054661848,
  MssqlSeeding1697203599392,
  MssqlRemoveRemainingAppLauncherThings1697207080973,
  MssqlV7Changes1709328882890,
  MssqlEnvNav1710178189458,
  MssqlOdsInstanceName1710454017707,
  MssqlRemoveImpliedPrivilege1714074225483,
  MssqlBigIntEdOrg1717166915117,
  MssqlAddProfilePrivileges1719427712090,
  MssqlAddNameOfInstitutionToOwnershipView1725479500715,
  MssqlAddMachineUserColumns1742186909224,
  MssqlIntegrationProviders1744127024224,
  MssqlAddIntegrationProviderToOwnership1744919046622,
  MssqlCreateIntegrationApps1744933017953,
  MssqlCreateDetailedIntegrationAppsView1745533840578,
  MssqlUniqueClientId1747424374434,
  MssqlRemoveUserConfig1764429283532,
  MssqlJobQueueAndSyncView1764929283532,
  MssqlCertificationSchema1778026000000,
  MssqlAddOdsInstanceMetadataFields1751299288000,
  MssqlAddCreateDeleteOdsPrivileges1785181605952,
  MssqlRenameDbInstanceIdToInstanceManageId1785365966591,
];

const getDatabaseConfig = (): PostgresConnectionOptions | SqlServerConnectionOptions => {
  const baseEntities = [
    EdfiTenant,
    Edorg,
    EnvNav,
    IntegrationApp,
    IntegrationAppDetailed,
    IntegrationProvider,
    Ods,
    Oidc,
    Ownership,
    OwnershipView,
    Role,
    SbEnvironment,
    SbSyncQueue,
    Team,
    User,
    UserTeamMembership,
    CatalogVersion,
    AreaCatalog,
    ScenarioCatalog,
    StepCatalog,
    StepParameterCatalog,
    CertificationOdsApi,
    CertificationProcess,
    CertificationProcessScenario,
    ScenarioStep,
    ScenarioStepError,
  ];

  const baseConfig = {
    entities: baseEntities,
    synchronize: false,
    migrationsRun: true,
    logging: config.TYPEORM_LOGGING,
  };

  if (config.DB_ENGINE === 'mssql') {
    return {
      ...baseConfig,
      migrations: getMSSQLMigrations(),
      type: 'mssql',
      // MSSQL-specific options,
      options: {
        encrypt: asBool(config.DB_SSL),
        trustServerCertificate: asBool(config.DB_TRUST_CERTIFICATE),
      },
    } as SqlServerConnectionOptions;
  }

  return {
    ...baseConfig,
    migrations: getPostgreSQLMigrations(),
    type: 'postgres',
    // Add Postgres-specific options here if needed
  } as PostgresConnectionOptions;
};

export default getDatabaseConfig();
