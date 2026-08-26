import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Input,
  Text,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import {
  CopyClaimsetDtoV2,
  CopyClaimsetDtoV3,
  GetClaimsetMultipleDtoV2,
  GetClaimsetMultipleDtoV3,
  GetClaimsetSingleDtoV2,
  GetClaimsetSingleDtoV3,
} from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { UseQueryOptions, useQuery } from '@tanstack/react-query';
import { noop } from '@tanstack/react-table';
import { useMemo } from 'react';
import { DefaultValues, Path, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { claimsetQueriesV2 } from '../../api';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { useNavToParent, useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useClaimsetConfig } from './claimsetConfig';

type ClaimsetForCopy =
  | GetClaimsetSingleDtoV2
  | GetClaimsetMultipleDtoV2
  | GetClaimsetSingleDtoV3
  | GetClaimsetMultipleDtoV3;

// Dispatches on the resolved version via `.match()` rather than destructuring
// useClaimsetConfig() directly, so CopyClaimsetFormInner's generic is tied to
// the actual branch instead of the wider CopyClaimsetDtoV2 | V3 union - same
// reasoning as CreateProfilePage.tsx (see 527-design.md section 1).
export const CopyClaimsetForm = ({ claimset }: { claimset: ClaimsetForCopy }) =>
  useClaimsetConfig.match({
    v2: (cfg) => <CopyClaimsetFormInner<CopyClaimsetDtoV2> claimset={claimset} config={cfg} />,
    v3: (cfg) => <CopyClaimsetFormInner<CopyClaimsetDtoV3> claimset={claimset} config={cfg} />,
  });

function CopyClaimsetFormInner<D extends CopyClaimsetDtoV2 | CopyClaimsetDtoV3>(props: {
  claimset: ClaimsetForCopy;
  config: {
    version: 'v2' | 'v3';
    queries: { copy: typeof claimsetQueriesV2.copy };
    CopyDto: new () => D;
  };
}) {
  const { claimset, config } = props;
  const { queries, CopyDto } = config;
  const resolver = useMemo(() => classValidatorResolver(CopyDto), [CopyDto]);
  const popBanner = usePopBanner();
  const navToParentOptions = useNavToParent();
  const navigate = useNavigate();
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const goToView = (id: string | number) =>
    navigate(
      `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/claimsets/${id}`
    );
  const postClaimsetCopy = queries.copy({ edfiTenant, teamId });

  const {
    register,
    setError,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<D>({
    resolver,
    // Same DefaultValues<D>/Path<D> cast pattern as CreateProfilePage.tsx -
    // see 527-design.md section 3a.
    defaultValues: Object.assign(new CopyDto(), {
      originalId: claimset.id,
      name: claimset.name + ' (copy)',
    }) as DefaultValues<D>,
  });

  const field = (name: keyof CopyClaimsetDtoV2 & keyof CopyClaimsetDtoV3) => name as Path<D>;
  const errorMessage = (name: keyof CopyClaimsetDtoV2 & keyof CopyClaimsetDtoV3): string | undefined =>
    (errors as Record<string, { message?: unknown } | undefined>)[name]?.message as
      | string
      | undefined;

  return (
    <Box w="form-width">
      <form
        onSubmit={handleSubmit((data) =>
          postClaimsetCopy
            .mutateAsync(
              { entity: data, pathParams: {} },
              {
                onSuccess: (result: { id: string | number }) => {
                  goToView(result.id);
                },
                ...mutationErrCallback({ setFormError: setError, popGlobalBanner: popBanner }),
              }
            )
            .catch(noop)
        )}
      >
        <FormControl isInvalid={!!errors.name}>
          <FormLabel>Name</FormLabel>
          <Input {...register(field('name'))} placeholder="name" />
          {/* Admin API V3 rejects any whitespace in a claim set name. The copy
              default ("<name> (copy)") intentionally still contains spaces, so
              state the rule up front rather than only on a failed submit.
              Branching on config.version follows 527-design.md section 3a. */}
          {props.config.version === 'v3' ? (
            <FormHelperText>Cannot contain whitespace.</FormHelperText>
          ) : null}
          <FormErrorMessage>{errorMessage('name')}</FormErrorMessage>
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
      </form>
    </Box>
  );
}

export const CopyClaimsetPage = () => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const { claimsetId } = useParams();
  const { queries } = useClaimsetConfig();
  // TypeScript cannot resolve union-typed overloaded functions; cast to the
  // actual return type. Same workaround as ClaimsetsPage.tsx/NameCell.tsx/
  // ClaimsetPage.tsx.
  const claimset = useQuery(
    queries.getOne({ id: Number(claimsetId), edfiTenant, teamId }) as UseQueryOptions<
      GetClaimsetSingleDtoV2 | GetClaimsetMultipleDtoV2 | GetClaimsetSingleDtoV3 | GetClaimsetMultipleDtoV3
    >
  );
  return (
    <PageTemplate title={'Copy ' + (claimset.data?.name ?? 'claimset')} actions={undefined}>
      {claimset.data ? <CopyClaimsetForm claimset={claimset.data} /> : null}
    </PageTemplate>
  );
};
