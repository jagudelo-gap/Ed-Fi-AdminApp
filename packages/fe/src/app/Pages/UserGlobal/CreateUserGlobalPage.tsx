import {
  Box,
  Button,
  ButtonGroup,
  chakra,
  Checkbox,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Icon,
  Input,
  Radio,
  RadioGroup,
  Stack,
  Text,
  Tooltip,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { PostUserDto, RoleType } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQueryClient } from '@tanstack/react-query';
import { noop } from '@tanstack/react-table';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { userQueries, userTeamMembershipQueries } from '../../api';
import { AuthorizeComponent, SelectRole, SelectTeam, useNavToParent } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useState } from 'react';
import { BsInfoCircle } from 'react-icons/bs';

const resolver = classValidatorResolver(PostUserDto);

type TeamFields = {
  teamId: number;
  teamRoleId: number;
};

export const CreateUser = () => {
  const popGlobalBanner = usePopBanner();

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const parentPath = useNavToParent();
  const postUser = userQueries.post({});
  const postUtm = userTeamMembershipQueries.post({});
  const [isAddingToTeam, setIsAddingToTeam] = useState(false);

  const onAddToTeamChange = (value: string) => {
    setIsAddingToTeam(value === 'yes');
  };

  const {
    register,
    unregister,
    handleSubmit,
    setError: setFormError,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PostUserDto & TeamFields>({ resolver, defaultValues: { userType: 'human' } });

  const [userType] = watch(['userType']);
  const isHuman = userType === 'human';

  const createUserSubmit = ({ teamId, teamRoleId, ...data }: PostUserDto & TeamFields) =>
    postUser
      .mutateAsync(
        { entity: data },
        {
          ...mutationErrCallback({ popGlobalBanner, setFormError }),
          onSuccess: async (result) => {
            queryClient.invalidateQueries({ queryKey: ['me', 'users'] });
            if (!isAddingToTeam) {
              navigate(`/users/${result.id}`);
              return;
            }

            // if adding to a team, create a user-team-membership
            const userTeamEntity = { userId: result.id, teamId, roleId: teamRoleId };
            postUtm
              .mutateAsync(
                { entity: userTeamEntity },
                {
                  onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: ['me', 'user-team-memberships'] });
                    navigate(`/users/${result.id}`);
                  },
                  ...mutationErrCallback({ popGlobalBanner, setFormError }),
                }
              )
              .catch(noop);
          },
        }
      )
      .catch(noop);

  return (
    <PageTemplate title="Create new user">
      <Box w="form-width">
        <form onSubmit={handleSubmit(createUserSubmit)}>
          <FormControl isInvalid={!!errors.username}>
            <FormLabel>Username</FormLabel>
            <Input {...register('username')} placeholder="username" />
            <FormErrorMessage>{errors.username?.message}</FormErrorMessage>
          </FormControl>

          <FormControl isInvalid={!!errors.userType}>
            <FormLabel>User Type</FormLabel>
            <Controller
              control={control}
              name="userType"
              render={({ field }) => (
                <RadioGroup
                  {...field}
                  defaultValue="human"
                  onChange={(value) => {
                    unregister('givenName');
                    unregister('familyName');
                    unregister('description');
                    unregister('clientId');
                    field.onChange(value);
                  }}
                >
                  <Stack direction="row" spacing={4}>
                    <Radio value="human">Human</Radio>
                    <Radio value="machine">Machine</Radio>
                  </Stack>
                </RadioGroup>
              )}
            />
            <FormErrorMessage>{errors.userType?.message}</FormErrorMessage>
          </FormControl>

          {isHuman ? (
            <>
              <FormControl isInvalid={!!errors.givenName}>
                <FormLabel>Given Name</FormLabel>
                <Input {...register('givenName')} placeholder="Given name" />
                <FormErrorMessage>{errors.givenName?.message}</FormErrorMessage>
              </FormControl>
              <FormControl isInvalid={!!errors.familyName}>
                <FormLabel>Family name</FormLabel>
                <Input {...register('familyName')} placeholder="Family name" />
                <FormErrorMessage>{errors.familyName?.message}</FormErrorMessage>
              </FormControl>
            </>
          ) : (
            <>
              <FormControl isInvalid={!!errors.description}>
                <FormLabel>Description</FormLabel>
                <Input {...register('description')} placeholder="description" />
                <FormErrorMessage>{errors.description?.message}</FormErrorMessage>
              </FormControl>
              <FormControl isInvalid={!!errors.clientId}>
                <FormLabel>
                  Client ID{' '}
                  <Tooltip label="Create the application in OAuth provider first." hasArrow>
                    <chakra.span>
                      <Icon as={BsInfoCircle} />
                    </chakra.span>
                  </Tooltip>
                </FormLabel>
                <Input {...register('clientId')} placeholder="clientId" />
                <FormErrorMessage>{errors.clientId?.message}</FormErrorMessage>
              </FormControl>
            </>
          )}

          <FormControl isInvalid={!!errors.isActive}>
            <FormLabel>Status</FormLabel>
            <Checkbox {...register('isActive')}>Is active</Checkbox>
            <FormErrorMessage>{errors.isActive?.message}</FormErrorMessage>
          </FormControl>

          <FormControl w="form-width" isInvalid={!!errors.roleId}>
            <FormLabel>Role</FormLabel>
            <SelectRole
              types={[RoleType.UserGlobal]}
              name={'roleId'}
              control={control}
              isClearable
            />
            <FormErrorMessage>{errors.roleId?.message}</FormErrorMessage>
          </FormControl>

          <AuthorizeComponent
            config={{
              privilege: 'user-team-membership:create',
              subject: {
                id: '__filtered__',
              },
            }}
          >
            <>
              <FormControl>
                <FormLabel>Add to a Team?</FormLabel>
                <RadioGroup defaultValue="no" onChange={onAddToTeamChange}>
                  <Stack direction="row" spacing={4}>
                    <Radio value="yes">Yes</Radio>
                    <Radio value="no">No</Radio>
                  </Stack>
                </RadioGroup>
              </FormControl>
              {isAddingToTeam && (
                <>
                  <FormControl w="form-width" isInvalid={!!errors.teamId}>
                    <FormLabel>Team</FormLabel>
                    <SelectTeam name={'teamId'} control={control} />
                    <FormErrorMessage>{errors.teamId?.message}</FormErrorMessage>
                  </FormControl>
                  <FormControl w="form-width" isInvalid={!!errors.roleId}>
                    <FormLabel>Role</FormLabel>
                    <SelectRole
                      autoSelectOnly
                      types={[RoleType.UserTeam]}
                      name={'teamRoleId'}
                      control={control}
                      isClearable
                    />
                    <FormErrorMessage>{errors.roleId?.message}</FormErrorMessage>
                  </FormControl>
                </>
              )}
            </>
          </AuthorizeComponent>

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
