import { ListItem, UnorderedList } from '@chakra-ui/react';
import {
  Attribute,
  AttributeContainer,
  AttributesGrid,
  ContentSection,
} from '@edanalytics/common-ui';
import { GetEdorgDto, GetOdsDto, edorgKeyV2 } from '@edanalytics/models';
import { UseQueryOptions, useQuery } from '@tanstack/react-query';
import { edorgQueries, odsQueries, profileQueriesV2, vendorQueriesV2 } from '../../api';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { ClaimsetLinkV2, EdorgLink, OdsLink, ProfileLink, VendorLinkV2 } from '../../routes';
import { ApplicationEntity } from './applicationConfig';
import { ClaimsetEntity, useClaimsetConfig } from '../ClaimsetV2Plus/claimsetConfig';
import { useOdsTerminology } from '../Ods/useOdsTerminology';

export const ViewApplication = ({
  application,
  dataStoreIds,
  url,
}: {
  application: ApplicationEntity;
  dataStoreIds: number[];
  url?: string;
}) => {
  const { edfiTenant, teamId } = useTeamEdfiTenantNavContextLoaded();
  const odsTerminology = useOdsTerminology();

  const vendors = useQuery(
    vendorQueriesV2.getAll({
      edfiTenant,
      teamId,
    })
  );
  const { queries: claimsetQueries } = useClaimsetConfig();
  // TypeScript cannot resolve union-typed overloaded functions; cast to the
  // actual return type (same pattern as ClaimsetsPage.tsx / ClaimsetPage.tsx).
  const claimsets = useQuery(
    claimsetQueries.getAll({
      edfiTenant,
      teamId,
    }) as UseQueryOptions<Record<string | number, ClaimsetEntity>>
  );

  const edorgs = useQuery(
    edorgQueries.getAll({
      teamId,
      edfiTenant,
    })
  );
  const profiles = useQuery(
    profileQueriesV2.getAll({
      teamId,
      edfiTenant,
    })
  );

  const edorgsByEdorgId = {
    ...edorgs,
    data: Object.values(edorgs.data ?? {}).reduce<Record<string, GetEdorgDto>>((map, edorg) => {
      map[
        edorgKeyV2({
          edorg: edorg.educationOrganizationId,
          ods: edorg.odsInstanceId,
        })
      ] = edorg;
      return map;
    }, {}),
  };
  const claimsetsByName = {
    ...claimsets,
    data: Object.values(claimsets.data ?? {}).reduce<Record<string, ClaimsetEntity>>(
      (map, claimset) => {
        map[claimset.name] = claimset;
        return map;
      },
      {}
    ),
  };

  const odss = useQuery(
    odsQueries.getAll({
      edfiTenant: edfiTenant,
      teamId,
    })
  );
  const odssByInstanceId = {
    ...odss,
    data: Object.values(odss.data ?? {}).reduce<Record<string, GetOdsDto>>((map, ods) => {
      map[ods.odsInstanceId!] = ods;
      return map;
    }, {}),
  };

  return application ? (
    <ContentSection>
      <AttributesGrid>
        <Attribute isCopyable label="Application name" value={application.applicationName} />
        <AttributeContainer label={odsTerminology.singular}>
          {dataStoreIds.length
            ? dataStoreIds
                .map((odsInstanceId) => (
                  <OdsLink key={odsInstanceId} id={odsInstanceId} query={odssByInstanceId} />
                ))
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .reduce((prev, curr) => [prev, ', ', curr] as any)
            : '-'}
        </AttributeContainer>{' '}
        <AttributeContainer label="Vendor">
          <VendorLinkV2 id={application.vendorId} query={vendors} />
        </AttributeContainer>
        <AttributeContainer label="Profiles">
          {application.profileIds?.length ? (
            <UnorderedList>
              {application.profileIds.map((profileId) => (
                <ListItem key={profileId}>
                  <ProfileLink key={profileId} id={profileId} query={profiles} />
                </ListItem>
              ))}
            </UnorderedList>
          ) : (
            '-'
          )}{' '}
        </AttributeContainer>
        <AttributeContainer label="Claimset">
          <ClaimsetLinkV2 id={application.claimSetName} query={claimsetsByName} />
        </AttributeContainer>
        <AttributeContainer label="Ed-org">
          {application.educationOrganizationIds?.length ? (
            <UnorderedList>
              {dataStoreIds.flatMap((odsInstanceId) =>
                application.educationOrganizationIds.map((edorgId) => (
                  <ListItem key={edorgId}>
                    <EdorgLink
                      key={edorgId}
                      id={edorgKeyV2({
                        edorg: edorgId,
                        ods: odsInstanceId,
                      })}
                      query={edorgsByEdorgId}
                    />
                  </ListItem>
                ))
              )}
            </UnorderedList>
          ) : (
            '-'
          )}
        </AttributeContainer>
        <Attribute label="Integration Provider" value={application.integrationProviderName} />
        <Attribute label="URL" value={url} isUrl isUrlExternal isCopyable />
      </AttributesGrid>
    </ContentSection>
  ) : null;
};
