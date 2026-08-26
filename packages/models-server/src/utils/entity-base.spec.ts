import 'reflect-metadata';
import { EntityBase } from './entity-base';

class TestEntity extends EntityBase {}

describe('EntityBase', () => {
  it('displayName returns the string form of the numeric id', () => {
    const entity = new TestEntity();
    entity.id = 42;
    expect(entity.displayName).toBe('42');
  });

  it('displayName returns "0" when id is 0', () => {
    const entity = new TestEntity();
    entity.id = 0;
    expect(entity.displayName).toBe('0');
  });

  it('displayName returns "undefined" when id has not been set', () => {
    const entity = new TestEntity();
    expect(entity.displayName).toBe('undefined');
  });
});
