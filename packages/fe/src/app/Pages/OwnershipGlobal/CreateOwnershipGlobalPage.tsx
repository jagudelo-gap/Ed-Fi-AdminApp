import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  Text,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import {
  GetEdfiTenantDto,
  OWNERSHIP_RESOURCE_TYPE,
  PostOwnershipDto,
  RoleType,
} from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQuery } from '@tanstack/react-query';
import { plainToInstance } from 'class-transformer';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import {
  edfiTenantQueriesGlobal,
  edorgQueries,
  ownershipQueries,
  sbEnvironmentQueries,
  teamQueries,
} from '../../api';
import {
  EdfiTenantNavContextLoader,
  NavContextLoader,
  NavContextProvider,
  SelectEdfiTenant,
  SelectEdorg,
  SelectOds,
  SelectRole,
  SelectSbEnvironment,
  SelectTeam,
  useNavToParent,
} from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { SelectIntegrationProvider } from '../IntegrationProvider/SelectIntegrationProvider';

const resolver = classValidatorResolver(PostOwnershipDto);

const getDefaults = (dict: {
  edfiTenantId?: string;
  integrationProviderId?: string;
  sbEnvironmentId?: string;
  teamId?: string;
  type?: PostOwnershipDto['type'];
}) => {
  return {
    edfiTenantId: 'edfiTenantId' in dict ? Number(dict.edfiTenantId) : undefined,
    integrationProviderId:
      'integrationProviderId' in dict ? Number(dict.integrationProviderId) : undefined,
    sbEnvironmentId: 'sbEnvironmentId' in dict ? Number(dict.sbEnvironmentId) : undefined,
    teamId: 'teamId' in dict ? Number(dict.teamId) : undefined,
    type: 'type' in dict ? dict.type : 'ods',
  };
};

export const CreateOwnershipGlobalPage = () => {
  const navigate = useNavigate();
  const navToParentOptions = useNavToParent();

  const teams = useQuery(teamQueries.getAll({}));
  const sbEnvironments = useQuery(sbEnvironmentQueries.getAll({}));

  const search = useSearchParamsObject(getDefaults);
  const popGlobalBanner = usePopBanner();

  const { mutateAsync: postOwnership } = ownershipQueries.post({});
  const {
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
    setValue,
    watch,
    setError: setFormError,
  } = useForm({
    resolver,
    defaultValues: useMemo(() => Object.assign(new PostOwnershipDto(), search), [search]),
  });

  const [edfiTenantId, integrationProviderId, odsId, sbEnvironmentId, type]: [
    number,
    number,
    number,
    number,
    PostOwnershipDto['type']
  ] = watch(['edfiTenantId', 'integrationProviderId', 'odsId', 'sbEnvironmentId', 'type']);
  const isSbEnvironment = type === OWNERSHIP_RESOURCE_TYPE.sbEnvironment;
  const isEdfiTenant = type === OWNERSHIP_RESOURCE_TYPE.edfiTenant;
  const isOds = type === OWNERSHIP_RESOURCE_TYPE.ods;
  const isEdorg = type === OWNERSHIP_RESOURCE_TYPE.edorg;
  const isIntegrationProvider = type === OWNERSHIP_RESOURCE_TYPE.integrationProvider;

  const { data: edfiTenant } = useQuery(
    edfiTenantQueriesGlobal.getOne({
      id: edfiTenantId,
      sbEnvironmentId: sbEnvironmentId,
      enabled: !!edfiTenantId,
    })
  );

  const edorgs = useQuery(
    edorgQueries.getAll({
      edfiTenant: edfiTenant || ({} as GetEdfiTenantDto),
      enabled: !!edfiTenant?.id,
    })
  );

  const filteredEdorgOptions = useMemo(() => {
    const filteredEdorgs = { ...edorgs.data };
    return Object.fromEntries(
      Object.entries(filteredEdorgs)
        .filter(([_key, v]) => v.odsId === Number(odsId))
        .map(([_key, v]) => [
          v.id,
          {
            value: v.id,
            label: v.displayName,
            subLabel: `${v.educationOrganizationId} ${v.discriminatorShort}`,
            discriminator: v.discriminator,
          },
        ])
    );
  }, [edorgs, odsId]);

  const onSubmit = async (data: PostOwnershipDto) => {
    const body = plainToInstance(PostOwnershipDto, data);
    if (type !== OWNERSHIP_RESOURCE_TYPE.edfiTenant) {
      body.edfiTenantId = undefined;
    }
    if (type !== OWNERSHIP_RESOURCE_TYPE.ods) {
      body.odsId = undefined;
    }
    if (type !== OWNERSHIP_RESOURCE_TYPE.sbEnvironment) {
      body.sbEnvironmentId = undefined;
    }
    if (type !== OWNERSHIP_RESOURCE_TYPE.edorg) {
      body.edorgId = undefined;
    }
    if (type !== OWNERSHIP_RESOURCE_TYPE.integrationProvider) {
      body.integrationProviderId = undefined;
    }
    return postOwnership(
      { entity: body },
      {
        ...mutationErrCallback({ setFormError, popGlobalBanner }),
        onSuccess: (result) => navigate(`/ownerships/${result.id}`),
      }
      // error already handled by mutationErrCallback's onError above
    ).catch(() => undefined);
  };

  return teams.data && sbEnvironments.data ? (
    <PageTemplate title={'Grant new resource ownership'} actions={undefined}>
      <Box maxW="form-width">
        <FormLabel>Resource type</FormLabel>
        <RadioGroup
          onChange={(value: PostOwnershipDto['type']) => {
            setValue('type', value);
            // Integration Provider is independent, so it's reset for all types
            setValue('integrationProviderId', undefined);

            if (value === OWNERSHIP_RESOURCE_TYPE.sbEnvironment) {
              setValue('edfiTenantId', undefined);
              setValue('edorgId', undefined);
              setValue('odsId', undefined);
            }
            if (value === OWNERSHIP_RESOURCE_TYPE.edfiTenant) {
              setValue('edorgId', undefined);
              setValue('odsId', undefined);
            }
            if (value === OWNERSHIP_RESOURCE_TYPE.ods) {
              setValue('edorgId', undefined);
            }
            if (value === OWNERSHIP_RESOURCE_TYPE.edorg) {
              setValue('odsId', undefined);
            }

            if (value === OWNERSHIP_RESOURCE_TYPE.integrationProvider) {
              setValue('edfiTenantId', undefined);
              setValue('edorgId', undefined);
              setValue('odsId', undefined);
              setValue('sbEnvironmentId', undefined);
            }
          }}
          value={type}
        >
          <Stack direction="column" pl="1em" spacing={1}>
            <Radio value={OWNERSHIP_RESOURCE_TYPE.edorg}>Ed-Org</Radio>
            <Radio value={OWNERSHIP_RESOURCE_TYPE.ods}>Ods</Radio>
            <Radio value={OWNERSHIP_RESOURCE_TYPE.edfiTenant}>Tenant</Radio>
            <Radio value={OWNERSHIP_RESOURCE_TYPE.sbEnvironment}>Whole environment</Radio>
            <Radio value={OWNERSHIP_RESOURCE_TYPE.integrationProvider}>Integration provider</Radio>
          </Stack>
        </RadioGroup>

        <form onSubmit={handleSubmit(onSubmit)}>
          {(isSbEnvironment || isOds || isEdorg || isEdfiTenant) && (
            <FormControl
              isInvalid={!!errors.hasResource && (sbEnvironmentId === undefined || isSbEnvironment)}
            >
              <FormLabel>Environment</FormLabel>
              <SelectSbEnvironment
                // @ts-expect-error onchange
                onChange={(value: number) => {
                  setValue('sbEnvironmentId', value);
                  setValue('edfiTenantId', undefined);
                }}
                name="sbEnvironmentId"
                control={control}
              />
              <FormErrorMessage>{errors.hasResource?.message}</FormErrorMessage>
            </FormControl>
          )}

          {type !== undefined && !isSbEnvironment && typeof sbEnvironmentId === 'number' && (
            <NavContextProvider sbEnvironmentId={sbEnvironmentId}>
              <NavContextLoader fallback={null}>
                <FormControl
                  isInvalid={
                    !!errors.hasResource && (typeof edfiTenantId !== 'number' || isEdfiTenant)
                  }
                >
                  <FormLabel>Tenant</FormLabel>
                  <SelectEdfiTenant autoSelectOnly name="edfiTenantId" control={control} />
                  <FormErrorMessage>{errors.hasResource?.message}</FormErrorMessage>
                </FormControl>

                {(isOds || isEdorg) && typeof edfiTenantId === 'number' ? (
                  <NavContextProvider edfiTenantId={edfiTenantId}>
                    <EdfiTenantNavContextLoader fallback={null}>
                      {isOds && (
                        <FormControl isInvalid={!!errors.hasResource}>
                          <FormLabel>ODS</FormLabel>
                          <SelectOds control={control} name="odsId" useDbName={false} />
                          <FormErrorMessage>{errors.hasResource?.message}</FormErrorMessage>
                        </FormControl>
                      )}

                      {isEdorg && (
                        <>
                          <FormControl isInvalid={!!errors.hasResource}>
                            <FormLabel>ODS</FormLabel>
                            <SelectOds control={control} name="odsId" useDbName={false} />
                            <FormErrorMessage>{errors.hasResource?.message}</FormErrorMessage>
                          </FormControl>
                          <FormControl isInvalid={!!errors.hasResource}>
                            <FormLabel>Ed-Org</FormLabel>
                            <SelectEdorg
                              isDisabled={!odsId}
                              options={filteredEdorgOptions}
                              control={control}
                              name="edorgId"
                              useEdorgId={false}
                            />
                            <FormErrorMessage>{errors.hasResource?.message}</FormErrorMessage>
                          </FormControl>
                        </>
                      )}
                    </EdfiTenantNavContextLoader>
                  </NavContextProvider>
                ) : null}
              </NavContextLoader>
            </NavContextProvider>
          )}

          {isIntegrationProvider && (
            <FormControl
              isInvalid={
                !!errors.hasResource &&
                (integrationProviderId === undefined || isIntegrationProvider)
              }
            >
              <FormLabel>Integration Provider</FormLabel>
              <SelectIntegrationProvider name="integrationProviderId" control={control} />
              <FormErrorMessage>{errors.hasResource?.message}</FormErrorMessage>
            </FormControl>
          )}

          <FormControl isInvalid={!!errors.teamId}>
            <FormLabel>Team</FormLabel>
            <SelectTeam name="teamId" control={control} />
            <FormErrorMessage>{errors.teamId?.message}</FormErrorMessage>
          </FormControl>

          <FormControl isInvalid={!!errors.roleId}>
            <FormLabel>Role</FormLabel>
            <SelectRole
              name="roleId"
              types={[RoleType.ResourceOwnership]}
              control={control}
              isClearable
            />
            <FormErrorMessage>{errors.roleId?.message}</FormErrorMessage>
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
        </form>
      </Box>
    </PageTemplate>
  ) : null;
};
