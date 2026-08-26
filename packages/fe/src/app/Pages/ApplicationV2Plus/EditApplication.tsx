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
import {
  GetEdorgDto,
  PutApplicationFormDtoV2,
  PutApplicationFormDtoV3,
  edorgKeyV2,
} from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { MutateOptions, UseQueryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { DefaultValues, Path, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { applicationQueriesV2, edorgQueries, profileQueriesV2, queryKey } from '../../api';
import { getRelationDisplayName, useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import {
  SelectClaimsetV2,
  SelectEdorg,
  SelectOds,
  SelectProfile,
  SelectVendorV2,
} from '../../helpers/EntitySelectors';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { QUERY_KEYS } from '../../api-v2';
import { Icons } from '@edanalytics/common-ui';
import { ApplicationEntity, getDataStoreIds, useApplicationConfig } from './applicationConfig';
import { ClaimsetEntity, useClaimsetConfig } from '../ClaimsetV2Plus/claimsetConfig';
import { useOdsTerminology } from '../Ods/useOdsTerminology';

// Dispatches on the resolved version via `.match()` rather than destructuring
// `useApplicationConfig()` directly, so `EditApplicationForm`'s generic is
// tied to the actual branch instead of the wider PutApplicationFormDtoV2 |
// V3 union (see the caveat comment in vendorConfig.ts/applicationConfig.ts).
export const EditApplication = (props: {
  application: ApplicationEntity;
  claimset: ClaimsetEntity | undefined;
}) =>
  useApplicationConfig.match({
    v2: (cfg) => (
      <EditApplicationForm<PutApplicationFormDtoV2> config={cfg} odsFieldName="odsInstanceId" {...props} />
    ),
    v3: (cfg) => (
      <EditApplicationForm<PutApplicationFormDtoV3> config={cfg} odsFieldName="dataStoreId" {...props} />
    ),
  });

function EditApplicationForm<D extends PutApplicationFormDtoV2 | PutApplicationFormDtoV3>(props: {
  // `put`'s entity/options are parameterized by this component's own D
  // rather than pinned to typeof applicationQueriesV2.put: V2's and V3's
  // put() differ in response DTO (GetApplicationDtoV2 vs GetApplicationDtoV3)
  // and request entity (PutApplicationFormDtoV2 vs V3), so a type fixed to
  // one branch can't structurally accept the other. `options` is typed via
  // `MutateOptions` (the same type `EntityQueryBuilder.put`'s
  // `UseMutationResult['mutateAsync']` uses under the hood, see builder.ts)
  // parameterized by `D` for TVariables, matching the `{ entity: D }` used
  // for `mutateAsync`'s first argument, so `onSuccess`/`onError` (including
  // the mutationErrCallback(...) spread at the call site below) stay checked
  // without widening to `any`. TData is `unknown` since onSuccess here never
  // reads the resolved response.
  config: {
    queries: {
      put: (
        params: Parameters<typeof applicationQueriesV2.put>[0]
      ) => {
        mutateAsync: (
          args: { entity: D },
          options?: MutateOptions<unknown, unknown, { entity: D }, unknown>
        ) => Promise<unknown>;
      };
    };
    PutFormDto: new () => D;
  };
  odsFieldName: 'odsInstanceId' | 'dataStoreId';
  application: ApplicationEntity;
  claimset: ClaimsetEntity | undefined;
}) {
  const { application, claimset } = props;
  const { queries, PutFormDto } = props.config;
  const { edfiTenantId, edfiTenant, teamId } = useTeamEdfiTenantNavContextLoaded();
  const odsTerminology = useOdsTerminology();
  const { queries: claimsetQueries } = useClaimsetConfig();
  const edorgs = useQuery(
    edorgQueries.getAll({
      edfiTenant,
      teamId,
    })
  );
  const profiles = useQuery(profileQueriesV2.getAll({ edfiTenant, teamId }));
  const edorgsByEdorgId = useMemo(() => {
    return {
      data: Object.values(edorgs.data ?? {}).reduce<Record<string, GetEdorgDto>>((map, edorg) => {
        map[edorgKeyV2({ edorg: edorg.educationOrganizationId, ods: edorg.odsInstanceId })] = edorg;
        return map;
      }, {}),
    };
  }, [edorgs.data]);

  // TypeScript cannot resolve union-typed overloaded functions; cast to the
  // actual return type (same pattern as ClaimsetsPage.tsx / ClaimsetPage.tsx).
  const claimsets = useQuery(
    claimsetQueries.getAll({
      edfiTenant,
      teamId,
    }) as UseQueryOptions<Record<string | number, ClaimsetEntity>>
  );

  const { mutateAsync: putApplication } = queries.put({
    edfiTenant,
    teamId,
  });
  const queryClient = useQueryClient();
  const popGlobalBanner = usePopBanner();

  const navigate = useNavigate();
  const goToView = () => {
    navigate(
      `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${application.id}`
    );
  };

  const resolver = classValidatorResolver(PutFormDto);

  const dataStoreIds = getDataStoreIds(application);
  const defaultValues = new PutFormDto();
  defaultValues.id = application.id;
  defaultValues.applicationName = application.applicationName;
  defaultValues.claimsetId = claimset?.id as number;
  defaultValues.profileIds = application.profileIds;
  defaultValues.vendorId = application.vendorId;
  defaultValues.educationOrganizationIds = application.educationOrganizationIds;
  (defaultValues as unknown as Record<string, unknown>)[props.odsFieldName] = dataStoreIds[0];
  // Not registered via FormControl (Integration Provider stays unimplemented
  // for both V2 and V3 editing per this task's scope), but must still flow
  // through as an unregistered defaultValues field so react-hook-form
  // includes it in the submitted data — matching the pre-Task-8 behavior for
  // V2 tenants editing an existing integration application. V3 applications
  // carry this field too (merged server-side, see applicationConfig.ts).
  (defaultValues as unknown as Record<string, unknown>).integrationProviderId =
    application.integrationProviderId;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
    setValue,
    watch,
    setError: setFormError,
  } = useForm<D>({
    resolver,
    defaultValues: defaultValues as DefaultValues<D>,
  });

  // field()/errorMessage() intersection-typed accessors for shared fields,
  // same shape as CreateApplicationForm — parameter type is the field-name
  // intersection of both branches (every field here except odsFieldName is
  // identical in name across V2/V3):
  const field = (
    name: keyof PutApplicationFormDtoV2 & keyof PutApplicationFormDtoV3
  ) => name as Path<D>;
  const errorMessage = (
    name: keyof PutApplicationFormDtoV2 & keyof PutApplicationFormDtoV3
  ): string | undefined =>
    (errors as Record<string, { message?: unknown } | undefined>)[name]?.message as string | undefined;
  // Scoped accessor for the one field whose *name* diverges (odsInstanceId
  // vs dataStoreId) — parameterized by props.odsFieldName instead of
  // hardcoded to one branch.
  const odsField = () => props.odsFieldName as Path<D>;
  const odsErrorMessage = (): string | undefined =>
    (errors as Record<string, { message?: unknown } | undefined>)[props.odsFieldName]?.message as
      | string
      | undefined;

  const selectedEdorgs = watch(field('educationOrganizationIds'), defaultValues.educationOrganizationIds as never) as number[];
  const watchedProfileIds = watch(field('profileIds'), defaultValues.profileIds as never) as number[];
  // Stabilize the array reference so it doesn't change identity on every
  // render (which would otherwise defeat the filteredProfileOptions memo below).
  const selectedProfileIds = useMemo(() => watchedProfileIds || [], [watchedProfileIds]);
  const selectedOds = watch(odsField()) as number;
  const setSelectedEdorgs = (edorgs: number[]) => {
    setValue(field('educationOrganizationIds'), edorgs as never);
  };
  const setSelectedProfiles = (profiles: number[]) => {
    setValue(field('profileIds'), profiles as never);
  };

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
      Object.entries(filteredEdorgs).map(([_compositeKey, v]) => [
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

  const filteredProfileOptions = useMemo(() => {
    const filteredProfiles = { ...profiles.data };
    const selectedProfiles = new Set(selectedProfileIds);

    Object.values(filteredProfiles || {}).forEach((profile) => {
      if (selectedProfiles.has(profile.id)) {
        delete filteredProfiles[profile.id];
      }
    });
    return Object.fromEntries(
      Object.entries(filteredProfiles).map(([, v]) => [v.id, { value: v.id, label: v.name }])
    );
  }, [profiles.data, selectedProfileIds]);

  const onSubmit = async (data: D) => {
    return putApplication(
      { entity: data },
      {
        onSuccess() {
          if (application.integrationProviderId) {
            queryClient.invalidateQueries({
              queryKey: [
                QUERY_KEYS.integrationProviders,
                application.integrationProviderId,
                QUERY_KEYS.integrationApps,
              ],
            });
          }
          queryClient.invalidateQueries({
            queryKey: [QUERY_KEYS.edfiTenants, edfiTenantId, QUERY_KEYS.applications],
          });
          queryClient.invalidateQueries({
            queryKey: queryKey({
              resourceName: 'Claimset',
              teamId: teamId,
              edfiTenantId: edfiTenantId,
            }),
          });
          goToView();
        },
        ...mutationErrCallback({ popGlobalBanner, setFormError }),
      }
      // Errors are already surfaced via mutationErrCallback's onError above;
      // this catch only prevents an unhandled promise rejection.
    ).catch(() => undefined);
  };

  const hasIntegrationProvider = !!application.integrationProviderId;

  return edorgs.data && claimsets.data ? (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Box w="form-width">
        {hasIntegrationProvider && (
          <Text>
            Integration Applications do not allow the editing of:
            <br />
            {odsTerminology.singular}, Ed-orgs, or Integration Providers.
          </Text>
        )}
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
                field('educationOrganizationIds'),
                selectedEdorgs.filter(
                  (edorg) => !!edorgsByEdorgId.data[edorgKeyV2({ edorg, ods: value })]
                ) as never
              );
            }}
            isDisabled={hasIntegrationProvider}
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
                      <Text as="span" mr={2}>
                        {getRelationDisplayName(
                          edorgKeyV2({ edorg: edorgId, ods: selectedOds }),
                          edorgsByEdorgId
                        )}
                      </Text>
                      {!hasIntegrationProvider && (
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
                      )}
                    </ListItem>
                  ))}
                </UnorderedList>
                <FormLabel>Add another</FormLabel>
                <SelectEdorg
                  useEdorgId
                  onChange={(edorgId) => setSelectedEdorgs([...selectedEdorgs, Number(edorgId)])}
                  value={undefined}
                  options={filteredEdorgOptions}
                  isDisabled={hasIntegrationProvider}
                />
              </Box>
              <Divider mt={6} />
            </Box>
          ) : (
            <>
              <FormLabel>Ed-org</FormLabel>
              <SelectEdorg
                useEdorgId
                isDisabled={selectedOds === undefined || hasIntegrationProvider}
                onChange={(edorgId) => setSelectedEdorgs([Number(edorgId)])}
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
          {selectedProfileIds.length ? (
            <Box my={4}>
              <FormLabel>Profiles</FormLabel>
              <Box ml={4} mb={6}>
                <UnorderedList fontSize="sm">
                  {selectedProfileIds?.map((profileId, i) => (
                    <ListItem key={profileId}>
                      <Text as="span" mr={2}>
                        {profiles.data?.[profileId].name}
                      </Text>
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
                onChange={(profileId) => setSelectedProfiles([...selectedProfileIds, profileId])}
                value={selectedProfileIds[0]}
              />
            </>
          )}
        </FormControl>

        {/* <FormControl isInvalid={!!errors.integrationProviderId}>
          <FormLabel>Integration Provider</FormLabel>
          <SelectIntegrationProvider
            name="integrationProviderId"
            control={control}
            isDisabled={hasIntegrationProvider}
            isClearable={!hasIntegrationProvider}
          />
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
          <Button variant="ghost" isLoading={isSubmitting} type="reset" onClick={goToView}>
            Cancel
          </Button>
        </ButtonGroup>
        {errors.root?.message ? (
          <Text mt={4} color="red.500">
            {errors.root?.message}
          </Text>
        ) : null}
      </Box>
    </form>
  ) : null;
}
