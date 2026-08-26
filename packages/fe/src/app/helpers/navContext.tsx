import { Spinner } from '@chakra-ui/react';
import { GetEdfiTenantDto, GetSbEnvironmentDto } from '@edanalytics/models';
import { useQuery } from '@tanstack/react-query';
import pick from 'lodash/pick';
import { ReactElement, ReactNode, createContext, useContext } from 'react';
import { edfiTenantQueries, sbEnvironmentQueries } from '../api';

const NavContext = createContext<{
  asId: number | undefined;
  sbEnvironmentId: number | undefined;
  sbEnvironment: GetSbEnvironmentDto | undefined;
  edfiTenantId: number | undefined;
  edfiTenant: GetEdfiTenantDto | undefined;
}>({
  asId: undefined,
  sbEnvironmentId: undefined,
  sbEnvironment: undefined,
  edfiTenantId: undefined,
  edfiTenant: undefined,
});

/**
 * Provide a subtree with an artificial nav context.
 *
 * Many components are built to be used within a team- and/or EdfiTenant-specific
 * context. Most typically this will come from the URL, but it shouldn't have to.
 */
export const NavContextProvider = (props: {
  children: ReactNode;
  /** Override `asId`. Unchanged if omitted (explicit `undefined` does override). */
  asId?: number | undefined;
  /** Override `sbEnvironmentId`. Unchanged if omitted (explicit `undefined` does override). */
  sbEnvironmentId?: number | undefined;
  sbEnvironment?: GetSbEnvironmentDto | undefined;
  /** Override `edfiTenantId`. Unchanged if omitted (explicit `undefined` does override). */
  edfiTenantId?: number | undefined;
  edfiTenant?: GetEdfiTenantDto | undefined;

  awaitLoad?: boolean;
}) => {
  const existingContext = useNavContext();
  const resultingValues = {
    ...existingContext,
    ...pick(props, ['edfiTenantId', 'sbEnvironmentId', 'asId']),
  };
  const edfiTenantLoadEnabled =
    resultingValues.edfiTenantId !== undefined && resultingValues.sbEnvironmentId !== undefined;
  const queriedEdfiTenant = useQuery({
    ...edfiTenantQueries.getOne({
      id: resultingValues.edfiTenantId!,
      sbEnvironmentId: resultingValues.sbEnvironmentId!,
      teamId: resultingValues.asId!,
      enabled: edfiTenantLoadEnabled,
    }),
  });

  const sbEnvironmentLoadEnabled = resultingValues.sbEnvironmentId !== undefined;
  const queriedSbEnvironment = useQuery({
    ...sbEnvironmentQueries.getOne({
      id: resultingValues.sbEnvironmentId!,
      teamId: resultingValues.asId!,
      enabled: sbEnvironmentLoadEnabled,
    }),
  });

  const isLoaded =
    (queriedEdfiTenant.isSuccess || !edfiTenantLoadEnabled) &&
    (queriedSbEnvironment.isSuccess || !sbEnvironmentLoadEnabled);
  const edfiTenant = props.edfiTenant ?? edfiTenantLoadEnabled ? queriedEdfiTenant.data : undefined;
  const sbEnvironment =
    props.sbEnvironment ?? sbEnvironmentLoadEnabled ? queriedSbEnvironment.data : undefined;
  if (sbEnvironment && edfiTenant) {
    edfiTenant.sbEnvironment = sbEnvironment;
  }
  return (
    <NavContext.Provider
      value={{
        ...resultingValues,
        edfiTenant,
        sbEnvironment,
      }}
    >
      {(!props.awaitLoad || isLoaded) && props.children}
    </NavContext.Provider>
  );
};
/**
 * Use nav context.
 *
 * NOTE: do not use router-provided `asId` or `edfiTenantId` directly.
 *
 * Many components are built to be used within a team- and/or EdfiTenant-specific
 * setting. Most typically this will come from the URL, but it shouldn't have to.
 */
export const useTeamEdfiTenantNavContext = () => {
  const context = useContext(NavContext);
  if (
    context.asId === undefined ||
    context.edfiTenantId === undefined ||
    context.sbEnvironmentId === undefined
  ) {
    throw new Error(
      'useTeamEdfiTenantNavContext requires asId, sbEnvironmentId, and edfiTenantId to all be defined'
    );
  }
  return {
    asId: context.asId!,
    teamId: context.asId!,
    sbEnvironmentId: context.sbEnvironmentId!,
    sbEnvironment: context.sbEnvironment,
    edfiTenantId: context.edfiTenantId!,
    edfiTenant: context.edfiTenant,
  };
};
export const useNavContext = () => {
  const navContext = useContext(NavContext);
  return { ...navContext, teamId: navContext.asId };
};

export const useTeamNavContext = () => {
  const navContext = useNavContext();
  if (navContext.asId === undefined) throw new Error('No team context');
  return { asId: navContext.asId, teamId: navContext.asId };
};
export const useTeamSbEnvironmentNavContext = () => {
  const navContext = useNavContext();

  if (navContext.sbEnvironmentId === undefined) throw new Error('No SbEnvironment context');
  if (navContext.teamId === undefined) throw new Error('No Team context');
  return {
    ...navContext,
    asId: navContext.teamId,
    teamId: navContext.teamId,
    sbEnvironmentId: navContext.sbEnvironmentId,
  };
};
export const useTeamSbEnvironmentNavContextLoaded = () => {
  const navContext = useNavContext();
  if (
    navContext.asId === undefined ||
    navContext.sbEnvironment === undefined ||
    navContext.sbEnvironmentId === undefined
  )
    throw new Error('No SbEnvironment context');
  return {
    ...navContext,
    asId: navContext.asId,
    teamId: navContext.asId,
    sbEnvironmentId: navContext.sbEnvironmentId,
    sbEnvironment: navContext.sbEnvironment,
  };
};
export const useSbEnvironmentNavContext = () => {
  const navContext = useNavContext();
  if (navContext.sbEnvironmentId === undefined) throw new Error('No SbEnvironment context');
  return { ...navContext, sbEnvironmentId: navContext.sbEnvironmentId };
};
export const useSbEnvironmentNavContextLoaded = () => {
  const navContext = useNavContext();
  if (navContext.sbEnvironment === undefined || navContext.sbEnvironmentId === undefined)
    throw new Error('No SbEnvironment context');
  return {
    ...navContext,
    sbEnvironmentId: navContext.sbEnvironmentId,
    sbEnvironment: navContext.sbEnvironment,
  };
};
export const useEdfiTenantNavContext = () => {
  const navContext = useNavContext();
  if (navContext.edfiTenantId === undefined || navContext.sbEnvironmentId === undefined)
    throw new Error('No EdfiTenant context');
  return {
    ...navContext,
    edfiTenantId: navContext.edfiTenantId,
    sbEnvironmentId: navContext.sbEnvironmentId,
  };
};

export const useEdfiTenantNavContextLoaded = () => {
  const navContext = useNavContext();
  if (navContext.edfiTenant === undefined || navContext.sbEnvironment === undefined)
    throw new Error('No EdfiTenant context');
  return {
    ...navContext,
    edfiTenantId: navContext.edfiTenantId!,
    edfiTenant: navContext.edfiTenant!,
    sbEnvironmentId: navContext.sbEnvironmentId!,
    sbEnvironment: navContext.sbEnvironment!,
  };
};

export const EdfiTenantNavContextLoader = ({
  children,
  fallback,
}: {
  children?: ReactNode;
  fallback?: ReactNode;
}): ReactElement => {
  const context = useNavContext();

  if (context.edfiTenantId !== undefined && context.edfiTenant === undefined) {
    return <>{fallback !== undefined ? fallback : <Spinner />}</>;
  } else {
    return <>{children ?? null}</>;
  }
};
export const useTeamEdfiTenantNavContextLoaded = () => {
  const navContext = useNavContext();
  if (navContext.edfiTenant === undefined) throw new Error('No edfiTenant context');
  if (navContext.sbEnvironment === undefined) throw new Error('No sbEnvironment context');
  if (navContext.teamId === undefined) throw new Error('No teamId context');
  return {
    edfiTenantId: navContext.edfiTenantId!,
    edfiTenant: navContext.edfiTenant!,
    sbEnvironmentId: navContext.sbEnvironmentId!,
    sbEnvironment: navContext.sbEnvironment!,
    teamId: navContext.teamId!,
    asId: navContext.teamId!,
  };
};

export const NavContextLoader = ({
  children,
  fallback,
}: {
  children?: ReactNode;
  fallback?: ReactNode;
}): ReactElement => {
  const context = useNavContext();
  if (
    (context.sbEnvironmentId !== undefined && context.sbEnvironment === undefined) ||
    (context.edfiTenantId !== undefined && context.edfiTenant === undefined)
  ) {
    return <>{fallback !== undefined ? fallback : <Spinner />}</>;
  } else {
    return <>{children ?? null}</>;
  }
};

export const withLoader = <T extends object>(Component: (props: T) => ReactElement) => {
  return (props: T) => {
    return (
      <NavContextLoader fallback={null}>
        <Component {...props} />
      </NavContextLoader>
    );
  };
};
