import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  chakra,
} from '@chakra-ui/react';
import {
  GetEdfiTenantDto,
  GetSbEnvironmentDto,
  ISbEnvironmentConfigPublicV1,
  PutEdfiTenantAdminApi,
} from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useForm } from 'react-hook-form';
import { usePopBanner } from '../../Layout/FeedbackBanner';

import { noop } from '@tanstack/react-table';
import { useNavigate } from 'react-router';
import { edfiTenantQueriesGlobal } from '../../api';
import { useSbEnvironmentNavContextLoaded } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

const resolver = classValidatorResolver(PutEdfiTenantAdminApi);

export const RegisterSbEnvironmentAdminApiManual = (props: {
  sbEnvironment: GetSbEnvironmentDto;
  edfiTenant: GetEdfiTenantDto;
}) => {
  const popBanner = usePopBanner();

  const navigate = useNavigate();
  const { sbEnvironmentId } = useSbEnvironmentNavContextLoaded();
  const goToView = () =>
    navigate(`/sb-environments/${sbEnvironmentId}/edfi-tenants/${props.edfiTenant.id}`);
  const putSbEnvironment = edfiTenantQueriesGlobal.registerApiManual({
    sbEnvironmentId,
  });
  const { sbEnvironment, edfiTenant } = props;
  const sbEnvironmentFormDefaults: PutEdfiTenantAdminApi = {
    id: edfiTenant.id,
    adminKey: (sbEnvironment.configPublic?.values as ISbEnvironmentConfigPublicV1)?.adminApiKey,
    url: sbEnvironment.adminApiUrl,
  };
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PutEdfiTenantAdminApi>({ resolver, defaultValues: sbEnvironmentFormDefaults });

  return sbEnvironment ? (
    <chakra.form
      w="form-width"
      onSubmit={handleSubmit((data) =>
        putSbEnvironment
          .mutateAsync(
            { entity: data, pathParams: null },
            {
              ...mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError }),
              onSuccess: (result) => {
                popBanner(result);
                goToView();
              },
            }
          )
          .catch(noop)
      )}
    >
      <FormControl isInvalid={!!errors.url}>
        <FormLabel>Base URL</FormLabel>
        <Input {...register('url')} placeholder="URL" />
        <FormErrorMessage>{errors.url?.message}</FormErrorMessage>
      </FormControl>
      <FormControl isInvalid={!!errors.adminKey}>
        <FormLabel>Key (client ID)</FormLabel>
        <Input {...register('adminKey')} placeholder="key" />
        <FormErrorMessage>{errors.adminKey?.message}</FormErrorMessage>
      </FormControl>
      <FormControl isInvalid={!!errors.adminSecret}>
        <FormLabel>Secret</FormLabel>
        <Input {...register('adminSecret')} placeholder="secret" />
        <FormErrorMessage>{errors.adminSecret?.message}</FormErrorMessage>
      </FormControl>
      <ButtonGroup>
        <Button mt={4} colorScheme="primary" isLoading={isSubmitting} type="submit">
          Connect
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
    </chakra.form>
  ) : null;
};
