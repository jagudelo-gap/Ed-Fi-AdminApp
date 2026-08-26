import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Text,
  chakra,
} from '@chakra-ui/react';
import {
  GetIntegrationProviderDto,
  PutIntegrationProviderDto,
  PutTeamDto,
} from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQueryClient } from '@tanstack/react-query';
import { usePopBanner } from '../../Layout/FeedbackBanner';

import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { usePaths } from '../../routes/paths';
import {
  QUERY_KEYS,
  useGetOneIntegrationProvider,
  useUpdateIntegrationProvider,
} from '../../api-v2';
import { ContentSection, PageContentCard } from '@edanalytics/common-ui';

const resolver = classValidatorResolver(PutTeamDto);

export const EditIntegrationProviderPage = () => {
  const paths = usePaths();
  const popGlobalBanner = usePopBanner();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { integrationProviderId } = useParams() as { integrationProviderId: string };

  const integrationProvider = useGetOneIntegrationProvider({
    queryArgs: { integrationProviderId },
  }).data as GetIntegrationProviderDto;

  const goToView = () => navigate(paths.integrationProvider.view({ integrationProviderId }));

  const {
    register,
    handleSubmit,
    setError: setFormError,
    formState: { errors, isSubmitting },
  } = useForm<PutIntegrationProviderDto>({ resolver, defaultValues: { ...integrationProvider } });

  const { mutateAsync: updateIntegrationProvider } = useUpdateIntegrationProvider();

  if (!integrationProvider) return null;

  const onSubmit = (data: PutIntegrationProviderDto) => {
    updateIntegrationProvider(data, {
      ...mutationErrCallback({ popGlobalBanner, setFormError }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.integrationProviders] });
        goToView();
      },
    }).catch(() => undefined); // error already handled by mutationErrCallback's onError above
  };

  return (
    <PageContentCard>
      <ContentSection>
        <chakra.form maxW="form-width" onSubmit={handleSubmit(onSubmit)}>
          <FormControl isInvalid={!!errors.name}>
            <FormLabel>Name</FormLabel>
            <Input {...register('name')} placeholder="name" />
            <FormErrorMessage>{errors.name?.message}</FormErrorMessage>
          </FormControl>
          <FormControl isInvalid={!!errors.description}>
            <FormLabel>Description</FormLabel>
            <Input {...register('description')} placeholder="description" />
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
      </ContentSection>
    </PageContentCard>
  );
};
