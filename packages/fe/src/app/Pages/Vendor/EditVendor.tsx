import {
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
import { GetVendorDto, PutVendorDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { vendorQueriesV1 } from '../../api';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { Icons } from '@edanalytics/common-ui';

const resolver = classValidatorResolver(PutVendorDto);

export const EditVendor = (props: { vendor: GetVendorDto }) => {
  const popBanner = usePopBanner();

  const navigate = useNavigate();
  const params = useParams() as {
    vendorId: string;
  };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const goToView = () =>
    navigate(
      `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/vendors/${params.vendorId}`
    );
  const putVendor = vendorQueriesV1.put({
    edfiTenant,
    teamId,
  });

  const {
    register,
    setError,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PutVendorDto>({
    resolver,
    defaultValues: Object.assign(new PutVendorDto(), props.vendor),
  });

  return props.vendor ? (
    <chakra.form
      w="form-width"
      onSubmit={handleSubmit((data) =>
        putVendor
          .mutateAsync(
            { entity: data },
            {
              ...mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError }),
              onSuccess: goToView,
            }
          )
          .catch(noop)
      )}
    >
      <FormControl isInvalid={!!errors.company}>
        <FormLabel>Company</FormLabel>
        <Input {...register('company')} />
        <FormErrorMessage>{errors.company?.message}</FormErrorMessage>
      </FormControl>
      <FormControl isInvalid={!!errors.namespacePrefixes}>
        <FormLabel>
          Namespace prefixes{' '}
          <Tooltip
            label="Vendors can be associated with multiple namespaces. Please enter all possible namespace associations for this vendor, separated by commas."
            hasArrow
          >
            <chakra.span>
              <Icons.InfoCircle />
            </chakra.span>
          </Tooltip>
        </FormLabel>
        <Input {...register('namespacePrefixes')} placeholder="uri://ed-fi.org, uri://..." />
        <FormErrorMessage>{errors.namespacePrefixes?.message}</FormErrorMessage>
      </FormControl>
      <FormControl isInvalid={!!errors.contactName}>
        <FormLabel>Contact name</FormLabel>
        <Input {...register('contactName')} />
        <FormErrorMessage>{errors.contactName?.message}</FormErrorMessage>
      </FormControl>
      <FormControl isInvalid={!!errors.contactEmailAddress}>
        <FormLabel>Contact email address</FormLabel>
        <Input {...register('contactEmailAddress')} />
        <FormErrorMessage>{errors.contactEmailAddress?.message}</FormErrorMessage>
      </FormControl>
      <ButtonGroup>
        <Button mt={4} colorScheme="primary" isLoading={isSubmitting} type="submit">
          Save
        </Button>
        <Button
          mt={4}
          colorScheme="primary"
          variant="ghost"
          isLoading={isSubmitting}
          type="reset"
          onClick={goToView}
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
  ) : null;
};
