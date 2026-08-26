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
  PutEdfiTenantAdminApiRegister,
} from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { edfiTenantQueriesGlobal } from '../../api';
import { useSbEnvironmentNavContextLoaded } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

const resolver = classValidatorResolver(PutEdfiTenantAdminApiRegister);

export const RegisterSbEnvironmentAdminApiAuto = (props: {
  sbEnvironment: GetSbEnvironmentDto;
  edfiTenant: GetEdfiTenantDto;
}) => {
  const navigate = useNavigate();
  const goToView = () =>
    navigate(`/sb-environments/${sbEnvironmentId}/edfi-tenants/${props.edfiTenant.id}`);
  const { sbEnvironmentId } = useSbEnvironmentNavContextLoaded();
  const putRegister = edfiTenantQueriesGlobal.registerApiAuto({
    sbEnvironmentId,
  });
  const { sbEnvironment, edfiTenant } = props;
  const sbEnvironmentFormDefaults: PutEdfiTenantAdminApiRegister = {
    id: edfiTenant.id,
    adminRegisterUrl: sbEnvironment.adminApiUrl,
  };
  const {
    register,
    setError,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PutEdfiTenantAdminApiRegister>({
    resolver,
    defaultValues: sbEnvironmentFormDefaults,
  });

  const popBanner = usePopBanner();

  return sbEnvironment ? (
    <chakra.form
      w="form-width"
      onSubmit={handleSubmit((data) =>
        putRegister
          .mutateAsync(
            { entity: data, pathParams: {} },
            {
              ...mutationErrCallback({ setFormError: setError, popGlobalBanner: popBanner }),
              onSuccess: (result) => {
                popBanner(result);
                goToView();
              },
            }
          )
          .catch(noop)
      )}
    >
      <FormControl isInvalid={!!errors.adminRegisterUrl}>
        <FormLabel>Admin API URL</FormLabel>
        <Input {...register('adminRegisterUrl')} placeholder="URL" />
        <FormErrorMessage>{errors.adminRegisterUrl?.message}</FormErrorMessage>
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
