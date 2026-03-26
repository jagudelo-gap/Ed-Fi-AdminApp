import { Module } from '@nestjs/common';
import { APP_GUARD, RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseConfigService } from '../database/database-config.service';
import { HealthService } from './health.service';

import { AdminApiModuleV1 } from '../teams/edfi-tenants/starting-blocks/v1/admin-api.v1.module';
import { AdminApiModuleV2 } from '../teams/edfi-tenants/starting-blocks/v2/admin-api.v2.module';
import { AuthCacheGuard } from '../auth/authorization/authorization-cache.guard';
import { AuthModule } from '../auth/auth.module';
import { AuthenticatedGuard } from '../auth/login/authenticated.guard';
import { AuthorizedGuard } from '../auth/authorization/authorized.guard';
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
import { PgBossModule } from '../sb-sync/pg-boss.module';
import { RolesGlobalModule } from '../roles-global/roles-global.module';
import { RolesModule } from '../teams/roles/roles.module';
import { SbEnvironmentEdfiTenantInterceptor } from './sb-environment-edfi-tenant.interceptor';
import { SbEnvironmentsGlobalModule } from '../sb-environments-global/sb-environments-global.module';
import { SbEnvironmentsModule } from '../teams/sb-environments/sb-environments.module';
import { SbSyncModule } from '../sb-sync/sb-sync.module';
import { ServicesModule } from './services.module';
import { TeamsGlobalModule } from '../teams/teams-global.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { UserTeamMembershipsGlobalModule } from '../user-team-memberships-global/user-team-memberships-global.module';
import { UserTeamMembershipsModule } from '../teams/user-team-memberships/user-team-memberships.module';
import { UsersGlobalModule } from '../users-global/users-global.module';
import { UsersModule } from '../teams/users/users.module';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { routes } from './routes';
import config from 'config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async (configService: DatabaseConfigService) => {
        return await configService.createTypeOrmOptions();
      },
      inject: [DatabaseConfigService],
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: config.RATE_LIMIT_TTL,
          limit: config.RATE_LIMIT_LIMIT,
        },
      ],
    }),
    RouterModule.register(routes),
    AdminApiModuleV1,
    AdminApiModuleV2,
    AuthModule,
    EdfiTenantsGlobalModule,
    EdfiTenantsModule,
    EdorgsGlobalModule,
    EdorgsModule,
    IntegrationAppsTeamModule,
    IntegrationProvidersGlobalModule,
    IntegrationProvidersTeamModule,
    OdssGlobalModule,
    OdssModule,
    OwnershipsGlobalModule,
    OwnershipsModule,
    PgBossModule,
    RolesGlobalModule,
    RolesModule,
    SbEnvironmentsGlobalModule,
    SbEnvironmentsModule,
    SbSyncModule,
    ServicesModule,
    TeamsGlobalModule,
    UsersGlobalModule,
    UsersModule,
    UserTeamMembershipsGlobalModule,
    UserTeamMembershipsModule,
  ],
  controllers: [AppController],
  providers: [
    DatabaseConfigService,
    HealthService,
    SbEnvironmentEdfiTenantInterceptor,
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthenticatedGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthCacheGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthorizedGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ],
  exports: [SbEnvironmentEdfiTenantInterceptor],
})
export class AppModule {}
