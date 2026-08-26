import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Text,
  chakra,
} from '@chakra-ui/react';
import { PutProfileDtoV2, PutProfileDtoV3 } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { noop } from '@tanstack/react-table';
import { ChangeEvent, useMemo, useState } from 'react';
import { DefaultValues, Path, PathValue, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { profileQueriesV2 } from '../../api';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { ProfileEntity, useProfileConfig } from './profileConfig';

// Dispatches on the resolved version via `.match()` rather than destructuring
// `useProfileConfig()` directly, so `EditProfileForm`'s generic is tied to the
// actual branch instead of the wider PutProfileDtoV2 | V3 union (see the
// caveat comment in profileConfig.ts / 527-design.md section 1).
export const EditProfile = (props: { profile: ProfileEntity }) =>
  useProfileConfig.match({
    v2: (cfg) => <EditProfileForm<PutProfileDtoV2> config={cfg} profile={props.profile} />,
    v3: (cfg) => <EditProfileForm<PutProfileDtoV3> config={cfg} profile={props.profile} />,
  });

function EditProfileForm<D extends PutProfileDtoV2 | PutProfileDtoV3>(props: {
  config: { queries: { put: typeof profileQueriesV2.put }; PutDto: new () => D };
  profile: ProfileEntity;
}) {
  const popBanner = usePopBanner();
  const [nameAttribute, setNameAttribute] = useState<string>('No profile selected');
  const { queries, PutDto } = props.config;
  const resolver = useMemo(() => classValidatorResolver(PutDto), [PutDto]);

  const navigate = useNavigate();
  const params = useParams() as {
    profileId: string;
  };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const goToView = () =>
    navigate(
      `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/profiles/${params.profileId}`
    );
  const putProfile = queries.put({
    edfiTenant,
    teamId,
  });

  const {
    register,
    setError,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<D>({
    resolver,
    // Merged object is always a D at runtime (profile's fields overwrite the
    // new PutDto() defaults for the same keys). See 527-design.md section 3a
    // for why the cast itself is needed.
    defaultValues: Object.assign(new PutDto(), props.profile) as DefaultValues<D>,
  });

  const field = (name: keyof PutProfileDtoV2 & keyof PutProfileDtoV3) => name as Path<D>;
  const errorMessage = (name: keyof PutProfileDtoV2 & keyof PutProfileDtoV3): string | undefined =>
    (errors as Record<string, { message?: unknown } | undefined>)[name]?.message as
      | string
      | undefined;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        // Some profile-export XML files escape attribute-value quotes as \"
        // instead of plain ", which DOMParser can't read as a valid
        // attribute delimiter. CreateProfilePage.tsx already strips these
        // (SBAA-93 / PR #133); that fix was never ported here.
        //@ts-expect-error result is always string
        const text = event.target?.result?.replace(/\\"/g, '"') || '';
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text as string, 'application/xml');
        const profileElement = xmlDoc.querySelector('Profile');
        const profileName = profileElement ? profileElement.getAttribute('name') : null;
        if (profileName) {
          setNameAttribute(profileName);
        }
        setValue(field('name'), profileName as string as PathValue<D, Path<D>>);
        setValue(field('definition'), text as string as PathValue<D, Path<D>>);
      };
      reader.readAsText(file);
    }
  };

  return props.profile ? (
    <chakra.form
      w="form-width"
      onSubmit={handleSubmit((data) =>
        putProfile
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
      <FormControl isInvalid={!!errors.name}>
        <FormLabel>Name</FormLabel>
        <Text {...register(field('name'))}>{nameAttribute}</Text>
        <FormErrorMessage>{errorMessage('name')}</FormErrorMessage>
      </FormControl>
      <FormControl isInvalid={!!errors.definition}>
        <FormLabel>Definition</FormLabel>
        <chakra.input title="file upload" type="file" accept=".xml" onChange={handleFileChange} />
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
