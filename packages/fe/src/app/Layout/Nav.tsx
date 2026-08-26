import { Box, Menu, Text, useBoolean } from '@chakra-ui/react';
import { GetTeamDto } from '@edanalytics/models';
import { useQueryClient } from '@tanstack/react-query';
import { Select } from 'chakra-react-select';
import { atom, useAtom, useAtomValue } from 'jotai';
import Cookies from 'js-cookie';
import { Resizable } from 're-resizable';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useMatches, useNavigate, useParams } from 'react-router';
import { useMyTeams } from '../api';
import {
  NavContextProvider,
  authCacheKey,
  authorize,
  globalEdfiTenantAuthConfig,
  globalOwnershipAuthConfig,
  globalTeamAuthConfig,
  globalUserAuthConfig,
  usePrivilegeCacheForConfig,
} from '../helpers';
import { GlobalNav } from './GlobalNav';
import { TeamNav } from './TeamNav';

const parseDefaultTeam = (defaultTeam: string | undefined) => {
  const num = Number(defaultTeam);
  return !isNaN(num) ? num : undefined;
};

export const asteamIdAtom = atom<number | undefined>(undefined);

export const useAsId = () => {
  const params = useParams() as { asId?: string };
  const atomValue = useAtomValue(asteamIdAtom);

  return params.asId ? Number(params.asId) : atomValue;
};

export const Nav = () => {
  const [isResizing, setIsResizing] = useBoolean(false);

  const teams = useMyTeams();
  const queryClient = useQueryClient();
  const globalAuthConfigs = [
    globalTeamAuthConfig('team:read')!,
    globalOwnershipAuthConfig('ownership:read')!,
    globalUserAuthConfig('user:read')!,
    globalEdfiTenantAuthConfig('__filtered__', 'sb-environment.edfi-tenant:read')!,
  ];
  usePrivilegeCacheForConfig(globalAuthConfigs);

  const hasGlobalPrivileges = globalAuthConfigs.some((config) =>
    authorize({
      queryClient,
      config,
    })
  )
    ? true
    : // global auth cache in particular
    queryClient.getQueryState(authCacheKey({ teamId: undefined, edfiTenantId: undefined }))
        ?.status === 'success'
    ? false
    : // not done loading yet
      undefined;

  return (
    <Box
      pb={3}
      pt={8}
      flex="0 0 20em"
      bg="foreground-bg"
      enable={{ right: true }}
      defaultSize={{ width: '15em', height: '100%' }}
      onResizeStart={setIsResizing.on}
      onResizeStop={setIsResizing.off}
      borderRightWidth={isResizing ? '3px' : undefined}
      borderRightColor={isResizing ? 'primary.500' : undefined}
      minWidth="11em"
      maxWidth="min(40em, 80%)"
      as={Resizable}
      display="flex"
      flexDir="column"
    >
      {teams.data && hasGlobalPrivileges !== undefined ? (
        <NavContent teams={teams.data} hasGlobalPrivileges={hasGlobalPrivileges} />
      ) : (
        <Text px={3}>...Loading</Text>
      )}
    </Box>
  );
};

const NavContent = ({
  teams,
  hasGlobalPrivileges,
}: {
  teams: Record<GetTeamDto['id'], GetTeamDto>;
  hasGlobalPrivileges: boolean;
}) => {
  const params = useParams() as { asId?: string };

  const defaultTeam = parseDefaultTeam(params?.asId ?? Cookies.get('defaultTeam'));

  const [teamId, _setteamId] = useAtom(asteamIdAtom);
  const currentMatches = useMatches();
  const location = useLocation();
  const switchingToGlobalRef = useRef(false);

  const navigate = useNavigate();

  const selectedTeam = teamId === undefined ? undefined : teams?.[teamId];
  const teamsCount = Object.keys(teams).length;
  const firstteamId: string | undefined = Object.keys(teams)?.[0];

  const setteamId = useMemo(() => {
    return (newteamId: number | undefined) => {
      let realNewValue: number | undefined;
      if (newteamId === undefined) {
        switchingToGlobalRef.current = true;
        if (params.asId) {
          navigate('/');
        }
        realNewValue = undefined;
      } else {
        switchingToGlobalRef.current = false;
        if (newteamId in teams) {
          realNewValue = newteamId;
          if (params.asId !== String(newteamId) && location.pathname !== '/account') {
            navigate(`/as/${newteamId}`);
          }
        } else {
          if (params.asId) {
            navigate('/');
          }
          realNewValue = undefined;
        }
      }
      _setteamId(realNewValue);
      Cookies.set('defaultTeam', String(realNewValue));
    };
  }, [_setteamId, teams, params, navigate, location.pathname]);

  // Set to default teamId from cookie if appropriate
  const setTeamIdToDefault = useCallback(() => {
    // TODO this should likely be switched to useEffectEvent when that comes out, fixing lint disablement below.
    if (
      defaultTeam !== undefined &&
      defaultTeam in teams && // you might no longer have access to this team
      teamId === undefined &&
      location.pathname === '/' // if on a real global-context route don't override it. Only for root route.
    ) {
      setteamId(defaultTeam);
    }
  }, [defaultTeam, teams, teamId, location.pathname, setteamId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(setTeamIdToDefault, []);

  useEffect(() => {
    if (!params.asId) {
      switchingToGlobalRef.current = false;
    }
  }, [params.asId]);

  useEffect(() => {
    if (switchingToGlobalRef.current && params.asId) {
      return;
    }

    if (
      // if we're on a team route
      params.asId &&
      // and team state isn't synced with it yet
      String(teamId) !== params.asId
    ) {
      // then sync it up
      setteamId(Number(params.asId));
    }
  }, [teamId, currentMatches, setteamId, params.asId]);

  useEffect(() => {
    if (
      // if you only have one team
      teamsCount === 1 &&
      // and you don't have any global privileges
      !hasGlobalPrivileges &&
      // and your team isn't already set
      teamId === undefined
    ) {
      // then set it
      setteamId(Number(firstteamId));
    }
  }, [teamsCount, firstteamId, hasGlobalPrivileges, teamId, setteamId]);

  return (
    <Menu>
      {Object.keys(teams).length > 1 || hasGlobalPrivileges ? (
        <Box mb={7} px={3}>
          <Select
            aria-label="Select a team (or global) context"
            value={
              selectedTeam === undefined
                ? {
                    label: 'No team (global)',
                    value: undefined,
                    styles: {
                      fontWeight: '600',
                      color: 'gray.600',
                      fontSize: 'md',
                    },
                  }
                : {
                    label: selectedTeam.displayName,
                    value: selectedTeam.id,
                  }
            }
            onChange={(option) => {
              const value = option?.value ?? undefined;
              const newteamId = value === undefined ? undefined : Number(value);
              setteamId(newteamId);
            }}
            options={[
              {
                label: 'No team (global)',
                value: undefined,
                styles: {
                  fontWeight: '600',
                  color: 'gray.600',
                  fontSize: 'md',
                },
              },
              ...Object.values(teams)
                .sort((a, b) => Number(a.displayName > b.displayName) - 0.5)
                .map((t) => ({
                  label: t.displayName,
                  value: t.id,
                })),
            ]}
            selectedOptionStyle="check"
            chakraStyles={{
              option: (styles, { data }) => {
                return {
                  ...styles,
                  ...data?.styles,
                };
              },
              singleValue: (styles, { data }) => {
                return {
                  ...styles,
                  ...data?.styles,
                };
              },
              container: (styles) => ({
                ...styles,
                bg: 'transparent',
                borderRadius: 'md',
                zIndex: 3,
              }),
              dropdownIndicator: (styles) => ({
                ...styles,
                bg: 'none',
                width: '1.5em',
              }),
              indicatorSeparator: (styles) => ({
                ...styles,
                borderColor: 'transparent',
              }),
            }}
          />
        </Box>
      ) : null}
      {teamId === undefined ? (
        <GlobalNav />
      ) : (
        <NavContextProvider asId={teamId}>
          <TeamNav teamId={String(teamId)} />
        </NavContextProvider>
      )}
    </Menu>
  );
};
