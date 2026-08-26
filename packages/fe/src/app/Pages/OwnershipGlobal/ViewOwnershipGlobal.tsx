import { useQuery } from '@tanstack/react-query';
import { AttributeContainer, AttributesGrid, ContentSection } from '@edanalytics/common-ui';
import { useParams } from 'react-router';
import {
  ownershipQueries,
  roleQueries,
  teamQueries,
  sbEnvironmentQueries,
  odsQueries,
  edfiTenantQueriesGlobal,
} from '../../api';
import { EdfiTenantLink, EdorgLink, OdsLink, SbEnvironmentLink, TeamLink } from '../../routes';
import { IntegrationProviderLink } from '../IntegrationProvider/IntegrationProviderLink';
import { RoleGlobalLink } from '../../routes/role-global.routes';
import {
  GetEdfiTenantDto,
  GetEdorgDto,
  GetOdsDto,
  GetOwnershipDto,
  GetSbEnvironmentDto,
} from '@edanalytics/models';
import { NavContextProvider } from '../../helpers';
import { chakra } from '@chakra-ui/react';

export const ViewOwnershipGlobal = () => {
  const { ownershipId: id } = useParams() as {
    ownershipId: string;
  };
  const ownership = useQuery(ownershipQueries.getOne({ id })).data;
  const teams = useQuery(teamQueries.getAll({}));
  const roles = useQuery(roleQueries.getAll({}));

  return ownership ? (
    <ContentSection>
      <AttributesGrid>
        <AttributeContainer label="Team">
          <TeamLink id={ownership.teamId} query={teams} />
        </AttributeContainer>
        <AttributeContainer label="Role">
          <RoleGlobalLink id={ownership.roleId} query={roles} />
        </AttributeContainer>
        <AttributeContainer label="Resource">
          <OwnershipResourceLink ownership={ownership} />
        </AttributeContainer>
      </AttributesGrid>
    </ContentSection>
  ) : null;
};

export const OwnershipResourceLink = ({ ownership }: { ownership: GetOwnershipDto }) => {
  return ownership.edorg ? (
    <EdorgGlobalLink teamId={ownership.teamId} edorg={ownership.edorg} />
  ) : ownership.ods ? (
    <OdsGlobalLink teamId={ownership.teamId} ods={ownership.ods} />
  ) : ownership.edfiTenant ? (
    <EdfiTenantGlobalLink teamId={ownership.teamId} edfiTenant={ownership.edfiTenant} />
  ) : ownership.sbEnvironment ? (
    <SbEnvironmentGlobalLink teamId={ownership.teamId} sbEnvironment={ownership.sbEnvironment} />
  ) : ownership.integrationProvider ? (
    <IntegrationProviderLink id={ownership.integrationProvider.id} prefix="Integration Provider:" />
  ) : (
    <>-</>
  );
};

const EdorgGlobalLink = (props: { edorg: GetEdorgDto; teamId: number }) => {
  const sbEnvironment = useQuery(
    sbEnvironmentQueries.getOne({
      id: props.edorg.sbEnvironmentId,
    })
  ).data;
  const edfiTenant = useQuery(
    edfiTenantQueriesGlobal.getOne({
      id: props.edorg.edfiTenantId,
      sbEnvironmentId: props.edorg.sbEnvironmentId,
    })
  ).data;

  const ods = useQuery(
    odsQueries.getOne({
      id: props.edorg.odsId,
      edfiTenant: edfiTenant!,
      enabled: !!edfiTenant,
    })
  ).data;

  return (
    <NavContextProvider
      asId={props.teamId}
      sbEnvironmentId={props.edorg.sbEnvironmentId}
      edfiTenantId={props.edorg.edfiTenantId}
      awaitLoad
    >
      <span>
        <SbEnvironmentLink
          id={props.edorg.sbEnvironmentId}
          query={{ data: { [props.edorg.sbEnvironmentId]: sbEnvironment! } }}
        />
        <br />
        <chakra.span color="gray.400" ml="1em">
          &#8627;
        </chakra.span>
        &nbsp;
        <EdfiTenantLink
          id={props.edorg.edfiTenantId}
          query={{ data: { [props.edorg.edfiTenantId]: edfiTenant! } }}
        />
        <br />
        <chakra.span color="gray.400" ml="2em">
          &#8627;
        </chakra.span>
        &nbsp;
        {ods ? (
          <OdsLink id={props.edorg.odsId} query={{ data: { [ods.id]: ods } }} />
        ) : (
          'loading...'
        )}
        <br />
        <chakra.span color="gray.400" ml="3em">
          &#8627;
        </chakra.span>
        &nbsp;
        <EdorgLink id={props.edorg.id} query={{ data: { [props.edorg.id]: props.edorg } }} />
      </span>
    </NavContextProvider>
  );
};
const OdsGlobalLink = (props: { ods: GetOdsDto; teamId: number }) => {
  const sbEnvironment = useQuery(
    sbEnvironmentQueries.getOne({
      id: props.ods.sbEnvironmentId,
    })
  ).data;
  const edfiTenant = useQuery(
    edfiTenantQueriesGlobal.getOne({
      id: props.ods.edfiTenantId,
      sbEnvironmentId: props.ods.sbEnvironmentId,
    })
  ).data;
  return (
    <NavContextProvider
      asId={props.teamId}
      sbEnvironmentId={props.ods.sbEnvironmentId}
      edfiTenantId={props.ods.edfiTenantId}
      awaitLoad
    >
      <span>
        <SbEnvironmentLink
          id={props.ods.sbEnvironmentId}
          query={{ data: { [props.ods.sbEnvironmentId]: sbEnvironment! } }}
        />
        <br />
        <chakra.span color="gray.400" ml="1em">
          &#8627;
        </chakra.span>
        &nbsp;
        <EdfiTenantLink
          id={props.ods.edfiTenantId}
          query={{ data: { [props.ods.edfiTenantId]: edfiTenant! } }}
        />
        <br />
        <chakra.span color="gray.400" ml="2em">
          &#8627;
        </chakra.span>
        &nbsp;
        <OdsLink id={props.ods.id} query={{ data: { [props.ods.id]: props.ods } }} />
      </span>
    </NavContextProvider>
  );
};
const EdfiTenantGlobalLink = (props: { edfiTenant: GetEdfiTenantDto; teamId: number }) => {
  const sbEnvironment = useQuery(
    sbEnvironmentQueries.getOne({
      id: props.edfiTenant.sbEnvironmentId,
      // teamId: props.teamId,
    })
  ).data;
  return (
    <NavContextProvider
      asId={props.teamId}
      sbEnvironmentId={props.edfiTenant.sbEnvironmentId}
      awaitLoad
    >
      <span>
        <SbEnvironmentLink
          id={props.edfiTenant.sbEnvironmentId}
          query={{ data: { [props.edfiTenant.sbEnvironmentId]: sbEnvironment! } }}
        />
        <br />
        <chakra.span color="gray.400" ml="1em">
          &#8627;
        </chakra.span>
        &nbsp;
        <EdfiTenantLink
          id={props.edfiTenant.id}
          query={{ data: { [props.edfiTenant.id]: props.edfiTenant } }}
        />
      </span>
    </NavContextProvider>
  );
};
const SbEnvironmentGlobalLink = (props: { sbEnvironment: GetSbEnvironmentDto; teamId: number }) => {
  return (
    <NavContextProvider asId={props.teamId} awaitLoad>
      <SbEnvironmentLink
        id={props.sbEnvironment.id}
        query={{ data: { [props.sbEnvironment.id]: props.sbEnvironment } }}
      />
    </NavContextProvider>
  );
};
