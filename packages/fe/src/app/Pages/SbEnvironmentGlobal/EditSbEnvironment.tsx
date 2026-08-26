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
import { GetSbEnvironmentDto, PutSbEnvironmentDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { usePopBanner } from '../../Layout/FeedbackBanner';

import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { sbEnvironmentQueriesGlobal } from '../../api';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

const resolver = classValidatorResolver(PutSbEnvironmentDto);

export const EditSbEnvironment = (props: { sbEnvironment: GetSbEnvironmentDto }) => {
  const popBanner = usePopBanner();

  const navigate = useNavigate();
  const goToView = () => navigate(`/sb-environments/${props.sbEnvironment.id}`);
  const putSbEnvironment = sbEnvironmentQueriesGlobal.put({});
  const { sbEnvironment } = props;
  const sbEnvironmentFormDefaults: PutSbEnvironmentDto = {
    name: props.sbEnvironment.displayName,
    id: props.sbEnvironment.id,
  };
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PutSbEnvironmentDto>({ resolver, defaultValues: sbEnvironmentFormDefaults });

  return sbEnvironment ? (
    <chakra.form
      w="form-width"
      onSubmit={handleSubmit((data) =>
        putSbEnvironment
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
      <FormControl isInvalid={!!errors.name}>
        <FormLabel>Name</FormLabel>
        <Input {...register('name')} />
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
