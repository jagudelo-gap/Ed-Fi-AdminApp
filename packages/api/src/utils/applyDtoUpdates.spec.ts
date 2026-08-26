import { applyDtoUpdates } from './applyDtoUpdates';

interface TestEntity {
  id: number;
  username: string;
  roleId: number;
  createdById?: number;
}

interface TestDto {
  username: string;
  roleId: number;
  secret?: string;
}

describe('applyDtoUpdates', () => {
  it('copies allowed fields from dto to entity', () => {
    const entity: TestEntity = { id: 1, username: 'old', roleId: 5 };
    const dto: TestDto = { username: 'new', roleId: 10 };

    const result = applyDtoUpdates(entity, dto, ['username', 'roleId']);

    expect(result.username).toBe('new');
    expect(result.roleId).toBe(10);
  });

  it('does not copy fields not in the allowedFields list', () => {
    const entity: TestEntity = { id: 1, username: 'old', roleId: 5 };
    const dto: TestDto & { secret: string } = { username: 'new', roleId: 10, secret: 'hack' };

    applyDtoUpdates(entity, dto, ['username']);

    expect((entity as unknown as Record<string, unknown>).secret).toBeUndefined();
    expect(entity.roleId).toBe(5);
  });

  it('returns the same entity reference (mutation, not clone)', () => {
    const entity: TestEntity = { id: 1, username: 'old', roleId: 5 };
    const dto: TestDto = { username: 'new', roleId: 10 };

    const result = applyDtoUpdates(entity, dto, ['username']);

    expect(result).toBe(entity);
  });

  it('skips fields not present on the dto (hasOwnProperty check)', () => {
    const entity: TestEntity = { id: 1, username: 'old', roleId: 5 };
    const dto: Partial<TestDto> = { username: 'new' };

    applyDtoUpdates(entity, dto, ['username', 'roleId']);

    expect(entity.roleId).toBe(5);
  });

  it('handles an empty allowedFields list gracefully', () => {
    const entity: TestEntity = { id: 1, username: 'old', roleId: 5 };
    const dto: TestDto = { username: 'new', roleId: 10 };

    applyDtoUpdates(entity, dto, []);

    expect(entity.username).toBe('old');
    expect(entity.roleId).toBe(5);
  });
});
