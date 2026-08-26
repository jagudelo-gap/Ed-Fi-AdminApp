import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Text,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { PostUserTeamMembershipDto, RoleType } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQueryClient } from '@tanstack/react-query';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { userTeamMembershipQueries } from '../../api';
import { SelectRole, SelectTeam, SelectUser, useNavToParent } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useSearchParamsObject } from '../../helpers/useSearch';

const resolver = classValidatorResolver(PostUserTeamMembershipDto);

const getDefaults = (dict: { userId?: string; teamId?: string; roleId?: string }) => {
  return {
    userId: 'userId' in dict ? Number(dict.userId) : undefined,
    teamId: 'teamId' in dict ? Number(dict.teamId) : undefined,
    roleId: 'roleId' in dict ? Number(dict.roleId) : undefined,
  };
};

export const CreateUtmGlobal = () => {
  const popBanner = usePopBanner();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const goToView = (id: string | number) => navigate(`/user-team-memberships/${id}`);
  const parentPath = useNavToParent();
  const postUtm = userTeamMembershipQueries.post({});

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PostUserTeamMembershipDto>({
    resolver,
    defaultValues: Object.assign(
      new PostUserTeamMembershipDto(),
      useSearchParamsObject(getDefaults)
    ),
  });
  return (
    <PageTemplate constrainWidth title={'Create new team membership'} actions={undefined}>
      <Box w="form-width">
        <form
          onSubmit={handleSubmit((data) =>
            postUtm
              .mutateAsync(
                { entity: data },
                {
                  onSuccess: (result) => {
                    queryClient.invalidateQueries({ queryKey: ['me', 'user-team-memberships'] });
                    goToView(result.id);
                  },
                  ...mutationErrCallback({ setFormError: setError, popGlobalBanner: popBanner }),
                }
              )
              .catch(noop)
          )}
        >
          <FormControl w="form-width" isInvalid={!!errors.teamId}>
            <FormLabel>Team</FormLabel>
            <SelectTeam name={'teamId'} control={control} />
            <FormErrorMessage>{errors.teamId?.message}</FormErrorMessage>
          </FormControl>
          <FormControl w="form-width" isInvalid={!!errors.userId}>
            <FormLabel>User</FormLabel>
            <SelectUser name={'userId'} control={control} />
            <FormErrorMessage>{errors.userId?.message}</FormErrorMessage>
          </FormControl>
          <FormControl w="form-width" isInvalid={!!errors.roleId}>
            <FormLabel>Role</FormLabel>
            <SelectRole
              autoSelectOnly
              types={[RoleType.UserTeam]}
              name={'roleId'}
              control={control}
              isClearable
            />
            <FormErrorMessage>{errors.roleId?.message}</FormErrorMessage>
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
};
