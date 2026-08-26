import {
  Button,
  ButtonGroup,
  chakra,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Switch,
  Text,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import {
  PostApiClientDtoV2,
  PostApiClientFormDtoV2,
} from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQueryClient } from '@tanstack/react-query';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { apiClientQueriesV2 } from '../../api';
import { useNavToParent, useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { SelectOds } from '../../helpers/EntitySelectors';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { usePopBanner } from '../../Layout/FeedbackBanner';

const resolver = classValidatorResolver(PostApiClientFormDtoV2);

export const CreateApiClientPage = () => {
  const { applicationId } = useParams() as { applicationId: string };
  const applicationIdNumber = Number(applicationId);
  const { teamId, edfiTenant, edfiTenantId } = useTeamEdfiTenantNavContextLoaded();
  const navToParentOptions = useNavToParent();
  const popBanner = usePopBanner();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const postApiClient = apiClientQueriesV2.post({
    edfiTenant,
    teamId,
  });

  const goToView = (id: number, options?: { state?: unknown }) => {
    navigate(
      `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${applicationIdNumber}/apiClients/${id}`,
      options
    );
  };

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PostApiClientFormDtoV2>({
    resolver,
    defaultValues: {
      applicationId: applicationIdNumber,
      isApproved: true,
    },
  });

  const selectedOds = watch('odsInstanceId');
  const onSubmit = (data: PostApiClientFormDtoV2) => {
    const payload = Object.assign(new PostApiClientDtoV2(), {
      name: data.name,
      isApproved: data.isApproved,
      applicationId: data.applicationId,
      odsInstanceIds: [data.odsInstanceId],
    });

    return postApiClient
      .mutateAsync(
        { entity: payload, pathParams: {} },
        {
          ...mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError }),
          onSuccess: (result) => {
            void queryClient.invalidateQueries({
              queryKey: apiClientQueriesV2.getAll(
                {
                  teamId,
                  edfiTenant,
                },
                {
                  applicationId: applicationIdNumber,
                }
              ).queryKey,
            });

            if (typeof result.id === 'number') {
              goToView(result.id, { state: result });
              return;
            }

            navigate(navToParentOptions);
          },
        }
      )
      .catch(noop);
  };

  return (
    <PageTemplate title="New credentials">
      <chakra.form w="30em" onSubmit={handleSubmit(onSubmit)}>
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
      </chakra.form>
    </PageTemplate>
  );
};
