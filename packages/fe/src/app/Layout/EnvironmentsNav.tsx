import { Box, HStack, Link, Table, Tbody, Td, Th, Thead, Tr } from '@chakra-ui/react';
import {
  ActionsType,
  Icons,
  LinkActionProps,
  SearchWithResults,
  TableRowActions,
} from '@edanalytics/common-ui';
import { type IconType } from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import lunr, { Query, tokenizer } from 'lunr';
import { useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import { teamQueries } from '../api';
import { AuthorizeConfig, useAuthorize, useTeamNavContext } from '../helpers';

// by default this includes dashes, which we don't want because they're part of names
lunr.tokenizer.separator = /[\s]+/;

export const EnvironmentsNav = () => {
  const { teamId } = useTeamNavContext();
  const sbEnvironmentAuth: AuthorizeConfig = {
    privilege: 'team.sb-environment:read',
    subject: {
      id: '__filtered__',
      teamId,
    },
  };

  const envItems = useQuery(
    teamQueries.navSearchList(
      {
        enabled: useAuthorize(sbEnvironmentAuth),
      },
      { teamId }
    )
  );
  const searchIndex = useMemo(() => {
    const items = Object.entries(envItems.data || {}).map(([key, value]) => {
      // add in searchable strings for entity types that are available. e.g. "edorgs" string.
      const resourceTrueValues = Object.entries(value)
        .filter(([_key, value]) => value === true)
        .map(([key]) => key)
        .join(' ');
      return {
        key,
        env: value.sbEnvironmentName,
        tenant: value.edfiTenantName ?? '',
        resources: resourceTrueValues,
      };
    });
    // overall we're not making a ton of use of the lunr features but its still better than something built from scratch
    const searchIndex = lunr(function () {
      // searchable text is all names not words. wildcards > stemmer for that.
      this.pipeline.remove(lunr.stemmer);
      this.ref('key');
      // boost numbers (for sort) mostly abitrary rn, feel free to adjust
      this.field('env', { boost: 5 });
      this.field('tenant', { boost: 10 });
      this.field('resources', { boost: 2 });
      items.forEach((item) => {
        this.add(item);
      });
    });
    return searchIndex;
  }, [envItems.data]);

  const [searchText, setSearchText] = useState('');
  const searchResults = useMemo(() => {
    return searchIndex
      .query((query) =>
        tokenizer(searchText).forEach((token) =>
          query.term(token, {
            wildcard: Query.wildcard.TRAILING | Query.wildcard.LEADING,
            presence: Query.presence.REQUIRED,
          })
        )
      )
      .map((result) => envItems.data![result.ref]);
  }, [searchText, searchIndex, envItems.data]);

  const navigate = useNavigate();

  const parentRef = useRef<HTMLDivElement | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: searchResults.length,
    getScrollElement: () => parentRef.current!,
    estimateSize: () => 35,
    overscan: 5,
  });

  return (
    <Box px={3} py={3}>
      <SearchWithResults
        onChange={setSearchText}
        value={searchText}
        openWidth="40em"
        items={
          <Box
            overflowY="auto"
            maxH="300px"
            ref={parentRef}
            mt={2}
          >
            <Box h={rowVirtualizer.getTotalSize() + 45 + 'px'}>
              <Table
                css={`
                  & .row-hover {
                    visibility: visible !important;
                  }
                  & th {
                    position: sticky;
                    top: 0;
                    background: var(--chakra-colors-gray-100);
                    z-index: 2;
                  }
                `}
                w="calc(100% - 1em)"
                m="0.5em"
                mt={0}
              >
                {!!searchResults.length && (
                  <Thead>
                    <Tr>
                      <Th w="30%">Environment</Th>
                      <Th w="30%">Tenant</Th>
                      <Th w="40%">Tenant resources</Th>
                    </Tr>
                  </Thead>
                )}
                <Tbody>
                  {rowVirtualizer.getVirtualItems().map((virtualItem, i) => {
                    const item = searchResults[virtualItem.index];
                    const tenantResourceActionConfigs: ActionsType = Object.fromEntries(
                      Object.entries(item)
                        .filter(([key, value]) => key in resourceNames && value === true)
                        .map(([key, _value]): [string, LinkActionProps] => [
                          key,
                          {
                            to: `/as/${teamId}/sb-environments/${item.sbEnvironmentId}/edfi-tenants/${item.edfiTenantId}/${key}`,
                            title: `Go to ${resourceNames[key]}`,
                            text: resourceNames[key],
                            onClick: () =>
                              navigate(
                                `/as/${teamId}/sb-environments/${item.sbEnvironmentId}/edfi-tenants/${item.edfiTenantId}/${key}`
                              ),
                            icon: resourceIcons[key],
                          },
                        ])
                    );
                    return (
                      <Tr
                        h={`${virtualItem.size}px`}
                        transform={`translateY(${virtualItem.start - i * virtualItem.size}px)`}
                        key={'' + item.sbEnvironmentId + item.edfiTenantId}
                      >
                        <Td>
                          <Link as="span">
                            <RouterLink
                              title="Go to environment"
                              to={`/as/${teamId}/sb-environments/${item.sbEnvironmentId}`}
                            >
                              {item.sbEnvironmentName}
                            </RouterLink>
                          </Link>
                        </Td>
                        <Td>
                          {item.edfiTenantId !== null && (
                            <Link as="span">
                              <RouterLink
                                title="Go to tenant"
                                to={`/as/${teamId}/sb-environments/${item.sbEnvironmentId}/edfi-tenants/${item.edfiTenantId}`}
                              >
                                {item.edfiTenantName}
                              </RouterLink>
                            </Link>
                          )}
                        </Td>
                        <Td>
                          {item.edfiTenantId !== null && (
                            <HStack>
                              <TableRowActions actions={tenantResourceActionConfigs} show={100} />
                            </HStack>
                          )}
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </Box>
          </Box>
        }
      />
    </Box>
  );
};

const resourceNames: Record<string, string> = {
  odss: 'ODSs',
  edorgs: 'Ed-Orgs',
  vendors: 'Vendors',
  claimsets: 'Claimsets',
  applications: 'Applications',
  profiles: 'Profiles',
};
const resourceIcons: Record<string, IconType> = {
  odss: Icons.ODS,
  edorgs: Icons.EdOrg,
  vendors: Icons.Vendor,
  applications: Icons.Application,
  claimsets: Icons.Claimset,
  profiles: Icons.Profile,
};
