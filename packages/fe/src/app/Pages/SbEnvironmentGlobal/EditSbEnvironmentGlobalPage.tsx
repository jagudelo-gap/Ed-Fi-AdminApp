import React from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Text,
  Tooltip,
  chakra,
} from '@chakra-ui/react';
import { Icons, PageTemplate } from '@edanalytics/common-ui';
import { PutSbEnvironmentDto, PostSbEnvironmentTenantDTO } from '@edanalytics/models';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { sbEnvironmentQueriesGlobal, sbEnvironmentQueries } from '../../api';
import { useNavToParent } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { EditTenantManagementSection } from './EditTenantManagementSection';
import { isFormValidationError } from '@edanalytics/utils';

// URL normalization utility for consistent handling
const normalizeUrl = (url: string): string => {
  if (!url) return '';

  const trimmed = url.trim();
  if (!trimmed) return '';

  // Remove trailing slashes for consistency
  return trimmed.replace(/\/+$/, '');
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transformEnvironmentToFormData = (sbEnvironment: any): PutSbEnvironmentDto => {
  // Transform the environment data from the API into the form structure
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenants = sbEnvironment.edfiTenants?.map((tenant: any) => ({
    id: tenant.id, // Preserve tenant ID for stable keys
    name: tenant.name || tenant.displayName,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    odss: tenant.odss?.map((ods: any) => ({
      id: ods.id,
      name: ods.name,
      dbName: ods.dbName,
      allowedEdOrgs: typeof ods.allowedEdOrgs === 'string' ? ods.allowedEdOrgs : (ods.allowedEdOrgs || '').toString(),
    })) || [],
  })) || [];

  return {
    name: sbEnvironment.name,
    odsApiDiscoveryUrl: sbEnvironment.domain,
    adminApiUrl: sbEnvironment.adminApiUrl,
    environmentLabel: sbEnvironment.envLabel,
    isMultitenant: sbEnvironment.multiTenant,
    tenants,
  } as PutSbEnvironmentDto;
};

export const EditSbEnvironmentGlobalPage = () => {
  const popBanner = usePopBanner();
  const navToParentOptions = useNavToParent();
  const navigate = useNavigate();
  const { sbEnvironmentId } = useParams<{ sbEnvironmentId: string }>();

  // Fetch the current environment data
  const sbEnvironment = useQuery(
    sbEnvironmentQueriesGlobal.getOne({
      id: Number(sbEnvironmentId),
    })
  ).data;

  const putSbEnvironment = sbEnvironmentQueriesGlobal.put({});
  const checkEdFiVersionAndTenantMode = sbEnvironmentQueries.checkEdFiVersionAndTenantMode({});
  const checkAdminApiUrl = sbEnvironmentQueries.validateAdminApiUrl({});

  const {
    register,
    setError,
    handleSubmit,
    setValue,
    watch,
    getValues,
    clearErrors,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PutSbEnvironmentDto>({
    defaultValues: {
      name: '',
      odsApiDiscoveryUrl: '',
      adminApiUrl: '',
      environmentLabel: '',
      isMultitenant: false,
      tenants: [],
    },
  });

  // Watch form values for reactive updates
  const currentVersion = sbEnvironment?.version; // Read from original data
  const formValues = watch(); // Watch all form values
  const tenants = (formValues.tenants || []) as (PostSbEnvironmentTenantDTO & { id?: number })[];
  const isMultitenant = formValues.isMultitenant || false;
  const originalOdsVersion = sbEnvironment?.odsApiVersion ?? ''; // Store original version for validation

  // Update form when data loads - use reset() for proper form initialization
  React.useEffect(() => {
    if (sbEnvironment) {
      const formData = transformEnvironmentToFormData(sbEnvironment);
      reset(formData);
    }
  }, [sbEnvironment, reset]);

  const validateVersionAndTenantMode = async (odsApiDiscoveryUrl: string): Promise<boolean> => {
    const normalizedUrl = normalizeUrl(odsApiDiscoveryUrl);
    const errorMessage = 'Could not fetch version from API Discovery URL. Please check the URL and try again.';

    if (!sbEnvironment?.startingBlocks && normalizedUrl) {
      try {
        const result = await checkEdFiVersionAndTenantMode.mutateAsync(
          { entity: { odsApiDiscoveryUrl: normalizedUrl, adminApiUrl: getValues('adminApiUrl') }, pathParams: null },
          {
            ...mutationErrCallback({ setFormError: setError, popGlobalBanner: popBanner }),
          }
        );

        if (!result) {
          setError('odsApiDiscoveryUrl', { message: errorMessage });
          return false;
        }

        // Handle the new response structure with version and isMultiTenant
        const response = result as { version: string; isMultiTenant: boolean; odsVersion?: string };
        const version = response.version;
        const isMultiTenant = response.isMultiTenant;
        const odsDetectedVersion = response.odsVersion || '';
        const majorOdsDetectedVersion = odsDetectedVersion.split('.')[0];
        const majorOriginalOdsVersion = (originalOdsVersion ?? '').split('.')[0];

        if (version !== 'v1' && version !== 'v2' && version !== 'v3') {
          setError('odsApiDiscoveryUrl', { message: errorMessage });
          return false;
        }

        // Validate that the version hasn't changed
        if (majorOriginalOdsVersion && majorOriginalOdsVersion !== majorOdsDetectedVersion) {
          setError('odsApiDiscoveryUrl', {
            message: `Version mismatch: This environment was originally ${majorOriginalOdsVersion} but the new URL returns ${majorOdsDetectedVersion}. Version cannot be changed.`,
          });
          return false;
        }

        if (version === 'v2' || version === 'v3') {
          // For v2/v3, validate that tenant mode hasn't changed
          const originalMultiTenant = sbEnvironment?.multiTenant;
          if (originalMultiTenant !== undefined && originalMultiTenant !== isMultiTenant) {
            const originalMode = originalMultiTenant ? 'multi-tenant' : 'single-tenant';
            const newMode = isMultiTenant ? 'multi-tenant' : 'single-tenant';
            setError('odsApiDiscoveryUrl', {
              message: `Tenant mode mismatch: This environment was originally ${originalMode} but the new URL requires ${newMode} mode. Tenant mode cannot be changed after creation.`,
            });
            return false;
          }

          setValue('isMultitenant', isMultiTenant);
        }

        // For v1 or valid v2/v3 checks, clear errors and update form with normalized URL
        clearErrors(['odsApiDiscoveryUrl']);
        setValue('odsApiDiscoveryUrl', normalizedUrl);
        return true;
      } catch (error) {
        if (isFormValidationError(error as Parameters<typeof isFormValidationError>[0])) {
          // Errors are already set in the form
          return false;
        }

        console.error('Error validating Ed-Fi version and tenant mode:', error);
        setError('odsApiDiscoveryUrl', { message: errorMessage });
        return false;
      }
    }

    return true;
  };

  const validateAdminApiUrl = async (adminApiUrl: string): Promise<boolean> => {
    const normalizedUrl = normalizeUrl(adminApiUrl);
    const currentOdsApiUrl = getValues('odsApiDiscoveryUrl');
    const normalizedOdsUrl = normalizeUrl(currentOdsApiUrl || '');
    const errorMessage = 'Management API is not responding. Please check the URL and ensure it is valid.';

    if (!sbEnvironment?.startingBlocks && normalizedUrl) {
      try {
        const result = await checkAdminApiUrl.mutateAsync(
          {
            entity: { adminApiUrl: normalizedUrl, odsApiDiscoveryUrl: normalizedOdsUrl },
            pathParams: null,
          },
          {
            ...mutationErrCallback({ setFormError: setError, popGlobalBanner: popBanner }),
          }
        );

        if (!result) {
          setError('adminApiUrl', { message: errorMessage });
          return false;
        }

        const response = result as { valid: boolean; message: string };
        if (!response.valid) {
          setError('adminApiUrl', { message: response.message || errorMessage });
          return false;
        }

        clearErrors(['adminApiUrl']);
        setValue('adminApiUrl', normalizedUrl);
        return true;
      } catch (error) {
        if (isFormValidationError(error as Parameters<typeof isFormValidationError>[0])) {
          // Errors are already set in the form
          return false;
        }

        setError('adminApiUrl', { message: errorMessage });
        console.error('Error validating Admin API URL:', error);
        return false;
      }
    }

    return true; // No validation needed for Starting Blocks
  };

  // Helper function to validate that the first tenant has at least one ODS instance
  const validateFirstTenantHasOds = (tenants: PostSbEnvironmentTenantDTO[] | undefined): boolean => {
    return Boolean(tenants?.length && tenants[0]?.odss?.length);
  };

  // Manual validation function
  const validateForm = (data: PutSbEnvironmentDto): boolean => {
    let isValid = true;

    // Clear previous errors
    clearErrors();

    // Always validate name
    if (!data.name || data.name.trim() === '') {
      setError('name', { message: 'Name is required' });
      isValid = false;
    }

    // Only validate additional fields for non-Starting Blocks environments
    if (!sbEnvironment?.startingBlocks) {
      // Normalize and validate URLs (basic validation only - detailed validation happens in onSubmit)
      const normalizedOdsUrl = normalizeUrl(data.odsApiDiscoveryUrl || '');
      const normalizedAdminUrl = normalizeUrl(data.adminApiUrl || '');

      if (!normalizedOdsUrl) {
        setError('odsApiDiscoveryUrl', { message: 'Ed-Fi API Discovery URL is required' });
        isValid = false;
      } else {
        // Update form with normalized URL
        setValue('odsApiDiscoveryUrl', normalizedOdsUrl);
      }

      if (!normalizedAdminUrl) {
        setError('adminApiUrl', { message: 'Management API Discovery URL is required' });
        isValid = false;
      } else {
        // Update form with normalized URL
        setValue('adminApiUrl', normalizedAdminUrl);
      }

      if (!data.environmentLabel || data.environmentLabel.trim() === '') {
        setError('environmentLabel', { message: 'Environment Label is required' });
        isValid = false;
      }

      if (currentVersion === 'v1') {
        // v1 is always single-tenant, ensure we have at least one tenant with ODS instances
        if (!validateFirstTenantHasOds(data.tenants)) {
          setError('tenants.0.odss', { message: 'At least one ODS instance is required for v1 deployment' });
          isValid = false;
        }
      }

      // Validate tenant data for v1
      if (currentVersion === 'v1') {
        data.tenants?.forEach((tenant, tenantIndex) => {
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

  const onSubmit = async (data: PutSbEnvironmentDto) => {
    // Manual validation
    if (!validateForm(data)) {
      return;
    }

    // Perform async validations for URLs if they've changed (and we're not in Starting Blocks mode)
    if (!sbEnvironment?.startingBlocks) {
      const normalizedOdsUrl = normalizeUrl(data.odsApiDiscoveryUrl || '');
      const normalizedAdminUrl = normalizeUrl(data.adminApiUrl || '');

      // Check if URLs have changed and validate them
      const odsUrlChanged = normalizedOdsUrl !== sbEnvironment?.domain;
      const adminUrlChanged = normalizedAdminUrl !== sbEnvironment?.adminApiUrl;

      if (odsUrlChanged || adminUrlChanged) {
        try {
          const isValid = await validateVersionAndTenantMode(normalizedOdsUrl);
          if (!isValid) {
            return; // Stop submission if validation failed
          }

          // Validate Admin API URL if changed
          if (adminUrlChanged) {
            const isValid = await validateAdminApiUrl(normalizedAdminUrl);
            if (!isValid) {
              return; // Stop submission if validation failed
            }
          }
        } catch (error) {
          // Validation failed - errors are already set by the validation functions
          console.error('URL validation failed during submission:', error);
          return;
        }
      }
    }

    return putSbEnvironment
      .mutateAsync(
        { entity: { ...data, id: Number(sbEnvironmentId) } },
        {
          onSuccess: (result) => {
            navigate(`/sb-environments/${result.id}`);
            popBanner({
              title: 'Environment updated successfully',
              type: 'Success',
            });
          },
          ...mutationErrCallback({ setFormError: setError, popGlobalBanner: popBanner }),
        }
      )
      .catch((error) => {
        console.error('Error updating environment:', error);
      });
  };

 if (!sbEnvironment) {
    return (
      <PageTemplate title={'Edit Environment'} actions={undefined}>
        <Box w="70%">
          <Text>Loading...</Text>
        </Box>
      </PageTemplate>
    );
  }

  return (
    <PageTemplate title={'Edit Environment'} actions={undefined}>
      <Box w="70%">
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Environment Name (Editable) */}
          <FormControl isInvalid={!!errors.name} mb={4}>
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

          {/* Read-only Environment Information */}
          {!sbEnvironment.startingBlocks && (
            <Box>
              <FormControl isInvalid={!!errors.odsApiDiscoveryUrl} mb={4}>
                <FormLabel>
                  Ed-Fi API Discovery URL{' '}
                  <Tooltip label="The base URL for the ODS/API or DMS" hasArrow>
                    <chakra.span>
                      <Icons.InfoCircle />
                    </chakra.span>
                  </Tooltip>
                </FormLabel>
                <Input
                  {...register('odsApiDiscoveryUrl')}
                  placeholder="https://your-edfi-api-url"
                  onBlur={(e) => {
                    const url = e.target.value;
                    if (url && url.trim() !== '' && !sbEnvironment?.startingBlocks) {
                      // Fire-and-forget validation for immediate feedback
                      validateVersionAndTenantMode(url).catch(console.error);
                    }
                  }}
                />
                <FormErrorMessage>{errors.odsApiDiscoveryUrl?.message}</FormErrorMessage>
                <Text fontSize="sm" color="gray.600" mt={1}>
                  Changing this URL will revalidate the version and tenant mode
                </Text>
              </FormControl>

              <FormControl isInvalid={!!errors.adminApiUrl} mb={4}>
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
                <Input
                  {...register('adminApiUrl')}
                  placeholder="https://your-admin-api-url"
                  onBlur={(e) => {
                    const url = e.target.value;
                    if (url && url.trim() !== '' && !sbEnvironment?.startingBlocks) {
                      // Fire-and-forget validation for immediate feedback
                      validateAdminApiUrl(url).catch(console.error);
                    }
                  }}
                />
                <FormErrorMessage>{errors.adminApiUrl?.message}</FormErrorMessage>
                <Text fontSize="sm" color="gray.600" mt={1}>
                  This URL will be validated when changed
                </Text>
              </FormControl>

              <FormControl isInvalid={!!errors.environmentLabel} mb={4}>
                <FormLabel>
                  Environment Label{' '}
                  <Tooltip label="Examples: Development, Staging, Production" hasArrow>
                    <chakra.span>
                      <Icons.InfoCircle />
                    </chakra.span>
                  </Tooltip>
                </FormLabel>
                <Input
                  {...register('environmentLabel')}
                  placeholder="e.g., Development, Staging, Production"
                />
                <FormErrorMessage>{errors.environmentLabel?.message}</FormErrorMessage>
              </FormControl>

              {/* Version Information */}
              <FormControl mb={4}>
                <FormLabel>
                  API Version{' '}
                  <Tooltip label="The detected Ed-Fi API version (auto-detected)" hasArrow>
                    <chakra.span>
                      <Icons.InfoCircle />
                    </chakra.span>
                  </Tooltip>
                </FormLabel>
                <Text fontSize="md" mb={1}>
                  {sbEnvironment.version || 'Not detected'}
                </Text>
              </FormControl>

              {/* Tenant Mode Information (Read-only) */}
              {(currentVersion === 'v1' || currentVersion === 'v2') && (
                <FormControl mb={4}>
                  <FormLabel>
                    Tenant Mode{' '}
                    <Tooltip label="The tenant mode is determined by the API version and cannot be changed after creation" hasArrow>
                      <chakra.span>
                        <Icons.InfoCircle />
                      </chakra.span>
                    </Tooltip>
                  </FormLabel>
                  <Text fontSize="md" mb={1}>
                    {currentVersion === 'v1'
                      ? "Single-tenant (v1 environments only support single-tenant mode)"
                      : isMultitenant
                        ? "Multi-tenant"
                        : "Single-tenant"}
                  </Text>
                </FormControl>
              )}

              {/* Tenant Management Section */}
              {currentVersion === 'v1' && (
                <Box mb={4}>
                  <EditTenantManagementSection
                    isMultitenant={false}
                    tenants={
                      tenants.length > 0
                        ? tenants
                        : (sbEnvironment ? (transformEnvironmentToFormData(sbEnvironment).tenants || []) : [])
                    }
                    register={register}
                    setValue={setValue}
                    getValues={getValues}
                    errors={errors}
                    clearErrors={clearErrors}
                    setError={setError}
                  />
                </Box>
              )}
            </Box>
          )}

          <ButtonGroup mt={6} colorScheme="primary">
            <Button isLoading={isSubmitting} type="submit">
              Save Changes
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
  );
};
