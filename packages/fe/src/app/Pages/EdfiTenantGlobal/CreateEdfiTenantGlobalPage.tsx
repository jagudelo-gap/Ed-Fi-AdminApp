import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Text,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { PostEdfiTenantDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { edfiTenantQueriesGlobal } from '../../api';
import { useNavToParent, useSbEnvironmentNavContextLoaded } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

const resolver = classValidatorResolver(PostEdfiTenantDto);

export const CreateEdfiTenantGlobalPage = () => {
  const popBanner = usePopBanner();
  const navToParentOptions = useNavToParent();
  const { sbEnvironment } = useSbEnvironmentNavContextLoaded();
  const navigate = useNavigate();
  const postEdfiTenant = edfiTenantQueriesGlobal.post({ sbEnvironmentId: sbEnvironment.id });
  const {
    register,
    setError,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PostEdfiTenantDto>({ resolver });

  return (
    <PageTemplate title={'Create tenant'} actions={undefined}>
      <Box w="form-width">
        <form
          onSubmit={handleSubmit((data) =>
            postEdfiTenant
              .mutateAsync(
                { entity: data },
                {
                  onSuccess: (result) => {
                    navigate(`/sb-environments/${sbEnvironment.id}/edfi-tenants/${result.id}`);
                  },
                  ...mutationErrCallback({ setFormError: setError, popGlobalBanner: popBanner }),
                }
              )
              .catch(noop)
          )}
        >
          <FormControl isRequired isInvalid={!!errors.name}>
            <FormLabel aria-required>Name</FormLabel>
            <Input {...register('name')} placeholder="name" />
            <FormErrorMessage>{errors.name?.message}</FormErrorMessage>
          </FormControl>
          <FormControl isInvalid={!!errors.allowedEdorgs}>
            <FormLabel>Allowed Ed-Orgs</FormLabel>
            <Input {...register('allowedEdorgs')} placeholder="255901, 2559..." />
            <FormErrorMessage>{errors.allowedEdorgs?.message}</FormErrorMessage>
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
  );
};
