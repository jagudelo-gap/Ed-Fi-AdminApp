import { Box, IconButton, Text } from '@chakra-ui/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAtom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import set from 'lodash/set';
import sortBy from 'lodash/sortBy';
import uniq from 'lodash/uniq';
import { useEffect, useMemo, useState } from 'react';
import { useMatches, useParams } from 'react-router';
import { sbEnvironmentQueries, teamQueries } from '../api';
import {
  AuthorizeConfig,
  arrayElemIf,
  authorize,
  useAuthorize,
  usePrivilegeCacheForConfig,
} from '../helpers';
import { EnvironmentsNav } from './EnvironmentsNav';
import { findDeepestMatch, tagMatch } from './GlobalNav';
import { INavButtonProps, NavButton } from './NavButton';
import { UniversalNavLinks } from './UniversalNavLinks';
import { usePaths } from '../routes/paths';
import { useGetManyIntegrationProviders } from '../api-v2';
import { Icons } from '@edanalytics/common-ui';

type OpenNavs = Record<number, number[]>;
const mergeOpenNavs = (objectOne: OpenNavs, objectTwo: OpenNavs) => {
  const result: OpenNavs = {};
  for (const key in objectOne) {
    result[key] = objectOne[key];
  }
  for (const key in objectTwo) {
    if (result[key]) {
      result[key] = uniq(result[key].concat(objectTwo[key]));
    } else {
      result[key] = objectTwo[key];
    }
  }
  return result;
};
const navPinAtom = atomWithStorage<Record<string, OpenNavs>>('navPin', {});
const addPinnedTenant = (
  pinnedTenants: Record<string, OpenNavs>,
  teamId: string | number,
  sbEnvironmentId: string | number,
  edfiTenantId: number
) => {
  const teamIdStr = String(teamId);
  const sbEnvironmentIdStr = String(sbEnvironmentId);
  return {
    ...pinnedTenants,
    [teamIdStr]: {
      ...pinnedTenants[teamIdStr],
      [sbEnvironmentIdStr]: [
        ...(pinnedTenants[teamIdStr]?.[Number(sbEnvironmentIdStr)] || []).filter(
          (id) => id !== edfiTenantId
        ),
        edfiTenantId,
      ],
    },
  };
};
const removePinnedTenant = (
  pinnedTenants: Record<string, OpenNavs>,
  teamId: string | number,
  sbEnvironmentId: string | number,
  edfiTenantId: number
) => {
  const teamIdStr = String(teamId);
  const sbEnvironmentIdStr = String(sbEnvironmentId);
  return {
    ...pinnedTenants,
    [teamIdStr]: {
      ...pinnedTenants[teamIdStr],
      [sbEnvironmentIdStr]: (pinnedTenants[teamIdStr][Number(sbEnvironmentIdStr)] || []).filter(
        (id) => id !== edfiTenantId
      ),
    },
  };
};

export const TeamNav = (props: { teamId: string }) => {
  const paths = usePaths({ asTeam: true });
  const { edfiTenantId, sbEnvironmentId } = useParams();
  const [lastTenantFromNav, setLastTenantFromNav] = useState(
    edfiTenantId ? { [sbEnvironmentId!]: [Number(edfiTenantId)] } : {}
  );
  useEffect(() => {
    if (edfiTenantId) {
      setLastTenantFromNav({ [sbEnvironmentId!]: [Number(edfiTenantId)] });
    }
  }, [edfiTenantId, sbEnvironmentId]);
  useEffect(() => {
    setLastTenantFromNav({});
  }, [props.teamId]);

  const tenantFromNav = edfiTenantId
    ? { [sbEnvironmentId!]: [Number(edfiTenantId)] }
    : lastTenantFromNav;

  const [pinnedTenants, setPinnedTenants] = useAtom(navPinAtom);

  const openNavItems = mergeOpenNavs(tenantFromNav, pinnedTenants[props.teamId] ?? {});

  const teamId = Number(props.teamId);
  const queryClient = useQueryClient();
  const sbEnvironmentAuth: AuthorizeConfig = {
    privilege: 'team.sb-environment:read',
    subject: { id: '__filtered__', teamId },
  };
  const sbEnvironments = useQuery({
    ...sbEnvironmentQueries.getAll({ teamId }),
    enabled: useAuthorize(sbEnvironmentAuth),
  });

  const integrationProviderAuth: AuthorizeConfig = {
    privilege: 'team.integration-provider.application:read',
    subject: { id: '__filtered__', teamId },
  };
  const { data: integrationProviders } = useGetManyIntegrationProviders({
    enabled: useAuthorize(integrationProviderAuth),
  });

  usePrivilegeCacheForConfig([
    sbEnvironmentAuth,
    integrationProviderAuth,
    {
      privilege: 'team.role:read',
      subject: { id: '__filtered__', teamId },
    },
    {
      privilege: 'team.user:read',
      subject: { id: '__filtered__', teamId },
    },
    {
      privilege: 'team.ownership:read',
      subject: { id: '__filtered__', teamId },
    },
    ...Object.entries(openNavItems).flatMap(([sbEnvironmentId, edfiTenantIds]) =>
      edfiTenantIds.flatMap((edfiTenantId) => [
        {
          privilege: 'team.sb-environment.edfi-tenant:read' as const,
          subject: { id: edfiTenantId, sbEnvironmentId: Number(sbEnvironmentId), teamId },
        },
        {
          privilege: 'team.sb-environment.edfi-tenant.ods:read' as const,
          subject: { id: '__filtered__', edfiTenantId, teamId },
        },
        {
          privilege: 'team.sb-environment.edfi-tenant.ods.edorg:read' as const,
          subject: { id: '__filtered__', edfiTenantId, teamId },
        },
        {
          privilege: 'team.sb-environment.edfi-tenant.claimset:read' as const,
          subject: { id: '__filtered__', edfiTenantId, teamId },
        },
        {
          privilege: 'team.sb-environment.edfi-tenant.profile:read' as const,
          subject: { id: '__filtered__', edfiTenantId, teamId },
        },
        {
          privilege: 'team.sb-environment.edfi-tenant.vendor:read' as const,
          subject: { id: '__filtered__', edfiTenantId, teamId },
        },
        {
          privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:read' as const,
          subject: { id: '__filtered__', edfiTenantId, teamId },
        },
      ])
    ),
  ]);

  const envNavList = useQuery(
    teamQueries.navSearchList(
      {
        enabled: useAuthorize(sbEnvironmentAuth),
      },
      { teamId }
    )
  );

  const envNavTenantNams = useMemo(() => {
    const items: Record<number, Record<number, string>> = {};
    Object.entries(envNavList.data || {}).forEach(([_key, value]) => {
      set(items, `${value.sbEnvironmentId}.${value.edfiTenantId}`, value.edfiTenantName);
    });
    return items;
  }, [envNavList.data]);

  const sbEnvironmentItems = sortBy(Object.values(sbEnvironments.data || {}), (sbEnvironment) =>
    sbEnvironment.displayName.toLocaleLowerCase()
  )
    .map((sbEnvironment) => {
      return arrayElemIf(
        authorize({
          queryClient,
          config: {
            privilege: 'team.sb-environment:read',
            subject: { id: sbEnvironment.id, teamId },
          },
        }),
        {
          route: `/as/${teamId}/sb-environments/${sbEnvironment.id}`,
          icon: Icons.SbEnvironment,
          text: sbEnvironment.displayName,
          childItems:
            sbEnvironment.id in openNavItems && sbEnvironment.id in envNavTenantNams
              ? openNavItems[sbEnvironment.id]
                  .reduce((accum, edfiTenantId) => {
                    const loadedEdfiTenantName = envNavTenantNams[sbEnvironment.id][edfiTenantId];

                    if (loadedEdfiTenantName === undefined) {
                      return accum;
                    }
                    const isPinned =
                      pinnedTenants[props.teamId]?.[sbEnvironment.id]?.includes(edfiTenantId);
                    const tenantRootUrl = `/as/${props.teamId}/sb-environments/${sbEnvironment.id}/edfi-tenants/${edfiTenantId}`;
                    const privilegeSubject = {
                      teamId,
                      edfiTenantId,
                      id: '__filtered__',
                    };

                    accum.push({
                      route: `/as/${teamId}/sb-environments/${sbEnvironment.id}/edfi-tenants/${edfiTenantId}`,
                      text: loadedEdfiTenantName,
                      rightElement: (
                        <IconButton
                          onClick={
                            isPinned
                              ? () =>
                                  setPinnedTenants(
                                    removePinnedTenant(
                                      pinnedTenants,
                                      teamId,
                                      sbEnvironment.id,
                                      edfiTenantId
                                    )
                                  )
                              : () =>
                                  setPinnedTenants(
                                    addPinnedTenant(
                                      pinnedTenants,
                                      teamId,
                                      sbEnvironment.id,
                                      edfiTenantId
                                    )
                                  )
                          }
                          pos="absolute"
                          aria-label="pin"
                          title="pin"
                          variant="unstyled"
                          w="20px"
                          h="20px"
                          minH="20px"
                          minW="20px"
                          size="sm"
                          transform="translateX(-150%)"
                          _hover={{
                            bg: 'gray.200',
                          }}
                          css={{
                            svg: {
                              margin: 'auto',
                            },
                          }}
                          icon={<Icons.Pin isFilled={isPinned} />}
                        />
                      ),
                      icon: Icons.EdFiTenant,
                      childItems: [
                        ...arrayElemIf(
                          authorize({
                            queryClient,
                            config: {
                              privilege: 'team.sb-environment.edfi-tenant.ods:read',
                              subject: privilegeSubject,
                            },
                          }),
                          {
                            route: `${tenantRootUrl}/odss`,
                            icon: Icons.ODS,
                            text: 'ODSs',
                          }
                        ),
                        ...arrayElemIf(
                          authorize({
                            queryClient,
                            config: {
                              privilege: 'team.sb-environment.edfi-tenant.ods.edorg:read',
                              subject: privilegeSubject,
                            },
                          }),
                          {
                            route: `${tenantRootUrl}/edorgs`,
                            icon: Icons.EdOrg,
                            text: 'Ed-Orgs',
                          }
                        ),
                        ...arrayElemIf(
                          authorize({
                            queryClient,
                            config: {
                              privilege: 'team.sb-environment.edfi-tenant.vendor:read',
                              subject: privilegeSubject,
                            },
                          }),
                          {
                            route: `${tenantRootUrl}/vendors`,
                            icon: Icons.Vendor,
                            text: 'Vendors',
                          }
                        ),
                        ...arrayElemIf(
                          authorize({
                            queryClient,
                            config: {
                              privilege:
                                'team.sb-environment.edfi-tenant.ods.edorg.application:read',
                              subject: privilegeSubject,
                            },
                          }),
                          {
                            route: `${tenantRootUrl}/applications`,
                            icon: Icons.Application,
                            text: 'Applications',
                          }
                        ),
                        ...arrayElemIf(
                          authorize({
                            queryClient,
                            config: {
                              privilege: 'team.sb-environment.edfi-tenant.claimset:read',
                              subject: privilegeSubject,
                            },
                          }),
                          {
                            route: `${tenantRootUrl}/claimsets`,
                            icon: Icons.Claimset,
                            text: 'Claimsets',
                          }
                        ),
                        ...arrayElemIf(
                          authorize({
                            queryClient,
                            config: {
                              privilege: 'team.sb-environment.edfi-tenant.profile:read',
                              subject: privilegeSubject,
                            },
                          }) && sbEnvironment?.version !== 'v1',
                          {
                            route: `${tenantRootUrl}/profiles`,
                            icon: Icons.Profile,
                            text: 'Profiles',
                          }
                        ),
                      ],
                    });
                    return accum;
                  }, [] as INavButtonProps[])
                  .sort((a, b) => a.text.localeCompare(b.text))
              : undefined,
        }
      );
    })
    .flat();

  const integrationProviderCount = integrationProviders?.length ?? 0;

  const mainItems: INavButtonProps[] = [
    ...arrayElemIf(
      authorize({
        queryClient,
        config: {
          privilege: 'team.user:read',
          subject: { teamId, id: '__filtered__' },
        },
      }),
      {
        route: `/as/${props.teamId}/users`,
        icon: Icons.User,
        text: 'Users',
      }
    ),
    ...arrayElemIf(
      integrationProviderCount > 0 &&
        authorize({
          queryClient,
          config: {
            privilege: 'team.integration-provider.application:read',
            subject: { teamId, id: '__filtered__' },
          },
        }),
      {
        route: paths.integrationProvider.index(),
        icon: Icons.IntegrationProvider,
        text: 'Integration Providers',
      }
    ),
  ];

  const flatten = (item: INavButtonProps): INavButtonProps[] => [
    item,
    ...(item.childItems ?? []).flatMap((ci) => flatten(ci)),
  ];
  const allItemsFlat = [...mainItems, ...sbEnvironmentItems].flatMap((item) => flatten(item));

  const deepestMatch: string | null = findDeepestMatch(useMatches(), allItemsFlat);

  return (
    <>
      <UniversalNavLinks />
      {tagMatch(mainItems, deepestMatch).map((item) => (
        <NavButton key={item.text + item.route} {...item} />
      ))}
      {sbEnvironmentItems.length ? (
        <>
          <Text px={3} mt={4} as="h3" color="gray.600" mb={2} fontWeight="600">
            Environments
          </Text>
          <EnvironmentsNav />
          <Box flexShrink={1} flexGrow={1} flexBasis="0%" overflowY="auto">
            {tagMatch(sbEnvironmentItems, deepestMatch).map((item) => (
              <NavButton key={item.text + item.route} {...item} />
            ))}
          </Box>
        </>
      ) : null}
    </>
  );
};
