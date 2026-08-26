import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Text,
} from '@chakra-ui/react';
import { PutUserTeamMembershipDto, RoleType } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { teamQueries, userQueries, userTeamMembershipQueries } from '../../api';
import { getRelationDisplayName } from '../../helpers';
import { SelectRole } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

const resolver = classValidatorResolver(PutUserTeamMembershipDto);

export const EditUtmGlobal = () => {
  const popBanner = usePopBanner();

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const params = useParams() as { userTeamMembershipId: string };
  const goToView = () => navigate(`/user-team-memberships/${params.userTeamMembershipId}`);
  const putUserTeamMembership = userTeamMembershipQueries.put({});

  const utm = useQuery(
    userTeamMembershipQueries.getOne({
      id: params.userTeamMembershipId,
    })
  ).data;
  const teams = useQuery(teamQueries.getAll({}));
  const users = useQuery(userQueries.getAll({}));

  const {
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PutUserTeamMembershipDto>({ resolver, defaultValues: { ...utm } });

  return utm ? (
    <form
      onSubmit={handleSubmit((data) =>
        putUserTeamMembership
          .mutateAsync(
            { entity: data },
            {
              ...mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError }),
              onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['me', 'userTeamMemberships'] });
                goToView();
              },
            }
          )
          .catch(noop)
      )}
    >
      <FormLabel as="p">Team</FormLabel>
      <Text>{getRelationDisplayName(utm.teamId, teams)}</Text>
      <FormLabel as="p">User</FormLabel>
      <Text>{getRelationDisplayName(utm.userId, users)}</Text>
      <FormControl w="form-width" isInvalid={!!errors.roleId}>
        <FormLabel>Role</FormLabel>
        <SelectRole types={[RoleType.UserTeam]} name={'roleId'} control={control} isClearable />
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
    </form>
  ) : null;
};
