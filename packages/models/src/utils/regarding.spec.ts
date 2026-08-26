import 'reflect-metadata';
import { entityNamesMap, regarding } from './regarding';
import { GetUserDto, GetTeamDto, GetRoleDto } from '../dtos';

describe('entityNamesMap', () => {
  it('maps User entity names to User', () => {
    expect(entityNamesMap['User']).toBe('User');
    expect(entityNamesMap['GetUserDto']).toBe('User');
  });

  it('maps Role entity names to Role', () => {
    expect(entityNamesMap['Role']).toBe('Role');
    expect(entityNamesMap['GetRoleDto']).toBe('Role');
  });

  it('maps Team entity names to Team', () => {
    expect(entityNamesMap['Team']).toBe('Team');
    expect(entityNamesMap['GetTeamDto']).toBe('Team');
  });
});

describe('regarding', () => {
  it('formats displayName (EntityType) for GetUserDto', () => {
    const entity = new GetUserDto();
    entity.username = 'alice@example.com';
    expect(regarding(entity)).toBe('alice@example.com (User)');
  });

  it('formats displayName (EntityType) for GetTeamDto', () => {
    const entity = new GetTeamDto();
    entity.name = 'Engineering';
    expect(regarding(entity)).toBe('Engineering (Team)');
  });

  it('formats displayName (EntityType) for GetRoleDto', () => {
    const entity = new GetRoleDto();
    entity.name = 'Admin';
    expect(regarding(entity)).toBe('Admin (Role)');
  });
});
