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
import { GetApplicationDto, GetClaimsetDto, PutApplicationForm } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQuery } from '@tanstack/react-query';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { applicationQueriesV1, claimsetQueriesV1, edorgQueries } from '../../api';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { SelectClaimset, SelectEdorg, SelectVendor } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { Icons } from '@edanalytics/common-ui';

const resolver = classValidatorResolver(PutApplicationForm);

export const EditApplication = (props: {
  application: GetApplicationDto;
  claimset: GetClaimsetDto | undefined;
}) => {
  const { application, claimset } = props;
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const popBanner = usePopBanner();

  const navigate = useNavigate();
  const goToView = () => {
    navigate(
      `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/applications/${application.id}`
    );
  };
  const edorgs = useQuery(
    edorgQueries.getAll({
      edfiTenant,
      teamId,
    })
  );

  const claimsets = useQuery(
    claimsetQueriesV1.getAll({
      edfiTenant,
      teamId,
    })
  );

  const putApplication = applicationQueriesV1.put({
    edfiTenant,
    teamId,
  });

  const defaultValues = new PutApplicationForm();
  defaultValues.applicationId = application.applicationId;
  defaultValues.applicationName = application.displayName;
  defaultValues.claimsetId = claimset?.id as number;
  defaultValues.educationOrganizationId = application._educationOrganizationIds[0];
  defaultValues.vendorId = application.vendorId;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
    setError,
  } = useForm<PutApplicationForm>({
    resolver,
    defaultValues,
  });
  return edorgs.data && claimsets.data ? (
    <form
      onSubmit={handleSubmit((data) =>
        putApplication
          .mutateAsync(
            { entity: data },
            {
              onSuccess: goToView,
              ...mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError }),
            }
          )
          .catch(noop)
      )}
    >
      <Box width="30em">
        <FormControl isInvalid={!!errors.applicationName}>
          <FormLabel>Application name</FormLabel>
          <Input {...register('applicationName')} placeholder="name" />
          <FormErrorMessage>{errors.applicationName?.message}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.educationOrganizationId}>
          <FormLabel>Ed-org</FormLabel>
          <SelectEdorg name="educationOrganizationId" useEdorgId control={control} />
          <FormErrorMessage>{errors.educationOrganizationId?.message}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.vendorId}>
          <FormLabel>Vendor</FormLabel>
          <SelectVendor name="vendorId" control={control} />
          <FormErrorMessage>{errors.vendorId?.message}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.claimsetId}>
          <FormLabel>
            Claimset{' '}
            <Tooltip label="You can only select non-reserved claimsets here." hasArrow>
              <chakra.span>
                <Icons.InfoCircle />
              </chakra.span>
            </Tooltip>
          </FormLabel>
          <SelectClaimset noReserved name="claimsetId" control={control} />
          <FormErrorMessage>{errors.claimsetId?.message}</FormErrorMessage>
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
};
