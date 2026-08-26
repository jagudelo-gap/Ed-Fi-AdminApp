import 'reflect-metadata';
import { addUserCreating, addUserModifying, regarding } from './index';
import { User, Team, Role, Ods } from '../entities';
import { GetUserDto } from '@edanalytics/models';

const makeUser = (id: number): GetUserDto => ({ id } as GetUserDto);

describe('addUserModifying', () => {
  it('sets modifiedById on the entity and returns the entity', () => {
    const entity: { modifiedById?: number } = {};
    const result = addUserModifying(entity, makeUser(42));
    expect(result.modifiedById).toBe(42);
    expect(result).toBe(entity);
  });

  it('overwrites an existing modifiedById', () => {
    const entity = { modifiedById: 1 };
    addUserModifying(entity, makeUser(99));
    expect(entity.modifiedById).toBe(99);
  });
});

describe('addUserCreating', () => {
  it('sets createdById on the entity and returns the entity', () => {
    const entity: { createdById?: number } = {};
    const result = addUserCreating(entity, makeUser(7));
    expect(result.createdById).toBe(7);
    expect(result).toBe(entity);
  });

  it('sets createdById to undefined when user is not provided', () => {
    const entity: { createdById?: number } = {};
    addUserCreating(entity);
    expect(entity.createdById).toBeUndefined();
  });
});

describe('regarding', () => {
  it('formats "displayName (User)" for a User entity', () => {
    const user = new User();
    user.id = 1;
    user.username = 'alice';
    const result = regarding(user);
    expect(result).toContain('(User)');
  });

  it('formats "displayName (Role)" for a Role entity', () => {
    const role = new Role();
    role.id = 2;
    role.name = 'Admin';
    const result = regarding(role);
    expect(result).toContain('(Role)');
    expect(result).toContain('Admin');
  });

  it('formats "displayName (Team)" for a Team entity', () => {
    const team = new Team();
    team.id = 3;
    team.name = 'Engineering';
    const result = regarding(team);
    expect(result).toContain('(Team)');
    expect(result).toContain('Engineering');
  });

  it('formats correctly for Ods entity', () => {
    const ods = new Ods();
    ods.id = 10;
    ods.dbName = 'ODS-10';
    const result = regarding(ods);
    expect(result).toContain('(ODS)');
    expect(result).toContain('ODS-10');
  });
});
