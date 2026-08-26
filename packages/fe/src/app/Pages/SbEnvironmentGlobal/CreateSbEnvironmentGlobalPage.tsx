import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Text,
  Switch,
  Tooltip,
  chakra,
} from '@chakra-ui/react';
import { Icons, PageTemplate } from '@edanalytics/common-ui';
import { PostSbEnvironmentDto, PostSbEnvironmentTenantDTO } from '@edanalytics/models';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { sbEnvironmentQueries } from '../../api';
import { popSyncBanner, useNavToParent } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { TenantManagementSection } from './TenantManagementSection';

export const CreateSbEnvironmentGlobalPage = () => {
  const popBanner = usePopBanner();
  const navToParentOptions = useNavToParent();
  const navigate = useNavigate();
  const checkEdFiVersionAndTenantMode = sbEnvironmentQueries.checkEdFiVersionAndTenantMode({});
  const checkAdminApiUrl = sbEnvironmentQueries.validateAdminApiUrl({});
  const postSbEnvironment = sbEnvironmentQueries.post({});
  const {
    register,
    setError,
    handleSubmit,
    clearErrors,
    setValue,
    watch,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<PostSbEnvironmentDto>({
    defaultValues: Object.assign(new PostSbEnvironmentDto(), {
      metaArn: undefined,
      version: undefined,
      startingBlocks: false,
      tenants: []
    }),
  });

  // Watch form values
  const isStartingBlocks = watch('startingBlocks');
  const currentVersion = watch('version');
  const tenants = watch('tenants') || [];

  const handleSwitchChange = (checked: boolean) => {
    setValue('startingBlocks', checked);

    // Clear validation errors when switching modes to prevent stale errors
    clearErrors(['metaArn', 'odsApiDiscoveryUrl', 'adminApiUrl', 'environmentLabel', 'edOrgIds', 'tenants']);

    // Clear field values when switching modes to prevent stale data
    if (checked) {
      setValue('odsApiDiscoveryUrl', undefined);
      setValue('adminApiUrl', undefined);
      setValue('environmentLabel', undefined);
      setValue('edOrgIds', '');
      setValue('tenants', []);
    } else {
      setValue('metaArn', undefined);
      setValue('version', undefined);
      setValue('tenants', []);
    }
  };

  const validateVersionAndTenantMode = (odsApiDiscoveryUrl: string) => {
    const errorMessage = 'Could not fetch version from API Discovery URL. Please check the URL and try again.';
    const adminApiUrl = getValues('adminApiUrl');
    if (
      !isStartingBlocks &&
      odsApiDiscoveryUrl &&
      odsApiDiscoveryUrl.trim() !== '' &&
      adminApiUrl &&
      adminApiUrl.trim() !== ''
    ) {
      // To perform the version check
      checkEdFiVersionAndTenantMode.mutateAsync(
        { entity: { odsApiDiscoveryUrl: odsApiDiscoveryUrl, adminApiUrl }, pathParams: null },
        {
          onSuccess: (result) => {
            if (result) {
              // Handle the new response structure with version and isMultiTenant
              const response = result as { version: string; isMultiTenant: boolean; odsVersion?: string };
              const version = response.version;
              const isMultiTenant = response.isMultiTenant;

              if (version === 'v1' || version === 'v2' || version === 'v3') {
                setValue('version', version as 'v1' | 'v2' | 'v3');
                setValue('isMultitenant', isMultiTenant);
                clearErrors(['odsApiDiscoveryUrl']);
              } else {
                setValue('version', undefined);
                setError('odsApiDiscoveryUrl', { message: errorMessage });
              }

              /// Get major version from odsVersion if available and warn if it's less than 6, which is the minimum for Admin API support
              const odsDetectedVersion = response.odsVersion || '';
              const majorOdsDetectedVersion = parseInt(odsDetectedVersion.split('.')[0], 10);

              const incompatibleWithOds =
                (majorOdsDetectedVersion >= 7 && version === 'v1') ||
                (majorOdsDetectedVersion < 7 && (version === 'v2' || version === 'v3'));

              if (incompatibleWithOds) {
                setValue('version', undefined);
                setValue('isMultitenant', false);
                setError('odsApiDiscoveryUrl', {
                  message: `Detected ODS version ${odsDetectedVersion} is not compatible with Admin API version ${version}.`,
                });
                return;
              }
            }
          },
          ...mutationErrCallback({ setFormError: setError, popGlobalBanner: popBanner }),
        }
      );
    };
  }

  const validateAdminApiUrl = (adminApiUrl: string) => {
    if (!isStartingBlocks && adminApiUrl && adminApiUrl.trim() !== '') {
      const currentOdsApiUrl = getValues('odsApiDiscoveryUrl');
      // To validate Admin API URL availability
      checkAdminApiUrl.mutateAsync(
        { entity: { adminApiUrl: adminApiUrl, odsApiDiscoveryUrl: currentOdsApiUrl }, pathParams: null },
        {
          onSuccess: (result) => {
            if (result) {
              const response = result as { valid: boolean; message: string };
              // If valid, just clear any existing errors - no other action needed
              if (response.valid) {
                clearErrors(['adminApiUrl']);
              }
            }
          },
          ...mutationErrCallback({ setFormError: setError, popGlobalBanner: popBanner }),
        }
      );
    };
  }

  // Helper function to validate that the first tenant has at least one ODS instance
  const validateFirstTenantHasOds = (tenants: PostSbEnvironmentTenantDTO[] | undefined): boolean => {
    return Boolean(tenants?.length && tenants[0]?.odss?.length);
  };

  // Manual validation function
  const validateForm = (data: PostSbEnvironmentDto): boolean => {
    let isValid = true;

    // Clear previous errors
    clearErrors();

    // Always validate name
    if (!data.name || data.name.trim() === '') {
      setError('name', { message: 'Name is required' });
      isValid = false;
    }

    if (isStartingBlocks) {
      // Validate Starting Blocks fields
      if (!data.metaArn || data.metaArn.trim() === '') {
        setError('metaArn', { message: 'Metadata ARN is required' });
        isValid = false;
      }
    } else {
      if (!data.odsApiDiscoveryUrl || data.odsApiDiscoveryUrl.trim() === '') {
        setError('odsApiDiscoveryUrl', { message: 'Ed-Fi API Discovery URL is required' });
        isValid = false;
      }
      else {
        const adminApiUrl = data.adminApiUrl?.trim();
        if (!currentVersion && adminApiUrl) {
            validateVersionAndTenantMode(data.odsApiDiscoveryUrl);
        }
      }
      if (!data.adminApiUrl || data.adminApiUrl.trim() === '') {
        setError('adminApiUrl', { message: 'Management API Discovery URL is required' });
        isValid = false;
      }
      if (!data.environmentLabel || data.environmentLabel.trim() === '') {
        setError('environmentLabel', { message: 'Environment Label is required' });
        isValid = false;
      }

      if (currentVersion === 'v1') {
        // v1 is always single-tenant, ensure we have at least one tenant with ODS instances
        if (!validateFirstTenantHasOds(tenants)) {
          setError('tenants.0.odss', { message: 'At least one ODS instance is required for v1 deployment' });
          isValid = false;
        }
      }

      // Validate tenant data for v1
      if (currentVersion === 'v1') {
        tenants.forEach((tenant, tenantIndex) => {
          if (!tenant.name || tenant.name.trim() === '') {
            setError(`tenants.${tenantIndex}.name`, { message: 'Tenant name is required' });
            isValid = false;
          }

          if (!tenant.odss || tenant.odss.length === 0) {
            setError(`tenants.${tenantIndex}.odss`, { message: 'At least one ODS instance is required' });
            isValid = false;
          }

          tenant.odss?.forEach((ods, odsIndex) => {
            if (!ods.name || ods.name.trim() === '') {
              setError(`tenants.${tenantIndex}.odss.${odsIndex}.name`, { message: 'ODS name is required' });
              isValid = false;
            }
            if (!ods.dbName || ods.dbName.trim() === '') {
              setError(`tenants.${tenantIndex}.odss.${odsIndex}.dbName`, { message: 'DB name is required' });
              isValid = false;
            }
            if (!ods.allowedEdOrgs || ods.allowedEdOrgs.trim() === '') {
              setError(`tenants.${tenantIndex}.odss.${odsIndex}.allowedEdOrgs`, { message: 'Education Organization Identifier(s) is required' });
              isValid = false;
            } else {
              // Validate that allowedEdOrgs contains only numbers separated by commas
              const edOrgPattern = /^\s*\d+(\s*,\s*\d+)*\s*$/;
              if (!edOrgPattern.test(ods.allowedEdOrgs.trim())) {
                setError(`tenants.${tenantIndex}.odss.${odsIndex}.allowedEdOrgs`, {
                  message: 'Education Organization Identifier(s) must be numbers separated by commas (e.g., "1, 255901, 25590100")'
                });
                isValid = false;
              }
            }
          });
        });
      }
    }
    return isValid;
  };

  const onSubmit = (data: PostSbEnvironmentDto) => {
    // Manual validation
    if (!validateForm(data)) {
      return;
    }

    // Set the startingBlocks field based on the current mode
    data.startingBlocks = isStartingBlocks;

    return postSbEnvironment
      .mutateAsync(
        { entity: data },
        {
          onSuccess: (result) => {
            navigate(`/sb-environments/${result.id}`);
            if (result.syncQueue) {
              popSyncBanner({
                popBanner,
                syncQueue: result.syncQueue,
              });
            }
          },
          ...mutationErrCallback({ setFormError: setError, popGlobalBanner: popBanner }),
        }
      )
      .catch((error) => {
        console.error('Error creating environment:', error);
      });
  };

  return (
    <PageTemplate title={'Connect new environment'} actions={undefined}>
      <Box w="70%">
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormControl>
            <FormLabel>
              Using Starting Blocks from Education Analytics?{' '}
              <Tooltip
                label="Toggle this switch when you you are using Starting Blocks for your Ed-Fi deployment."
                hasArrow
              >
                <chakra.span>
                  <Icons.InfoCircle />
                </chakra.span>
              </Tooltip>
            </FormLabel>
            <Switch
              size="md"
              colorScheme="primary"
              mb="0"
              {...register('startingBlocks')}
              onChange={(e) => handleSwitchChange(e.target.checked)}
            />
          </FormControl>

          <FormControl isInvalid={!!errors.name}>
            <FormLabel>
              Name{' '}
              <Tooltip label="Provide a unique name for the environment" hasArrow>
                <chakra.span>
                  <Icons.InfoCircle />
                </chakra.span>
              </Tooltip>
            </FormLabel>
            <Input {...register('name')} placeholder="name" />
            <FormErrorMessage>{errors.name?.message}</FormErrorMessage>
          </FormControl>

          {isStartingBlocks ? (
            <FormControl isInvalid={!!errors.metaArn}>
              <FormLabel>Metadata ARN</FormLabel>
              <Input {...register('metaArn')} placeholder="arn:aws:lambda:us..." />
              <FormErrorMessage>{errors.metaArn?.message}</FormErrorMessage>
            </FormControl>
          ) : null}

          {!isStartingBlocks ? (
            <Box>
              <FormControl isInvalid={!!errors.odsApiDiscoveryUrl}>
                <FormLabel>
                  Ed-Fi API Discovery URL{' '}
                  <Tooltip label="The base URL for the ODS/API or DMS" hasArrow>
                    <chakra.span>
                      <Icons.InfoCircle />
                    </chakra.span>
                  </Tooltip>
                </FormLabel>
                <Input {...register('odsApiDiscoveryUrl')} placeholder="https://..."
                  onBlur={async (e) => {
                    const value = e.target.value;
                    setValue('odsApiDiscoveryUrl', value);
                    // Auto-detect version if not Starting Blocks and value is present
                    if (!isStartingBlocks && value.trim() !== '') {
                      validateVersionAndTenantMode(value);
                    }
                  }}
                />
                <FormErrorMessage>{errors.odsApiDiscoveryUrl?.message}</FormErrorMessage>
              </FormControl>
              <FormControl isInvalid={!!errors.adminApiUrl}>
                <FormLabel>
                  Management API Discovery URL{' '}
                  <Tooltip label="The base URL for Admin API or DMS Configuration Service" hasArrow>
                    <chakra.span>
                      <Icons.InfoCircle />
                    </chakra.span>
                  </Tooltip>
                </FormLabel>
                <Text fontSize="sm" color="orange.600" mb={1}>
                    ⚠️ Ensure Management API version and tenant mode are compatible with Ed-Fi API
                </Text>
                <Input {...register('adminApiUrl')} placeholder="https://..."
                  onBlur={async (e) => {
                    const value = e.target.value;
                    setValue('adminApiUrl', value);
                    // Validate API URL if not Starting Blocks and value is present
                    if (!isStartingBlocks && value.trim() !== '') {
                      validateAdminApiUrl(value);

                      const odsApiDiscoveryUrl = getValues('odsApiDiscoveryUrl');
                      if (odsApiDiscoveryUrl?.trim()) {
                        validateVersionAndTenantMode(odsApiDiscoveryUrl);
                      }
                    }
                  }}
                />
                <FormErrorMessage>{errors.adminApiUrl?.message}</FormErrorMessage>
              </FormControl>
              <FormControl isInvalid={!!errors.environmentLabel}>
                <FormLabel>
                  Environment Label{' '}
                  <Tooltip label="Examples: Development, Staging, Production" hasArrow>
                    <chakra.span>
                      <Icons.InfoCircle />
                    </chakra.span>
                  </Tooltip>
                </FormLabel>
                <Input {...register('environmentLabel')} placeholder="production" />
                <FormErrorMessage>{errors.environmentLabel?.message}</FormErrorMessage>
              </FormControl>
              {
                currentVersion === 'v1' ? (
                  <TenantManagementSection
                    isMultitenant={false}
                    tenants={tenants}
                    register={register}
                    setValue={setValue}
                    getValues={getValues}
                    errors={errors}
                    clearErrors={clearErrors}
                    setError={setError}
                  />
                ) : null
              }
            </Box>
          ) : null}
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
      </Box >
    </PageTemplate >
  );
};
