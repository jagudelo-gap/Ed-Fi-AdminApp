import {
  Box,
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
import { Id, PostVendorDtoV2, PostVendorDtoV3 } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQueryClient } from '@tanstack/react-query';
import { noop } from '@tanstack/react-table';
import { useMemo } from 'react';
import { DefaultValues, Path, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { vendorQueriesV2 } from '../../api';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { useNavToParent, useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useVendorConfig } from './vendorConfig';

// Dispatches on the resolved version via `.match()` rather than destructuring
// `useVendorConfig()` directly, so `CreateVendorForm`'s generic is tied to
// the actual branch instead of the wider PostVendorDtoV2 | V3 union (see the
// caveat comment in vendorConfig.ts).
export const CreateVendorV2 = () =>
  useVendorConfig.match({
    v2: (cfg) => <CreateVendorForm<PostVendorDtoV2> config={cfg} />,
    v3: (cfg) => <CreateVendorForm<PostVendorDtoV3> config={cfg} />,
  });

function CreateVendorForm<D extends PostVendorDtoV2 | PostVendorDtoV3>(props: {
  config: { queries: { post: typeof vendorQueriesV2.post }; PostDto: new () => D };
}) {
  const { teamId, edfiTenant, edfiTenantId } = useTeamEdfiTenantNavContextLoaded();
  const popBanner = usePopBanner();
  const { queries, PostDto } = props.config;
  const resolver = useMemo(() => classValidatorResolver(PostDto), [PostDto]);

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const goToView = (id: string | number) =>
    navigate(
      `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/vendors/${id}`
    );
  const parentPath = useNavToParent();
  const postVendor = queries.post({
    edfiTenant,
    teamId,
  });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<D>({
    resolver,
    // react-hook-form's DefaultValues<T>/Path<T>/FieldErrors<T> conditional
    // types don't resolve against a bare generic type parameter (D is
    // concretely PostVendorDtoV2 or V3 at each call site, but this function
    // body is checked against the abstract D, not the caller's
    // instantiation) — cast to the exact param type useForm expects.
    defaultValues: new PostDto() as DefaultValues<D>,
  });

  // Same generic-vs-abstract-D limitation as above, for register()/errors.
  // These two helpers are the only remaining casts in this component — the
  // DTO shape itself (new PostDto(), the submitted `data`) stays fully
  // type-checked against D.
  const field = (name: keyof PostVendorDtoV2 & keyof PostVendorDtoV3) => name as Path<D>;
  const errorMessage = (name: keyof PostVendorDtoV2 & keyof PostVendorDtoV3): string | undefined =>
    (errors as Record<string, { message?: unknown } | undefined>)[name]?.message as
      | string
      | undefined;

  return (
    <PageTemplate constrainWidth title={'Create new vendor'} actions={undefined}>
      <Box w="form-width">
        <form
          onSubmit={handleSubmit((data) =>
            postVendor
              .mutateAsync(
                { entity: data },
                {
                  ...mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError }),
                  onSuccess: (data: typeof Id) => {
                    // The npm run build:fe failed for some reason in github action, so I included this change
                    queryClient.invalidateQueries({ queryKey: ['me', 'vendors'] });
                    // If data is a class, instantiate it; otherwise, access id directly
                    const id = (data instanceof Id) ? data.id : 0;
                    goToView(id);
                  },
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
      </Box>
    </PageTemplate>
  );
}
