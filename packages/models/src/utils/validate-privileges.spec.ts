import 'reflect-metadata';
import { validate } from 'class-validator';
import { IsValidPrivileges } from './validate-privileges';
import { PrivilegeCode } from '../types';

class TestDto {
  @IsValidPrivileges()
  privilegeIds: PrivilegeCode[];
}

describe('IsValidPrivileges', () => {
  it('passes when all privileges have their dependencies met', async () => {
    const dto = new TestDto();
    dto.privilegeIds = ['role:read', 'user:read', 'user:create'];
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes for an empty array', async () => {
    const dto = new TestDto();
    dto.privilegeIds = [];
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails when a privilege is missing a required dependency', async () => {
    const dto = new TestDto();
    dto.privilegeIds = ['user:read'];
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('privilegeIds');
  });

  it('fails when ods:read is present but sb-environment.edfi-tenant:read is missing', async () => {
    const dto = new TestDto();
    dto.privilegeIds = ['ods:read'];
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });

  it('passes for standalone privileges that have no dependencies', async () => {
    const dto = new TestDto();
    dto.privilegeIds = ['role:read'];
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
