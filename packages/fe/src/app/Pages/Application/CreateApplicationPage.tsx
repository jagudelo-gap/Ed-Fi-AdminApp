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
import { PostApplicationForm } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { applicationQueriesV1 } from '../../api';
import {
  SelectClaimset,
  SelectEdorg,
  SelectVendor,
  useNavToParent,
  useTeamEdfiTenantNavContextLoaded,
} from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
const resolver = classValidatorResolver(PostApplicationForm);

export const CreateApplicationPage = () => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const navigate = useNavigate();
  const navToParentOptions = useNavToParent();
  const popBanner = usePopBanner();

  const postApplication = applicationQueriesV1.post({
    edfiTenant,
    teamId,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    control,
  } = useForm<PostApplicationForm>({
    resolver,
    defaultValues: new PostApplicationForm(),
  });

  return (
    <PageTemplate title="New application">
      <chakra.form
        w="30em"
        onSubmit={handleSubmit((data) =>
          postApplication
            .mutateAsync(
              { entity: data },
              {
                onSuccess(data, _variables, _context) {
                  navigate(
                    `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/applications/${data.applicationId}`,
                    {
                      state: data,
                    }
                  );
                },
                ...mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError }),
              }
            )
            .catch(noop)
        )}
      >
        <FormControl isInvalid={!!errors.applicationName}>
          <FormLabel>Application name</FormLabel>
          <Input {...register('applicationName')} placeholder="name" />
          <FormErrorMessage>{errors.applicationName?.message}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.educationOrganizationId}>
          <FormLabel>Ed-org</FormLabel>
          <SelectEdorg name="educationOrganizationId" useEdorgId control={control} />
          <FormErrorMessage>{errors.educationOrganizationId?.message}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.vendorId}>
          <FormLabel>Vendor</FormLabel>
          <SelectVendor name="vendorId" control={control} />
          <FormErrorMessage>{errors.vendorId?.message}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.claimsetId}>
          <FormLabel>
            Claimset{' '}
            <Tooltip label="You can only select non-reserved claimsets here." hasArrow>
              <chakra.span>
                <Icons.InfoCircle />
              </chakra.span>
            </Tooltip>
          </FormLabel>
          <SelectClaimset noReserved name="claimsetId" control={control} />
          <FormErrorMessage>{errors.claimsetId?.message}</FormErrorMessage>
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
