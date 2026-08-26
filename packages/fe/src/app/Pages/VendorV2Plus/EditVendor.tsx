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
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { noop } from '@tanstack/react-table';
import { useMemo } from 'react';
import { DefaultValues, Path, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { Icons } from '@edanalytics/common-ui';
import { PutVendorDtoV2, PutVendorDtoV3 } from '@edanalytics/models';
import { vendorQueriesV2 } from '../../api';
import { VendorEntity, useVendorConfig } from './vendorConfig';

// Dispatches on the resolved version via `.match()` rather than destructuring
// `useVendorConfig()` directly, so `EditVendorForm`'s generic is tied to the
// actual branch instead of the wider PutVendorDtoV2 | V3 union (see the
// caveat comment in vendorConfig.ts).
export const EditVendor = (props: { vendor: VendorEntity }) =>
  useVendorConfig.match({
    v2: (cfg) => <EditVendorForm<PutVendorDtoV2> config={cfg} vendor={props.vendor} />,
    v3: (cfg) => <EditVendorForm<PutVendorDtoV3> config={cfg} vendor={props.vendor} />,
  });

function EditVendorForm<D extends PutVendorDtoV2 | PutVendorDtoV3>(props: {
  config: { queries: { put: typeof vendorQueriesV2.put }; PutDto: new () => D };
  vendor: VendorEntity;
}) {
  const popBanner = usePopBanner();
  const { queries, PutDto } = props.config;
  const resolver = useMemo(() => classValidatorResolver(PutDto), [PutDto]);

  const navigate = useNavigate();
  const params = useParams() as {
    vendorId: string;
  };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const goToView = () =>
    navigate(
      `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/vendors/${params.vendorId}`
    );
  const putVendor = queries.put({
    edfiTenant,
    teamId,
  });

  const {
    register,
    setError,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<D>({
    resolver,
    // react-hook-form's DefaultValues<T>/Path<T>/FieldErrors<T> conditional
    // types don't resolve against a bare generic type parameter (D is
    // concretely PutVendorDtoV2 or V3 at each call site, but this function
    // body is checked against the abstract D, not the caller's
    // instantiation) — cast to the exact param type useForm expects. The
    // merged object is always a D at runtime (vendor's fields overwrite the
    // new PutDto() defaults for the same keys).
    defaultValues: Object.assign(new PutDto(), props.vendor) as DefaultValues<D>,
  });

  // Same generic-vs-abstract-D limitation as above, for register()/errors.
  // These two helpers are the only remaining casts in this component — the
  // DTO shape itself (new PutDto(), the submitted `data`) stays fully
  // type-checked against D.
  const field = (name: keyof PutVendorDtoV2 & keyof PutVendorDtoV3) => name as Path<D>;
  const errorMessage = (name: keyof PutVendorDtoV2 & keyof PutVendorDtoV3): string | undefined =>
    (errors as Record<string, { message?: unknown } | undefined>)[name]?.message as
      | string
      | undefined;

  return props.vendor ? (
    <chakra.form
      w="form-width"
      onSubmit={handleSubmit((data) =>
        putVendor
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
      <FormControl isInvalid={!!errors.company}>
        <FormLabel>Company</FormLabel>
        <Input {...register(field('company'))} />
        <FormErrorMessage>{errorMessage('company')}</FormErrorMessage>
      </FormControl>
      <FormControl isInvalid={!!errors.namespacePrefixes}>
        <FormLabel>
          Namespace prefixes{' '}
          <Tooltip
            label="Vendors can be associated with multiple namespaces. Please enter all possible namespace associations for this vendor, separated by commas."
            hasArrow
          >
            <chakra.span>
              <Icons.InfoCircle />
            </chakra.span>
          </Tooltip>
        </FormLabel>
        <Input
          {...register(field('namespacePrefixes'))}
          placeholder="uri://ed-fi.org, uri://..."
        />
        <FormErrorMessage>{errorMessage('namespacePrefixes')}</FormErrorMessage>
      </FormControl>
      <FormControl isInvalid={!!errors.contactName}>
        <FormLabel>Contact name</FormLabel>
        <Input {...register(field('contactName'))} />
        <FormErrorMessage>{errorMessage('contactName')}</FormErrorMessage>
      </FormControl>
      <FormControl isInvalid={!!errors.contactEmailAddress}>
        <FormLabel>Contact email address</FormLabel>
        <Input {...register(field('contactEmailAddress'))} />
        <FormErrorMessage>{errorMessage('contactEmailAddress')}</FormErrorMessage>
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
}
