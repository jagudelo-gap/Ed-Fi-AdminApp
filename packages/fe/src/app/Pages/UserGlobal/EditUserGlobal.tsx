import { useQuery } from '@tanstack/react-query';
import {
  Button,
  ButtonGroup,
  Checkbox,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Text,
  chakra,
} from '@chakra-ui/react';
import { GetUserDto, PutUserDto, RoleType } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { roleQueries, userQueries } from '../../api';
import { SelectRole } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useRef } from 'react';
import { hasNewTeamImpersonation, hasNewGlobalPrivileges } from '../RoleGlobal/EditRoleGlobal';
import { Attribute, AttributesGrid, ConfirmAction } from '@edanalytics/common-ui';
import { RoleGlobalLink } from '../../routes/role-global.routes';

const resolver = classValidatorResolver(PutUserDto);

export const EditUserGlobal = (props: { user: GetUserDto }) => {
  const popBanner = usePopBanner();

  const { user } = props;
  const roles = useQuery(roleQueries.getAll({}));

  const navigate = useNavigate();
  const params = useParams() as {
    userId: string;
  };
  const goToView = () => navigate(`/users/${params.userId}`);
  const putUser = userQueries.put({});

  const userFormDefaults: Partial<PutUserDto> = new PutUserDto();
  userFormDefaults.id = user.id;
  userFormDefaults.roleId = user.roleId;
  userFormDefaults.description = user.description;
  userFormDefaults.givenName = user.givenName;
  userFormDefaults.familyName = user.familyName;
  userFormDefaults.isActive = user.isActive;
  userFormDefaults.username = user.username;

  const {
    control,
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver,
    defaultValues: userFormDefaults,
  });

  const newRoleId = watch('roleId');
  const newPrivileges = newRoleId !== undefined ? roles.data?.[newRoleId]?.privilegeIds : undefined;
  const oldPrivileges =
    user.roleId !== undefined ? roles.data?.[user.roleId]?.privilegeIds : undefined;

  const newTeamImpersonation =
    newPrivileges && hasNewTeamImpersonation(newPrivileges, oldPrivileges ?? []);
  const adminPrivileges =
    newPrivileges && hasNewGlobalPrivileges(newPrivileges, oldPrivileges ?? []);
  const confirmMessage = newTeamImpersonation
    ? adminPrivileges
      ? 'team impersonation ability and global privileges'
      : 'team impersonation ability'
    : adminPrivileges
    ? 'global privileges'
    : null;
  const confirmBody =
    confirmMessage === null ? null : (
      <Text>
        You're about to give this user new {confirmMessage}. Are you sure you want to do that?
        <br />
        <br />
        See the{' '}
        {newRoleId !== undefined && roles.data?.[newRoleId] ? (
          <RoleGlobalLink id={newRoleId} query={roles} />
        ) : null}{' '}
        role to check the details.
      </Text>
    );

  const formRef = useRef<HTMLFormElement>(null);

  const isHuman = user?.userType === 'human';

  return (
    <chakra.form
      maxW="form-width"
      ref={formRef}
      onSubmit={handleSubmit(async (data) => {
        const validatedData = data as PutUserDto;
        return putUser
          .mutateAsync(
            {
              entity: {
                id: validatedData.id,
                roleId: validatedData.roleId,
                isActive: validatedData.isActive,
                username: validatedData.username,
                givenName: validatedData.givenName === '' ? null : validatedData.givenName,
                familyName: validatedData.familyName === '' ? null : validatedData.familyName,
                description: validatedData.description,
              },
            },
            {
              ...mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError }),
              onSuccess: goToView,
            }
          )
          .catch(noop);
      })}
    >
      <AttributesGrid>
        <Attribute label="User Type" value={user.userType} />
      </AttributesGrid>

      <FormControl isInvalid={!!errors.username}>
        <FormLabel>Username</FormLabel>
        <Input {...register('username')} placeholder="username" />
        <FormErrorMessage>{errors.username?.message}</FormErrorMessage>
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
        <FormControl isInvalid={!!errors.description}>
          <FormLabel>Description</FormLabel>
          <Input {...register('description')} placeholder="description" />
          <FormErrorMessage>{errors.description?.message}</FormErrorMessage>
        </FormControl>
      )}

      <FormControl isInvalid={!!errors.isActive}>
        <FormLabel>Status</FormLabel>
        <Checkbox {...register('isActive')}>Is active</Checkbox>
        <FormErrorMessage>{errors.isActive?.message}</FormErrorMessage>
      </FormControl>
      <FormControl w="form-width" isInvalid={!!errors.roleId}>
        <FormLabel>Role</FormLabel>
        <SelectRole types={[RoleType.UserGlobal]} name={'roleId'} control={control} isClearable />
        <FormErrorMessage>{errors.roleId?.message}</FormErrorMessage>
      </FormControl>
      <ButtonGroup>
        <ConfirmAction
          action={() => {
            formRef.current?.dispatchEvent(
              new Event('submit', { bubbles: true, cancelable: true })
            );
          }}
          skipConfirmation={confirmBody === null}
          headerText="Add new admin privileges?"
          bodyText={confirmBody ?? ''}
          yesButtonText="Yes, save"
          noButtonText="No, cancel"
        >
          {(props) => (
            <Button
              mt={4}
              colorScheme="primary"
              isLoading={isSubmitting}
              type="submit"
              onClick={(e) => {
                e.preventDefault();
                props.onClick?.(e);
              }}
            >
              Save
            </Button>
          )}
        </ConfirmAction>
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
  );
};
