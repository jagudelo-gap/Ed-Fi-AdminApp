import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Text,
  chakra,
} from '@chakra-ui/react';
import { ChangeEvent } from 'react';
import { PageTemplate } from '@edanalytics/common-ui';
import { PostProfileDtoV2, PostProfileDtoV3 } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQueryClient } from '@tanstack/react-query';
import { noop } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { DefaultValues, Path, PathValue, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { profileQueriesV2 } from '../../api';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { useNavToParent, useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useProfileConfig } from './profileConfig';

// Dispatches on the resolved version via `.match()` rather than destructuring
// `useProfileConfig()` directly, so `CreateProfileForm`'s generic is tied to
// the actual branch instead of the wider PostProfileDtoV2 | V3 union (see the
// caveat comment in profileConfig.ts / 527-design.md section 1).
export const CreateProfile = () =>
  useProfileConfig.match({
    v2: (cfg) => <CreateProfileForm<PostProfileDtoV2> config={cfg} />,
    v3: (cfg) => <CreateProfileForm<PostProfileDtoV3> config={cfg} />,
  });

function CreateProfileForm<D extends PostProfileDtoV2 | PostProfileDtoV3>(props: {
  config: { queries: { post: typeof profileQueriesV2.post }; PostDto: new () => D };
}) {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const [nameAttribute, setNameAttribute] = useState<string>('No profile selected');
  const popBanner = usePopBanner();
  const { queries, PostDto } = props.config;
  const resolver = useMemo(() => classValidatorResolver(PostDto), [PostDto]);

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const goToView = (id: string | number) =>
    navigate(
      `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/profiles/${id}`
    );
  const parentPath = useNavToParent();
  const postProfile = queries.post({
    edfiTenant,
    teamId,
  });

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<D>({
    resolver,
    // react-hook-form's DefaultValues<T>/Path<T>/FieldErrors<T> conditional
    // types don't resolve against a bare generic type parameter — see
    // 527-design.md section 3a. Cast to the exact param type useForm expects.
    defaultValues: new PostDto() as DefaultValues<D>,
  });

  // Same generic-vs-abstract-D limitation as above, for register()/setValue()/
  // errors. name/definition are shared across V2/V3, so no per-version helper
  // is needed here (contrast with 527-design.md's v3Field example for a
  // field that only exists on one branch).
  const field = (name: keyof PostProfileDtoV2 & keyof PostProfileDtoV3) => name as Path<D>;
  const errorMessage = (name: keyof PostProfileDtoV2 & keyof PostProfileDtoV3): string | undefined =>
    (errors as Record<string, { message?: unknown } | undefined>)[name]?.message as
      | string
      | undefined;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        //@ts-expect-error result is always string
        const text = event.target?.result?.replace(/\\"/g, '"') || '';
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text as string, 'application/xml');
        const profileElement = xmlDoc.querySelector('Profile');
        const profileName = profileElement ? profileElement.getAttribute('name') : null;
        if (profileName) {
          setNameAttribute(profileName);
        }
        // Same generic-vs-abstract-D limitation as field()/errorMessage() above:
        // setValue()'s value parameter is typed as PathValue<D, Path<D>>, which
        // doesn't resolve against the abstract D here, so cast through the
        // concrete string value both fields share.
        setValue(field('name'), profileName as string as PathValue<D, Path<D>>);
        setValue(field('definition'), text as string as PathValue<D, Path<D>>);
      };
      reader.readAsText(file);
    }
  };

  return (
    <PageTemplate constrainWidth title={'Create new profile'} actions={undefined}>
      <Box w="form-width">
        <form
          onSubmit={handleSubmit((data) =>
            postProfile
              .mutateAsync(
                { entity: data },
                {
                  ...mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError }),
                  onSuccess: (result) => {
                    queryClient.invalidateQueries({ queryKey: ['me', 'profiles'] });
                    goToView(result.id);
                  },
                }
              )
              .catch(noop)
          )}
        >
          <FormControl isInvalid={!!errors.name}>
            <FormLabel>Name</FormLabel>
            <Text {...register(field('name'))}>{nameAttribute}</Text>
            <FormErrorMessage>{errorMessage('name')}</FormErrorMessage>
          </FormControl>
          <FormControl isInvalid={!!errors.definition}>
            <FormLabel>Definition</FormLabel>
            <chakra.input
              title="file upload"
              type="file"
              accept=".xml"
              onChange={handleFileChange}
            />
            <FormErrorMessage>{errorMessage('definition')}</FormErrorMessage>
          </FormControl>

          <ButtonGroup>
            <Button mt={4} colorScheme="teal" isLoading={isSubmitting} type="submit">
              Save
            </Button>
            <Button
              mt={4}
              colorScheme="teal"
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
