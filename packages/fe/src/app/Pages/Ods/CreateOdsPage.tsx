import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Select,
  Text,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { PostOdsDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQueryClient } from '@tanstack/react-query';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { instancesV2, odsQueries } from '../../api';
import {
  SelectOdsTemplate,
  useNavToParent,
  useTeamEdfiTenantNavContextLoaded,
} from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import {
  FIXED_NON_SB_TEMPLATE_OPTIONS,
  getTemplateFieldName,
} from './createOdsTemplateBehavior';
import { useOdsTerminology } from './useOdsTerminology';

const resolver = classValidatorResolver(PostOdsDto);

export const CreateOds = () => {
  const popBanner = usePopBanner();
  const params = useTeamEdfiTenantNavContextLoaded();
  const terminology = useOdsTerminology();
  const isStartingBlocks = params.sbEnvironment.startingBlocks;
  const templateFieldName = getTemplateFieldName(isStartingBlocks);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const goToView = (id: string | number) =>
    navigate(
      `/as/${params.asId}/sb-environments/${params.sbEnvironmentId}/edfi-tenants/${params.edfiTenantId}/odss/${id}`
    );
  const parentPath = useNavToParent();
  const postOds = odsQueries.post({
    edfiTenant: params.edfiTenant,
    teamId: params.asId,
  });
  const postInstance = instancesV2.post({
    edfiTenant: params.edfiTenant,
    teamId: params.asId,
  });

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PostOdsDto>({
    resolver,
    defaultValues: Object.assign(new PostOdsDto(), {}),
  });

  return (
    <PageTemplate title={terminology.createTitle} actions={undefined}>
      <form
        onSubmit={handleSubmit((data) => {
          const callbacks = {
            ...mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError }),
          };

          if (isStartingBlocks) {
            return postOds
              .mutateAsync(
                {
                  entity: data,
                },
                {
                  ...callbacks,
                  onSuccess: (result) => {
                    goToView(result.id);
                  },
                }
              )
              .catch(noop);
          }
          return postInstance
            .mutateAsync(
              {
                entity: {
                  name: data.name,
                  databaseTemplate: data.databaseTemplate!,
                },
              },
            {
              ...callbacks,
              onSuccess: () => {
                void queryClient.invalidateQueries({
                  queryKey: odsQueries.getAll({ edfiTenant: params.edfiTenant, teamId: params.asId }).queryKey,
                });
                navigate(parentPath);
              },
            }
          )
          .catch(noop);
        })}
      >
        <FormControl w="form-width" isInvalid={!!errors.name}>
          <FormLabel>Name</FormLabel>
          <Input {...register('name')} />
          <FormErrorMessage>{errors.name?.message}</FormErrorMessage>
        </FormControl>
        <FormControl w="form-width" isInvalid={!!(isStartingBlocks ? errors.templateName : errors.databaseTemplate)}>
          <FormLabel>Template</FormLabel>
          {isStartingBlocks ? (
            <SelectOdsTemplate name={templateFieldName} control={control} />
          ) : (
            <Select
              placeholder="Select template"
              {...register('databaseTemplate', { required: 'Template is required' })}
            >
              {FIXED_NON_SB_TEMPLATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
          <FormErrorMessage>
            {isStartingBlocks ? errors.templateName?.message : errors.databaseTemplate?.message}
          </FormErrorMessage>
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
    </PageTemplate>
  );
};
