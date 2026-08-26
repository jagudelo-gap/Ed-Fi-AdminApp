import { Routes } from '@nestjs/core';

import { AdminApiModuleV1 } from '../teams/edfi-tenants/starting-blocks/v1/admin-api.v1.module';
import { AdminApiModuleV2 } from '../teams/edfi-tenants/starting-blocks/v2/admin-api.v2.module';
import { AdminApiModuleV3 } from '../teams/edfi-tenants/starting-blocks/v3/admin-api.v3.module';
import { EdfiTenantsGlobalModule } from '../edfi-tenants-global/edfi-tenants-global.module';
import { EdfiTenantsModule } from '../teams/edfi-tenants/edfi-tenants.module';
import { EdorgsGlobalModule } from '../edfi-tenants-global/edorgs-global/edorgs-global.module';
import { EdorgsModule } from '../teams/edfi-tenants/edorgs/edorgs.module';
import { IntegrationAppsTeamModule } from '../integration-apps-team/integration-apps-team.module';
import { IntegrationProvidersGlobalModule } from '../integration-providers-global/integration-providers-global.module';
import { IntegrationProvidersTeamModule } from '../integration-providers-global/integration-providers-team.module';
import { OdssGlobalModule } from '../edfi-tenants-global/odss-global/odss-global.module';
import { OdssModule } from '../teams/edfi-tenants/odss/odss.module';
import { OwnershipsGlobalModule } from '../ownerships-global/ownerships-global.module';
import { OwnershipsModule } from '../teams/ownerships/ownerships.module';
import { RolesGlobalModule } from '../roles-global/roles-global.module';
import { RolesModule } from '../teams/roles/roles.module';
import { SbEnvironmentsGlobalModule } from '../sb-environments-global/sb-environments-global.module';
import { SbEnvironmentsModule } from '../teams/sb-environments/sb-environments.module';
import { SbSyncModule } from '../sb-sync/sb-sync.module';
import { TeamsGlobalModule } from '../teams/teams-global.module';
import { UserTeamMembershipsGlobalModule } from '../user-team-memberships-global/user-team-memberships-global.module';
import { UserTeamMembershipsModule } from '../teams/user-team-memberships/user-team-memberships.module';
import { UsersGlobalModule } from '../users-global/users-global.module';
import { UsersModule } from '../teams/users/users.module';

export const routes: Routes = [
  {
    path: '/teams',
    module: TeamsGlobalModule,
    children: [
      {
        path: '/:teamId/integration-providers',
        module: IntegrationProvidersTeamModule,
        children: [
          {
            path: '/:integrationProviderId/integration-apps',
            module: IntegrationAppsTeamModule,
          },
        ],
      },
      {
        path: '/:teamId/sb-environments',
        module: SbEnvironmentsModule,
        children: [
          {
            path: '/:sbEnvironmentId/edfi-tenants',
            module: EdfiTenantsModule,
          },
        ],
      },
      {
        path: '/:teamId/users',
        module: UsersModule,
      },
      {
        path: '/:teamId/user-team-memberships',
        module: UserTeamMembershipsModule,
      },
      {
        path: '/:teamId/roles',
        module: RolesModule,
      },
      {
        path: '/:teamId/ownerships',
        module: OwnershipsModule,
      },
      {
        path: '/:teamId/edfi-tenants/:edfiTenantId/odss',
        module: OdssModule,
      },
      {
        path: '/:teamId/edfi-tenants/:edfiTenantId/edorgs',
        module: EdorgsModule,
      },
      {
        path: '/:teamId/edfi-tenants/:edfiTenantId/admin-api/v1',
        module: AdminApiModuleV1,
      },
      {
        path: '/:teamId/edfi-tenants/:edfiTenantId/admin-api/v2',
        module: AdminApiModuleV2,
      },
      {
        path: '/:teamId/edfi-tenants/:edfiTenantId/admin-api/v3',
        module: AdminApiModuleV3,
      },
    ],
  },
  {
    path: '/sb-sync-queues',
    module: SbSyncModule,
  },
  {
    path: '/sb-environments',
    module: SbEnvironmentsGlobalModule,
    children: [
      {
        path: '/:sbEnvironmentId/edfi-tenants',
        module: EdfiTenantsGlobalModule,
      },
    ],
  },
  {
    path: '/edfi-tenants/:edfiTenantId/odss',
    module: OdssGlobalModule,
  },
  {
    path: '/edfi-tenants/:edfiTenantId/edorgs',
    module: EdorgsGlobalModule,
  },
  {
    path: '/integration-providers',
    module: IntegrationProvidersGlobalModule,
  },
  {
    path: '/ownerships',
    module: OwnershipsGlobalModule,
  },
  {
    path: '/roles',
    module: RolesGlobalModule,
  },
  {
    path: '/users',
    module: UsersGlobalModule,
  },
  {
    path: '/user-team-memberships',
    module: UserTeamMembershipsGlobalModule,
  },
];
