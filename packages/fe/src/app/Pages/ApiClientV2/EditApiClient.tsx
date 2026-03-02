import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Switch,
  Text,
} from '@chakra-ui/react';
import { GetApiClientDtoV2, PutApiClientDtoV2, PutApiClientFormDtoV2 } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { SelectOds } from '../../helpers/EntitySelectors';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { apiClientQueriesV2 } from '../../api';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

const resolver = classValidatorResolver(PutApiClientFormDtoV2);

export const EditApiClient = (props: { apiClient: GetApiClientDtoV2 }) => {
  const { apiClient } = props;
  const { teamId, edfiTenant, edfiTenantId } = useTeamEdfiTenantNavContextLoaded();
  const popBanner = usePopBanner();
  const navigate = useNavigate();
  const putApiClient = apiClientQueriesV2.put({
    edfiTenant,
    teamId,
  });

  const goToView = () => {
    navigate(
      `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${apiClient.applicationId}/apiclients/${apiClient.id}`
    );
  };

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PutApiClientFormDtoV2>({
    resolver,
    defaultValues: {
      id: apiClient.id,
      name: apiClient.name,
      isApproved: apiClient.isApproved,
      applicationId: apiClient.applicationId,
      odsInstanceId: apiClient.odsInstanceIds[0],
    },
  });

  const selectedOds = watch('odsInstanceId');
  const onSubmit = (data: PutApiClientFormDtoV2) => {
    const payload = Object.assign(new PutApiClientDtoV2(), {
      id: data.id,
      name: data.name,
      isApproved: data.isApproved,
      applicationId: data.applicationId,
      odsInstanceIds: [data.odsInstanceId],
    });

    return putApiClient
      .mutateAsync(
        { entity: payload, pathParams: {} },
        {
          ...mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError }),
          onSuccess: goToView,
        }
      )
      .catch(noop);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FormControl isInvalid={!!errors.name}>
        <FormLabel>Name</FormLabel>
        <Input {...register('name')} />
        <FormErrorMessage>{errors.name?.message}</FormErrorMessage>
      </FormControl>

      <FormControl isInvalid={!!errors.isApproved}>
        <FormLabel>Enabled</FormLabel>
        <Switch
          {...register('isApproved')}
          onChange={(e) => setValue('isApproved', e.target.checked)}
        />
        <FormErrorMessage>{errors.isApproved?.message}</FormErrorMessage>
      </FormControl>

      <FormControl isInvalid={!!errors.odsInstanceId}>
        <FormLabel>ODS</FormLabel>
        <SelectOds
          useInstanceId
          value={selectedOds}
          onChange={(value) => setValue('odsInstanceId', value)}
        />
        <FormErrorMessage>{errors.odsInstanceId?.message}</FormErrorMessage>
      </FormControl>

      <FormControl>
        <FormLabel>Key</FormLabel>
        <Text>{apiClient.key}</Text>
      </FormControl>

      <FormControl>
        <FormLabel>Status</FormLabel>
        <Text>{apiClient.keyStatus}</Text>
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
    </form>
  );
};
