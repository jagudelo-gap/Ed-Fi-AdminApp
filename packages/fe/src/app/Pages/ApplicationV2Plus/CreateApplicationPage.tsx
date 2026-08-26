import {
  Box,
  Button,
  ButtonGroup,
  Divider,
  FormControl,
  FormErrorMessage,
  FormLabel,
  IconButton,
  Input,
  ListItem,
  Text,
  Tooltip,
  UnorderedList,
  chakra,
} from '@chakra-ui/react';
import { Icons, PageTemplate } from '@edanalytics/common-ui';
import {
  GetEdorgDto,
  PostApplicationFormDtoV2,
  PostApplicationFormDtoV3,
  edorgKeyV2,
} from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useMemo } from 'react';
import { DefaultValues, Path, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { edorgQueries, profileQueriesV2, odsQueries } from '../../api';
import { odsInstancesV2, dataStoresV3, applicationQueriesV2 } from '../../api/queries/queries.v7';
import {
  getRelationDisplayName,
  useNavToParent,
  useTeamEdfiTenantNavContextLoaded,
} from '../../helpers';
import {
  SelectClaimsetV2,
  SelectEdorg,
  SelectOds,
  SelectProfile,
  SelectVendorV2,
} from '../../helpers/EntitySelectors';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { MutateOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '../../api-v2';
import { useApplicationConfig } from './applicationConfig';
import { useOdsTerminology } from '../Ods/useOdsTerminology';

// Dispatches on the resolved version via `.match()` rather than destructuring
// `useApplicationConfig()` directly, so `CreateApplicationForm`'s generic is
// tied to the actual branch instead of the wider PostApplicationFormDtoV2 |
// V3 union (see the caveat comment in vendorConfig.ts/applicationConfig.ts).
export const CreateApplicationPageV2 = () =>
  useApplicationConfig.match({
    v2: (cfg) => (
      <CreateApplicationForm<PostApplicationFormDtoV2>
        config={cfg}
        odsFieldName="odsInstanceId"
        dataStoreQuery={odsInstancesV2}
      />
    ),
    v3: (cfg) => (
      <CreateApplicationForm<PostApplicationFormDtoV3>
        config={cfg}
        odsFieldName="dataStoreId"
        // dataStoresV3.getAll's TData (GetDataStoreSummaryDtoV3) has the same
        // `id`/`name` fields the reconciliation logic below reads, but isn't
        // structurally identical to odsInstancesV2.getAll's TData
        // (GetOdsInstanceSummaryDtoV2 has `instanceType` instead of
        // `dataStoreType`) — cast through `unknown` since the component only
        // ever reads the fields both share.
        dataStoreQuery={dataStoresV3 as unknown as { getAll: typeof odsInstancesV2.getAll }}
      />
    ),
  });

function CreateApplicationForm<D extends PostApplicationFormDtoV2 | PostApplicationFormDtoV3>(props: {
  // `post`'s entity/options are parameterized by this component's own D
  // rather than pinned to typeof applicationQueriesV2.post: V2's and V3's
  // post() differ in both response DTO (ApplicationResponseV2 vs
  // PostApplicationResponseDtoV3) and request entity (PostApplicationFormDtoV2
  // vs V3), so a type fixed to one branch can't structurally accept the
  // other. `options` is typed via `MutateOptions` (the same type
  // `EntityQueryBuilder.post`'s `UseMutationResult['mutateAsync']` uses
  // under the hood, see builder.ts) parameterized by `D` for TVariables,
  // matching the `{ entity: D }` used for `mutateAsync`'s first argument, so
  // `onSuccess`/`onError` (including the mutationErrCallback(...) spread at
  // the call site below) stay checked without widening to `any`.
  config: {
    queries: {
      post: (
        params: Parameters<typeof applicationQueriesV2.post>[0]
      ) => {
        mutateAsync: (
          args: { entity: D },
          options?: MutateOptions<{ id: number }, unknown, { entity: D }, unknown>
        ) => Promise<{ id: number }>;
      };
    };
    PostFormDto: new () => D;
  };
  odsFieldName: 'odsInstanceId' | 'dataStoreId';
  dataStoreQuery: { getAll: typeof odsInstancesV2.getAll };
}) {
  const { queries, PostFormDto } = props.config;
  const navigate = useNavigate();
  const odsTerminology = useOdsTerminology();
  const { edfiTenantId, asId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const navToParentOptions = useNavToParent();
  const popGlobalBanner = usePopBanner();
  const { mutateAsync: postApplication } = queries.post({ edfiTenant, teamId: asId });
  const edorgs = useQuery(edorgQueries.getAll({ edfiTenant, teamId: asId }));
  const profiles = useQuery(profileQueriesV2.getAll({ edfiTenant, teamId: asId }));
  const appOdsInstances = useQuery(odsQueries.getAll({ teamId: asId, edfiTenant }));
  const odsInstancesAdminApi = useQuery(props.dataStoreQuery.getAll({ edfiTenant, teamId: asId }));
  const { mutateAsync: updateOds } = odsQueries.put({ edfiTenant, teamId: asId });
  const queryClient = useQueryClient();
  const resolver = classValidatorResolver(PostFormDto);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError: setFormError,
    watch,
    setValue,
    control,
  } = useForm<D>({ resolver, defaultValues: new PostFormDto() as DefaultValues<D> });

  // field()/errorMessage() intersection-typed accessors for shared fields,
  // same shape as CreateVendorForm — parameter type is the field-name
  // intersection of both branches (every field here except odsFieldName is
  // identical in name across V2/V3):
  const field = (
    name: keyof PostApplicationFormDtoV2 & keyof PostApplicationFormDtoV3
  ) => name as Path<D>;
  const errorMessage = (
    name: keyof PostApplicationFormDtoV2 & keyof PostApplicationFormDtoV3
  ): string | undefined =>
    (errors as Record<string, { message?: unknown } | undefined>)[name]?.message as string | undefined;
  // Scoped accessor for the one field whose *name* diverges (odsInstanceId
  // vs dataStoreId) — same shape as 527-design.md's v3Field, except this
  // field exists on both branches under a different name, so it's
  // parameterized by props.odsFieldName instead of hardcoded to one branch.
  const odsField = () => props.odsFieldName as Path<D>;
  const odsErrorMessage = (): string | undefined =>
    (errors as Record<string, { message?: unknown } | undefined>)[props.odsFieldName]?.message as
      | string
      | undefined;

  const edorgsByEdorgId = useMemo(
    () => ({
      data: Object.values(edorgs.data ?? {}).reduce<Record<string, GetEdorgDto>>((map, edorg) => {
        map[edorgKeyV2({ edorg: edorg.educationOrganizationId, ods: edorg.odsInstanceId })] = edorg;
        return map;
      }, {}),
    }),
    [edorgs.data]
  );

  const selectedOds = watch(props.odsFieldName as Path<D>) as number;
  const watchedEdorgs = watch('educationOrganizationIds' as Path<D>, [] as never) as number[];
  // useMemo (not `?? []` inline) so `filteredEdorgOptions`'s dependency below
  // doesn't see a fresh array identity on every render when watch()'s
  // default-value fallback isn't honored (e.g. by the test's watch mock).
  const selectedEdorgs = useMemo(() => watchedEdorgs ?? [], [watchedEdorgs]);
  const setSelectedEdorgs = (edorgs: number[]) => setValue('educationOrganizationIds' as Path<D>, edorgs as never);
  const filteredEdorgOptions = useMemo(() => {
    const filteredEdorgs = { ...edorgsByEdorgId.data };
    const selectedEdorgsSet = new Set(selectedEdorgs);

    Object.values(filteredEdorgs || {}).forEach((edorg) => {
      const compositeKey = edorgKeyV2({
        edorg: edorg.educationOrganizationId,
        ods: edorg.odsInstanceId,
      });
      if (
        // selectedEdorgs is relative to selected ODS so don't use composite key redundantly
        selectedEdorgsSet.has(edorg.educationOrganizationId) ||
        selectedOds === undefined ||
        edorg.odsInstanceId !== selectedOds
      ) {
        delete filteredEdorgs[compositeKey];
      }
    });
    return Object.fromEntries(
      Object.entries(filteredEdorgs).map(([, v]) => [
        v.educationOrganizationId,
        {
          value: v.educationOrganizationId,
          label: v.displayName,
          subLabel: `${v.educationOrganizationId} ${v.discriminatorShort}`,
          discriminator: v.discriminator,
        },
      ])
    );
  }, [edorgsByEdorgId, selectedEdorgs, selectedOds]);

  const selectedProfileIds = watch('profileIds' as Path<D>, [] as never) as number[];
  const setSelectedProfiles = (profiles: number[]) => setValue('profileIds' as Path<D>, profiles as never);
  const filteredProfileOptions = useMemo(() => {
    const filteredProfiles = { ...profiles.data };
    const selectedProfiles = new Set(selectedProfileIds);

    Object.values(filteredProfiles || {}).forEach((profile) => {
      if (selectedProfiles.has(profile.id)) {
        delete filteredProfiles[profile.id];
      }
    });
    return Object.fromEntries(
      Object.entries(filteredProfiles).map(([, { id, name }]) => [id, { value: id, label: name }])
    );
  }, [profiles.data, selectedProfileIds]);

  const onSubmit = async (data: D) => {
    // Create a copy of the payload before modifications
    const dataCopy = { ...data } as D;

    if (selectedOds && selectedOds > 0) {
      const selectedAppOdsInstance = Object.values(appOdsInstances.data ?? {}).find(
        (instance) => instance.odsInstanceId === selectedOds
      );

      const selectedAppOdsInstanceName = selectedAppOdsInstance?.odsInstanceName;

      const odsInstanceAdminApi = Object.values(odsInstancesAdminApi.data ?? {}).find(
        (odsInstance) => odsInstance.name.trim() === selectedAppOdsInstanceName?.trim()
      );

      if (!odsInstanceAdminApi) {
        setFormError(odsField(), {
          message: `${odsTerminology.singular} instance "${selectedAppOdsInstanceName}" does not exist in Admin API`,
        });
        return;
      } else {
        // Update the local ODS record with the Admin API ODS instance ID
        if (selectedAppOdsInstance) {
          try {
            await updateOds({
              entity: {
                id: selectedAppOdsInstance.id,
                edfiTenantId: selectedAppOdsInstance.edfiTenantId,
                name: selectedAppOdsInstance.dbName,
                odsInstanceId: odsInstanceAdminApi.id,
              },
            });
          } catch {
            setFormError(odsField(), { message: 'Failed to update ODS instance' });
            return;
          }
        }

        (dataCopy as unknown as Record<string, unknown>)[props.odsFieldName] = odsInstanceAdminApi.id;
      }
    }

    return postApplication(
      { entity: dataCopy },
      {
        onSuccess(response: { id: number }) {
          const dataCopyUntyped = dataCopy as unknown as Record<string, unknown>;
          if (dataCopyUntyped.integrationProviderId) {
            queryClient.invalidateQueries({
              queryKey: [
                QUERY_KEYS.integrationProviders,
                dataCopyUntyped.integrationProviderId,
                QUERY_KEYS.integrationApps,
              ],
            });
          }
          queryClient.invalidateQueries({
            queryKey: [QUERY_KEYS.edfiTenants, edfiTenantId, QUERY_KEYS.applications],
          });
          navigate(
            `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${response.id}`,
            { state: response }
          );
        },
        ...mutationErrCallback({ popGlobalBanner, setFormError }),
      }
    );
  };

  return (
    <PageTemplate title="New application">
      <chakra.form w="form-width" onSubmit={handleSubmit(onSubmit)}>
        <FormControl isInvalid={!!errors.applicationName}>
          <FormLabel>Application name</FormLabel>
          <Input {...register(field('applicationName'))} placeholder="name" />
          <FormErrorMessage>{errorMessage('applicationName')}</FormErrorMessage>
        </FormControl>

        <FormControl isInvalid={!!(errors as Record<string, unknown>)[props.odsFieldName]}>
          <FormLabel>{odsTerminology.singular}</FormLabel>
          <SelectOds
            useInstanceId
            value={selectedOds}
            onChange={(value) => {
              setValue(odsField(), value as never);
              setValue(
                'educationOrganizationIds' as Path<D>,
                selectedEdorgs.filter((edorg) => !!edorgsByEdorgId.data[edorgKeyV2({ edorg, ods: value })]) as never
              );
            }}
          />
          <FormErrorMessage>{odsErrorMessage()}</FormErrorMessage>
        </FormControl>

        <FormControl isInvalid={!!errors.educationOrganizationIds}>
          {selectedEdorgs.length ? (
            <Box my={4}>
              <FormLabel>Ed-orgs</FormLabel>
              <Box ml={4} mb={6}>
                <UnorderedList fontSize="sm">
                  {selectedEdorgs.map((edorgId, i) => (
                    <ListItem key={edorgId}>
                      <Text as="span">
                        {getRelationDisplayName(
                          edorgKeyV2({ edorg: edorgId, ods: selectedOds }),
                          edorgsByEdorgId
                        )}
                      </Text>
                      &nbsp;&nbsp;
                      <IconButton
                        variant="ghost"
                        colorScheme="red"
                        aria-label="remove"
                        icon={<Icons.Delete />}
                        size="xs"
                        onClick={() => {
                          const newSelection = [...selectedEdorgs];
                          newSelection.splice(i, 1);
                          setSelectedEdorgs(newSelection);
                        }}
                      />
                    </ListItem>
                  ))}
                </UnorderedList>

                <FormLabel>Add another</FormLabel>
                <SelectEdorg
                  onChange={(edorgId) => setSelectedEdorgs([...selectedEdorgs, Number(edorgId)])}
                  useEdorgId
                  value={undefined}
                  options={filteredEdorgOptions}
                />
              </Box>
              <Divider mt={6} />
            </Box>
          ) : (
            <>
              <FormLabel>Ed-org</FormLabel>
              <SelectEdorg
                isDisabled={selectedOds === undefined}
                onChange={(edorgId) => setSelectedEdorgs([Number(edorgId)])}
                useEdorgId
                value={undefined}
                options={filteredEdorgOptions}
              />
            </>
          )}
          <FormErrorMessage>{errorMessage('educationOrganizationIds')}</FormErrorMessage>
        </FormControl>

        <FormControl isInvalid={!!errors.vendorId}>
          <FormLabel>Vendor</FormLabel>
          <SelectVendorV2 name={field('vendorId')} control={control} />
          <FormErrorMessage>{errorMessage('vendorId')}</FormErrorMessage>
        </FormControl>

        <FormControl>
          {selectedProfileIds?.length ? (
            <Box my={4}>
              <FormLabel>Profiles</FormLabel>
              <Box ml={4} mb={6}>
                <UnorderedList fontSize="sm">
                  {selectedProfileIds?.map((profileId, i) => (
                    <ListItem key={profileId}>
                      <Text as="span">{profiles.data?.[profileId].name}</Text>
                      &nbsp;&nbsp;
                      <IconButton
                        variant="ghost"
                        colorScheme="red"
                        aria-label="remove"
                        icon={<Icons.Delete />}
                        size="xs"
                        onClick={() => {
                          const newSelection = [...selectedProfileIds];
                          newSelection.splice(i, 1);
                          setSelectedProfiles(newSelection);
                        }}
                      />
                    </ListItem>
                  ))}
                </UnorderedList>

                <FormLabel>Add another</FormLabel>
                <SelectProfile
                  onChange={(profileId) => setSelectedProfiles([...selectedProfileIds, profileId])}
                  value={undefined}
                  options={filteredProfileOptions}
                />
              </Box>
              <Divider mt={6} />
            </Box>
          ) : (
            <>
              <FormLabel>Profile</FormLabel>
              <SelectProfile
                onChange={(profileId) =>
                  setSelectedProfiles([...(selectedProfileIds || []), profileId])
                }
                value={selectedProfileIds?.[0]}
              />
            </>
          )}
        </FormControl>

        {/* <FormControl isInvalid={!!errors.integrationProviderId}>
          <FormLabel>Integration Provider</FormLabel>
          <SelectIntegrationProvider name="integrationProviderId" isClearable control={control} />
          <FormErrorMessage>{errors.integrationProviderId?.message}</FormErrorMessage>
        </FormControl> */}

        <FormControl isInvalid={!!errors.claimsetId}>
          <FormLabel>
            Claimset{' '}
            <Tooltip label="You can only select non-reserved claimsets here." hasArrow>
              <chakra.span>
                <Icons.InfoCircle />
              </chakra.span>
            </Tooltip>
          </FormLabel>
          <SelectClaimsetV2 noReserved name={field('claimsetId')} control={control} />
          <FormErrorMessage>{errorMessage('claimsetId')}</FormErrorMessage>
        </FormControl>

        <ButtonGroup mt={4} colorScheme="primary">
          <Button isLoading={isSubmitting} type="submit">
            Save
          </Button>
          <Button
            variant="ghost"
            isLoading={isSubmitting}
            type="reset"
            onClick={() => {
              navigate(navToParentOptions);
            }}
          >
            Cancel
          </Button>
        </ButtonGroup>
        {errors.root?.message ? (
          <Text mt={4} color="red.500">
            {errors.root?.message}
          </Text>
        ) : null}
      </chakra.form>
    </PageTemplate>
  );
}
