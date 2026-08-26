import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Text,
  Textarea,
  Tooltip,
  chakra,
} from '@chakra-ui/react';
import { GetClaimsetDto, PutClaimsetDto } from '@edanalytics/models';
import { flattenFieldErrors } from '@edanalytics/utils';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { claimsetQueriesV1 } from '../../api';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { Icons } from '@edanalytics/common-ui';

const resolver = classValidatorResolver(PutClaimsetDto);

export const EditClaimset = (props: { claimset: GetClaimsetDto }) => {
  const popBanner = usePopBanner();

  const navigate = useNavigate();
  const params = useParams() as {
    claimsetId: string;
  };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const goToView = () =>
    navigate(
      `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/claimsets/${params.claimsetId}`
    );
  const putClaimset = claimsetQueriesV1.put({
    edfiTenant,
    teamId: teamId,
  });

  const {
    register,
    setError,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PutClaimsetDto>({
    resolver,
    defaultValues: Object.assign(new PutClaimsetDto(), props.claimset),
  });

  return props.claimset ? (
    <chakra.form
      onSubmit={handleSubmit((data) =>
        putClaimset
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
      <FormControl w="form-width" isInvalid={!!errors.name}>
        <FormLabel>Name</FormLabel>
        <Input {...register('name')} />
        <FormErrorMessage>{errors.name?.message}</FormErrorMessage>
      </FormControl>
      <FormControl w="90%" isInvalid={!!errors.resourceClaims}>
        <FormLabel>
          Resource claims{' '}
          <Tooltip label="Paste resource claims JSON here." hasArrow>
            <chakra.span>
              <Icons.InfoCircle />
            </chakra.span>
          </Tooltip>
        </FormLabel>
        <Textarea
          fontFamily="mono"
          minH="20em"
          {...register('resourceClaimsJson')}
          css={{
            '&::placeholder': {
              whiteSpace: 'pre',
            },
          }}
          placeholder='[&#10;  {&#10;    "name": "types",&#10;    "read": true,&#10;    "create": true,&#10;    "update": true,&#10;    "delete": true,&#10;    "defaultAuthStrategiesForCRUD": ...'
        />
        <FormErrorMessage>{flattenFieldErrors(errors, 'resourceClaims')}</FormErrorMessage>
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
