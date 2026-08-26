import {
  Attribute,
  AttributeContainer,
  AttributesGrid,
  ContentSection,
} from '@edanalytics/common-ui';
import { GetSbEnvironmentDto } from '@edanalytics/models';
import { AuthorizeComponent, useTeamSbEnvironmentNavContext } from '../../helpers';
import { Link } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router';

export const ViewSbEnvironment = ({ sbEnvironment }: { sbEnvironment: GetSbEnvironmentDto }) => {
  const { teamId, sbEnvironmentId } = useTeamSbEnvironmentNavContext();
  return (
    <ContentSection>
      <AttributesGrid>
        <Attribute label="Name" value={sbEnvironment.displayName} />
        <Attribute
          isCopyable
          isUrl
          isUrlExternal
          label="ODS API URL"
          value={sbEnvironment.usableDomain}
        />
        <Attribute label="Created" value={sbEnvironment.created} isDate />
        <Attribute
          isCopyable
          isUrl
          isUrlExternal
          label="Admin API URL"
          value={sbEnvironment.adminApiUrl}
        />
        <Attribute isCopyable label="ODS API version" value={sbEnvironment.odsApiVersion} />
        <Attribute isCopyable label="Data standard version" value={sbEnvironment.odsDsVersion} />
        <AuthorizeComponent
          config={{
            privilege: 'team.sb-environment.edfi-tenant:read',
            subject: { teamId, id: '__filtered__', sbEnvironmentId },
          }}
        >
          <AttributeContainer label="Tenants">
            <Link
              as={RouterLink}
              to={`/as/${teamId}/sb-environments/${sbEnvironmentId}/edfi-tenants`}
            >
              View tenants
            </Link>
          </AttributeContainer>
        </AuthorizeComponent>
      </AttributesGrid>
    </ContentSection>
  );
};
