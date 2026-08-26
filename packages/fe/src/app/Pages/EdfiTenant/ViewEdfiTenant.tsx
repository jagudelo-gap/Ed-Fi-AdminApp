import {
  Attribute,
  AttributeContainer,
  AttributesGrid,
  ContentSection,
} from '@edanalytics/common-ui';
import { GetEdfiTenantDto } from '@edanalytics/models';
import { AuthorizeComponent, useTeamSbEnvironmentNavContext } from '../../helpers';
import { Link } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router';
import { SbEnvironmentLink } from '../../routes';
import { queryFromEntity } from '../../api/queries/builder';

export const ViewEdfiTenant = ({ edfiTenant }: { edfiTenant: GetEdfiTenantDto }) => {
  const { teamId, sbEnvironmentId, sbEnvironment } = useTeamSbEnvironmentNavContext();
  const allowedEdorgs =
    sbEnvironment?.configPublic?.values && 'tenants' in sbEnvironment.configPublic.values
      ? sbEnvironment?.configPublic?.values?.tenants?.[edfiTenant.name]?.allowedEdorgs
      : undefined;

  return edfiTenant ? (
    <ContentSection>
      <AttributesGrid>
        <Attribute label="Name" value={edfiTenant.displayName} />
        <AttributeContainer label="Environment">
          <SbEnvironmentLink
            id={edfiTenant.sbEnvironmentId}
            query={sbEnvironment ? queryFromEntity(sbEnvironment) : { data: undefined }}
          />
        </AttributeContainer>
        <AttributeContainer label="Resources">
          <AuthorizeComponent
            config={{
              privilege: 'team.sb-environment.edfi-tenant.ods:read',
              subject: { id: '__filtered__', edfiTenantId: edfiTenant.id, teamId },
            }}
          >
            <Link
              display="block"
              as={RouterLink}
              to={`/as/${teamId}/sb-environments/${sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/odss`}
            >
              ODS's &rarr;
            </Link>
          </AuthorizeComponent>
          <AuthorizeComponent
            config={{
              privilege: 'team.sb-environment.edfi-tenant.ods.edorg:read',
              subject: { id: '__filtered__', edfiTenantId: edfiTenant.id, teamId },
            }}
          >
            <Link
              display="block"
              as={RouterLink}
              to={`/as/${teamId}/sb-environments/${sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/edorgs`}
            >
              Ed-Orgs &rarr;
            </Link>
          </AuthorizeComponent>
          <AuthorizeComponent
            config={{
              privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:read',
              subject: { id: '__filtered__', edfiTenantId: edfiTenant.id, teamId },
            }}
          >
            <Link
              display="block"
              as={RouterLink}
              to={`/as/${teamId}/sb-environments/${sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/applications`}
            >
              Applications &rarr;
            </Link>
          </AuthorizeComponent>
          <AuthorizeComponent
            config={{
              privilege: 'team.sb-environment.edfi-tenant.vendor:read',
              subject: { id: '__filtered__', edfiTenantId: edfiTenant.id, teamId },
            }}
          >
            <Link
              display="block"
              as={RouterLink}
              to={`/as/${teamId}/sb-environments/${sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/vendors`}
            >
              Vendors &rarr;
            </Link>
          </AuthorizeComponent>
          <AuthorizeComponent
            config={{
              privilege: 'team.sb-environment.edfi-tenant.claimset:read',
              subject: { id: '__filtered__', edfiTenantId: edfiTenant.id, teamId },
            }}
          >
            <Link
              display="block"
              as={RouterLink}
              to={`/as/${teamId}/sb-environments/${sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/claimsets`}
            >
              Claimsets &rarr;
            </Link>
          </AuthorizeComponent>
          {sbEnvironment?.version !== 'v1' && (
            <AuthorizeComponent
              config={{
                privilege: 'team.sb-environment.edfi-tenant.profile:read',
                subject: { id: '__filtered__', edfiTenantId: edfiTenant.id, teamId },
              }}
            >
              <Link
                display="block"
                as={RouterLink}
                to={`/as/${teamId}/sb-environments/${sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/profiles`}
              >
                Profiles &rarr;
              </Link>
            </AuthorizeComponent>
          )}
        </AttributeContainer>
        {allowedEdorgs?.length && (
          <Attribute label="Allowed Ed-Orgs" value={allowedEdorgs.join(', ')} />
        )}
      </AttributesGrid>
    </ContentSection>
  ) : null;
};
