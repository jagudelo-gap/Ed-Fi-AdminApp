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
import { PostVendorDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQueryClient } from '@tanstack/react-query';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { vendorQueriesV1 } from '../../api';
import { useNavToParent, useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

const resolver = classValidatorResolver(PostVendorDto);

export const CreateVendor = () => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const popBanner = usePopBanner();

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const goToView = (id: string | number) =>
    navigate(
      `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/vendors/${id}`
    );
  const parentPath = useNavToParent();
  const postVendor = vendorQueriesV1.post({
    edfiTenant,
    teamId,
  });

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PostVendorDto>({ resolver, defaultValues: {} });

  return (
    <PageTemplate constrainWidth title={'Create new vendor'} actions={undefined}>
      <Box w="form-width">
        <form
          onSubmit={handleSubmit((data) =>
            postVendor
              .mutateAsync(
                { entity: data },
                {
                  ...mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError }),
                  onSuccess: (result) => {
                    queryClient.invalidateQueries({ queryKey: ['me', 'vendors'] });
                    goToView(result.id);
                  },
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
              onClick={() => navigate(parentPath)}
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
