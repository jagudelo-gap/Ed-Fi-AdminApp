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
import { PostTeamDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';

import { teamQueries } from '../../api';
import { useNavToParent } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { noop } from '@tanstack/react-table';

const resolver = classValidatorResolver(PostTeamDto);

export const CreateTeam = () => {
  const popBanner = usePopBanner();

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const goToView = (id: string | number) => navigate(`/teams/${id}`);
  const parentPath = useNavToParent();
  const postTeam = teamQueries.post({});

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PostTeamDto>({ resolver, defaultValues: {} });

  return (
    <PageTemplate constrainWidth title={'Create new team'} actions={undefined}>
      <Box w="form-width">
        <form
          onSubmit={handleSubmit((data) =>
            postTeam
              .mutateAsync(
                { entity: data },
                {
                  onSuccess: (result) => {
                    queryClient.invalidateQueries({ queryKey: ['me', 'teams'] });
                    goToView(result.id);
                  },
                  ...mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError }),
                }
              )
              .catch(noop)
          )}
        >
          <FormControl isInvalid={!!errors.name}>
            <FormLabel>Name</FormLabel>
            <Input {...register('name')} placeholder="name" />
            <FormErrorMessage>{errors.name?.message}</FormErrorMessage>
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
