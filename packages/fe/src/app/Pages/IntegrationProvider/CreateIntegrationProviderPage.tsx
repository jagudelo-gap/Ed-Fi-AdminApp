import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Text,
  Textarea,
} from '@chakra-ui/react';
import { useQueryClient } from '@tanstack/react-query';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { PageTemplate } from '@edanalytics/common-ui';
import { PostIntegrationProviderDto } from '@edanalytics/models';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { useNavToParent } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { usePaths } from '../../routes/paths';
import { QUERY_KEYS, useCreateIntegrationProvider } from '../../api-v2';

const resolver = classValidatorResolver(PostIntegrationProviderDto);

export const CreateIntegrationProviderPage = () => {
  const paths = usePaths();
  const popGlobalBanner = usePopBanner();

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const parentPath = useNavToParent();
  const { mutateAsync: createIntegrationProvider } = useCreateIntegrationProvider();

  const {
    register,
    handleSubmit,
    setError: setFormError,
    formState: { errors, isSubmitting },
  } = useForm<PostIntegrationProviderDto>({ resolver, defaultValues: {} });

  const onSubmit = (data: PostIntegrationProviderDto) => {
    createIntegrationProvider(data, {
      ...mutationErrCallback({ popGlobalBanner, setFormError }),
      onSuccess: ({ id: integrationProviderId }) => {
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.integrationProviders] });
        navigate(paths.integrationProvider.view({ integrationProviderId }));
      },
    }).catch(() => undefined); // error already handled by mutationErrCallback's onError above
  };

  return (
    <PageTemplate title="Create Integration Provider">
      <Box w="form-width">
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormControl isInvalid={!!errors.name}>
            <FormLabel>Name</FormLabel>
            <Input {...register('name')} placeholder="name" />
            <FormErrorMessage>{errors.name?.message}</FormErrorMessage>
          </FormControl>
          <FormControl isInvalid={!!errors.description}>
            <FormLabel>Description</FormLabel>
            <Textarea {...register('description')} placeholder="description" size="lg" rows={5} />
            <FormErrorMessage>{errors.description?.message}</FormErrorMessage>
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
