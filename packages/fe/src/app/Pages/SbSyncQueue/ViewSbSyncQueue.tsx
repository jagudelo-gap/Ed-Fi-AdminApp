import { Badge, chakra } from '@chakra-ui/react';
import {
  Attribute,
  AttributeContainer,
  AttributesGrid,
  ContentSection,
} from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import {
  edfiTenantQueriesGlobal,
  sbEnvironmentQueriesGlobal,
  sbSyncQueueQueries,
} from '../../api';
import { EdfiTenantGlobalLink, SbEnvironmentGlobalLink } from '../../routes';
import { jobStateColorSchemes } from './SbSyncQueuesPage';
import { stdDuration } from '@edanalytics/utils';

export const ViewSbSyncQueue = () => {
  const params = useParams() as { sbSyncQueueId: string };
  const sbSyncQueue = useQuery(
    sbSyncQueueQueries.getOne({
      id: params.sbSyncQueueId,
    })
  ).data;
  const entity = useQuery(
    sbSyncQueue && sbSyncQueue.edfiTenantId !== null && sbSyncQueue.sbEnvironmentId !== null
      ? (edfiTenantQueriesGlobal.getOne({
          id: sbSyncQueue.edfiTenantId,
          sbEnvironmentId: sbSyncQueue.sbEnvironmentId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any)
      : (sbEnvironmentQueriesGlobal.getOne({
          id: sbSyncQueue?.sbEnvironmentId as number,
          enabled:
            sbSyncQueue?.sbEnvironmentId !== undefined && sbSyncQueue?.sbEnvironmentId !== null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const syntheticQuery = entity.data ? { data: { [entity.data.id]: entity.data } } : ({} as any);

  const output = sbSyncQueue?.output ?? null;
  const stack =
    sbSyncQueue?.output && 'stack' in sbSyncQueue.output ? sbSyncQueue.output.stack ?? null : null;

  return sbSyncQueue ? (
    <>
      <ContentSection>
        <AttributesGrid>
          <Attribute label="Name" value={sbSyncQueue.name} />
          {sbSyncQueue.type === 'EdfiTenant' ? (
            <AttributeContainer label="Tenant">
              <EdfiTenantGlobalLink query={syntheticQuery} id={sbSyncQueue.data?.edfiTenantId} />
            </AttributeContainer>
          ) : sbSyncQueue.type === 'SbEnvironment' ? (
            <AttributeContainer label="Environment">
              <SbEnvironmentGlobalLink
                query={syntheticQuery}
                id={sbSyncQueue.data?.sbEnvironmentId}
              />
            </AttributeContainer>
          ) : null}
          <Attribute label="Created" isDate value={sbSyncQueue.createdon} />
          <Attribute label="Completed" isDate value={sbSyncQueue.completedon} />
          <Attribute
            label="Duration"
            value={
              sbSyncQueue.durationNumber === undefined
                ? undefined
                : stdDuration(sbSyncQueue.durationNumber / 1000)
            }
          />
          <AttributeContainer label="State">
            <Badge colorScheme={jobStateColorSchemes[sbSyncQueue.state]}>{sbSyncQueue.state}</Badge>
          </AttributeContainer>
        </AttributesGrid>
      </ContentSection>
      <ContentSection heading="Output">
        {output ? (
          <chakra.pre fontSize="sm" whiteSpace="break-spaces">
            {JSON.stringify(output, null, 2)}
          </chakra.pre>
        ) : null}
      </ContentSection>
      {stack ? (
        <ContentSection heading="Stack trace">
          <chakra.pre fontSize="sm" whiteSpace="break-spaces">
            {stack as string}
          </chakra.pre>
        </ContentSection>
      ) : null}
    </>
  ) : null;
};
