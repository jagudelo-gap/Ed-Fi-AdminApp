import { useQuery } from '@tanstack/react-query';
import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Text,
} from '@chakra-ui/react';
import { ConfirmAction } from '@edanalytics/common-ui';
import {
  DependencyErrors,
  GetRoleDto,
  PRIVILEGES,
  PrivilegeCode,
  PutRoleDto,
  RoleType,
} from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { noop } from '@tanstack/react-table';
import uniq from 'lodash/uniq';
import { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { roleQueries } from '../../api';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { PrivilegesInput } from './PrivilegesInput';

const resolver = classValidatorResolver(PutRoleDto);
export const hasTeamImpersonation = (privileges: PutRoleDto['privilegeIds']) =>
  privileges?.some((p) => p.startsWith('team.'));

export const hasGlobalPrivileges = (privileges: PutRoleDto['privilegeIds']) =>
  privileges?.some((p) => p !== 'me:read' && !p.startsWith('team.'));

export const hasNewTeamImpersonation = (
  privileges: PutRoleDto['privilegeIds'],
  existing: GetRoleDto['privilegeIds']
) => hasTeamImpersonation(privileges) && !hasTeamImpersonation(existing);

export const hasNewGlobalPrivileges = (
  privileges: PutRoleDto['privilegeIds'],
  existing: GetRoleDto['privilegeIds']
) => hasGlobalPrivileges(privileges) && !hasGlobalPrivileges(existing);

export const EditRoleGlobal = (props: { role: GetRoleDto }) => {
  const popBanner = usePopBanner();

  const navigate = useNavigate();
  const params = useParams() as {
    roleId: string;
  };
  const goToView = () => navigate(`/roles/${params.roleId}`);
  const putRole = roleQueries.put({});

  const role = useQuery(
    roleQueries.getOne({
      id: params.roleId,
    })
  ).data;
  const privileges = Object.values(PRIVILEGES);
  const filteredPrivileges =
    privileges && role
      ? Object.values(privileges).filter(
          (p) =>
            role.type === RoleType.UserGlobal ||
            (role.type === RoleType.ResourceOwnership &&
              (p.code.startsWith('team.sb-environment') ||
                p.code.startsWith('team.integration-provider'))) ||
            (role.type === RoleType.UserTeam && p.code.startsWith('team.'))
        )
      : undefined;
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
    control,
  } = useForm<PutRoleDto>({
    resolver,
    defaultValues: {
      ...role,
      privilegeIds: uniq([...(role?.privileges.map((p) => p.code) ?? []), 'me:read']),
    },
  });

  let privilegesError: undefined | string | DependencyErrors = undefined;
  try {
    // might be fancy error object for privilege dependencies
    privilegesError = JSON.parse(errors.privilegeIds?.message as string);
  } catch {
    // either undefined or plain string from class-validator
  }
  const newPrivileges = watch('privilegeIds');

  const newTeamImpersonation =
    props.role.type === RoleType.UserGlobal &&
    hasNewTeamImpersonation(newPrivileges, props.role.privilegeIds);
  const adminPrivileges =
    props.role.type === RoleType.UserGlobal &&
    hasNewGlobalPrivileges(newPrivileges, props.role.privilegeIds);
  const confirmBody = newTeamImpersonation
    ? adminPrivileges
      ? "It looks like you're adding new team impersonation ability and global privileges. Are you sure you want to do that?"
      : "It looks like you're adding new team impersonation ability to this role. Are you sure you want to do that?"
    : adminPrivileges
    ? "It looks like you're adding new global privileges. Are you sure you want to do that?"
    : null;

  const formRef = useRef<HTMLFormElement>(null);
  return role ? (
    <form
      ref={formRef}
      onSubmit={handleSubmit((data) =>
        putRole
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
      <FormControl maxW="form-width" isInvalid={!!errors.name}>
        <FormLabel>Name</FormLabel>
        <Input {...register('name')} placeholder="name" />
        <FormErrorMessage>{errors.name?.message}</FormErrorMessage>
      </FormControl>
      <FormControl maxW="form-width" isInvalid={!!errors.description}>
        <FormLabel>Description</FormLabel>
        <Input {...register('description')} placeholder="description" />
        <FormErrorMessage>{errors.description?.message}</FormErrorMessage>
      </FormControl>
      <FormLabel as="p">Type</FormLabel>
      <Text>{role.type ?? '-'}</Text>
      <FormControl isInvalid={typeof privilegesError === 'string'}>
        <FormLabel>Privileges</FormLabel>
        <Controller
          rules={{ deps: [] }}
          control={control}
          name="privilegeIds"
          render={(field) =>
            filteredPrivileges === undefined ? (
              <></>
            ) : (
              <PrivilegesInput
                error={typeof privilegesError === 'string' ? undefined : privilegesError}
                onChange={field.field.onChange}
                value={field.field.value as PrivilegeCode[]}
                privileges={filteredPrivileges}
              />
            )
          }
        />
        <FormErrorMessage>
          {typeof privilegesError === 'string' ? privilegesError : undefined}
        </FormErrorMessage>
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
    </form>
  ) : null;
};
