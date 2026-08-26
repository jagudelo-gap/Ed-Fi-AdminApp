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
import { PutTeamDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePopBanner } from '../../Layout/FeedbackBanner';

import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { teamQueries } from '../../api';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

const resolver = classValidatorResolver(PutTeamDto);

export const EditTeam = () => {
  const popBanner = usePopBanner();

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const params = useParams() as { teamId: string };
  const goToView = () => navigate(`/teams/${params.teamId}`);
  const putTeam = teamQueries.put({
    callback: goToView,
  });

  const team = useQuery(
    teamQueries.getOne({
      id: params.teamId,
    })
  ).data;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PutTeamDto>({ resolver, defaultValues: { ...team } });

  return team ? (
    <chakra.form
      maxW="form-width"
      onSubmit={handleSubmit((data) =>
        putTeam
          .mutateAsync(
            { entity: data },
            {
              ...mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError }),
              onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['me', 'teams'] });
                goToView();
              },
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
