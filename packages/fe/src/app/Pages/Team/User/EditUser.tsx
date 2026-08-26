import { useQuery } from '@tanstack/react-query';
import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  chakra,
  Text,
} from '@chakra-ui/react';
import { PutUserDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { usePopBanner } from '../../../Layout/FeedbackBanner';

import { userQueries } from '../../../api';
import { mutationErrCallback } from '../../../helpers/mutationErrCallback';
import { noop } from '@tanstack/react-table';

const resolver = classValidatorResolver(PutUserDto);

export const EditUser = () => {
  const popBanner = usePopBanner();

  const navigate = useNavigate();
  const params = useParams() as {
    asId: string;
    userId: string;
  };
  const goToView = () => navigate(`/as/${params.asId}/users/${params.userId}`);
  const putUser = userQueries.put({
    teamId: params.asId,
  });

  const user = useQuery(
    userQueries.getOne({
      id: params.userId,
      teamId: params.asId,
    })
  ).data;
  const {
    register,
    setError,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PutUserDto>({ resolver, defaultValues: { ...user } });

  return user ? (
    <chakra.form
      maxW="form-width"
      onSubmit={handleSubmit((data) =>
        putUser
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
      <FormControl isInvalid={!!errors.givenName}>
        <FormLabel>Given Name</FormLabel>
        <Input {...register('givenName')} placeholder="givenName" />
        <FormErrorMessage>{errors.givenName?.message}</FormErrorMessage>
      </FormControl>
      <FormControl isInvalid={!!errors.familyName}>
        <FormLabel>Family Name</FormLabel>
        <Input {...register('familyName')} placeholder="familyName" />
        <FormErrorMessage>{errors.familyName?.message}</FormErrorMessage>
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
