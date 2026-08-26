import {
  Attribute,
  AttributeContainer,
  AttributesGrid,
  ContentSection,
} from '@edanalytics/common-ui';
import { GetApplicationDto, GetEdorgDto, edorgCompositeKey } from '@edanalytics/models';
import { claimsetQueriesV1, edorgQueries, vendorQueriesV1 } from '../../api';
import { ClaimsetLinkV1, EdorgLink, VendorLinkV1 } from '../../routes';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useQuery } from '@tanstack/react-query';

export const ViewApplication = ({ application }: { application: GetApplicationDto }) => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();

  const edorgs = useQuery(
    edorgQueries.getAll({
      teamId,
      edfiTenant,
    })
  );
  const vendors = useQuery(
    vendorQueriesV1.getAll({
      edfiTenant,
      teamId,
    })
  );
  const claimsets = useQuery(
    claimsetQueriesV1.getAll({
      teamId,
      edfiTenant,
    })
  );
  const edorgsByEdorgId = {
    ...edorgs,
    data: Object.values(edorgs.data ?? {}).reduce<Record<string, GetEdorgDto>>((map, edorg) => {
      map[
        edorgCompositeKey({
          edorg: edorg.educationOrganizationId,
          ods: edorg.odsDbName,
        })
      ] = edorg;
      return map;
    }, {}),
  };

  const claimsetsByName = {
    data: Object.fromEntries(Object.values(claimsets.data ?? {}).map((c) => [c.name, c])),
  };

  const url =
    application && edfiTenant.sbEnvironment.domain
      ? GetApplicationDto.apiUrl(edfiTenant.sbEnvironment.startingBlocks, edfiTenant.sbEnvironment.domain, application.applicationName)
      : undefined;

  return application ? (
    <ContentSection>
      <AttributesGrid>
        <Attribute isCopyable label="Application name" value={application.displayName} />
        <AttributeContainer label="Vendor">
          <VendorLinkV1 id={application?.vendorId} query={vendors} />
        </AttributeContainer>
        <AttributeContainer label="Claimset">
          <ClaimsetLinkV1 id={application.claimSetName} query={claimsetsByName} />
        </AttributeContainer>
        <AttributeContainer label="Ed-org">
          {application._educationOrganizationIds?.length
            ? application._educationOrganizationIds.map((edorgId) => (
                <p key={edorgId}>
                  <EdorgLink
                    id={edorgCompositeKey({
                      edorg: edorgId,
                      ods: 'EdFi_Ods_' + application.odsInstanceName,
                    })}
                    query={edorgsByEdorgId}
                  />
                </p>
              ))
            : '-'}
        </AttributeContainer>
        <Attribute label="URL" value={url} isUrl isUrlExternal isCopyable />
      </AttributesGrid>
    </ContentSection>
  ) : null;
};
