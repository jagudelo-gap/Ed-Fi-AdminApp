import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Text,
  Tooltip,
  chakra,
} from '@chakra-ui/react';
import { Icons, PageTemplate } from '@edanalytics/common-ui';
import { AddEdorgDtoV2, ISbEnvironmentConfigPublicV2 } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { edorgQueries } from '../../api';
import {
  SelectEdorgCategory,
  SelectOds,
  useNavToParent,
  useTeamEdfiTenantNavContextLoaded,
} from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useSearchParamsObject } from '../../helpers/useSearch';

const resolver = classValidatorResolver(AddEdorgDtoV2);

const getDefaults = (dict: { ODSName?: string }) => {
  return {
    ODSName: 'ODSName' in dict ? dict.ODSName : undefined,
  };
};

export const CreateEdorg = () => {
  const popBanner = usePopBanner();
  const { asId, teamId, sbEnvironment, sbEnvironmentId, edfiTenantId, edfiTenant } =
    useTeamEdfiTenantNavContextLoaded();

  const allowedEdorgs = (sbEnvironment.configPublic.values as ISbEnvironmentConfigPublicV2)
    .tenants?.[edfiTenant.name]?.allowedEdorgs;

  const navigate = useNavigate();
  const search = useSearchParamsObject(getDefaults);

  const goToView = () =>
    navigate(`/as/${asId}/sb-environments/${sbEnvironmentId}/edfi-tenants/${edfiTenantId}/edorgs`);
  const parentPath = useNavToParent();
  const postEdorg = edorgQueries.post({
    edfiTenant,
    teamId,
  });

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AddEdorgDtoV2>({
    resolver,
    defaultValues: Object.assign(new AddEdorgDtoV2(), search),
  });

  return (
    <PageTemplate title={'Create new ed-org'} actions={undefined}>
      <form
        onSubmit={handleSubmit((data) =>
          postEdorg
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
        <FormControl w="form-width" isInvalid={!!errors.EdOrgId}>
          <FormLabel>
            Ed-org ID
            {allowedEdorgs ? (
              <>
                {' '}
                <Tooltip
                  label={'The value must be one of: "' + allowedEdorgs.join('", "') + '"'}
                  hasArrow
                >
                  <chakra.span>
                    <Icons.InfoCircle />
                  </chakra.span>
                </Tooltip>
              </>
            ) : null}
          </FormLabel>
          <Input {...register('EdOrgId')} />
          <FormErrorMessage>{errors.EdOrgId?.message}</FormErrorMessage>
        </FormControl>
        <FormControl w="form-width" isInvalid={!!errors.ODSName}>
          <FormLabel>ODS name</FormLabel>
          <SelectOds useInstanceName control={control} name="ODSName" />
          <FormErrorMessage>{errors.ODSName?.message}</FormErrorMessage>
        </FormControl>
        <FormControl w="form-width" isInvalid={!!errors.EdOrgCategory}>
          <FormLabel>Ed-org category</FormLabel>
          <SelectEdorgCategory control={control} name="EdOrgCategory" />
          <FormErrorMessage>{errors.EdOrgCategory?.message}</FormErrorMessage>
        </FormControl>
        <FormControl w="form-width" isInvalid={!!errors.NameOfInstitution}>
          <FormLabel>Name of institution</FormLabel>
          <Input {...register('NameOfInstitution')} />
          <FormErrorMessage>{errors.NameOfInstitution?.message}</FormErrorMessage>
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
