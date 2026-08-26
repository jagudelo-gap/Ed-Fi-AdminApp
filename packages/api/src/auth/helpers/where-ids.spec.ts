import { whereIds, checkId } from './where-ids';
import { FindOperator } from 'typeorm';

describe('whereIds', () => {
  it('returns an empty object when ids is true (allow all)', () => {
    expect(whereIds(true)).toEqual({});
  });

  it('returns a TypeORM In clause when ids is a Set', () => {
    const ids = new Set([1, 2, 3]);
    const result = whereIds(ids);
    expect(result).toHaveProperty('id');
    expect(Array.isArray((result.id as FindOperator<number>).value)).toBe(true);
  });

  it('returns an In clause with a single id', () => {
    const ids = new Set([99]);
    const result = whereIds(ids);
    expect(result).toHaveProperty('id');
  });

  it('returns an In clause with an empty set', () => {
    const ids = new Set<number>();
    const result = whereIds(ids);
    expect(result).toHaveProperty('id');
  });
});

describe('checkId', () => {
  it('returns true when ids is true (allow all)', () => {
    expect(checkId(5, true)).toBe(true);
    expect(checkId('any-id', true)).toBe(true);
  });

  it('returns true when the id is in the Set', () => {
    const ids = new Set([1, 2, 3]);
    expect(checkId(2, ids)).toBe(true);
  });

  it('returns false when the id is NOT in the Set', () => {
    const ids = new Set([1, 2, 3]);
    expect(checkId(99, ids)).toBe(false);
  });

  it('works with string ids in a Set', () => {
    const ids = new Set(['abc', 'def']);
    expect(checkId('abc', ids)).toBe(true);
    expect(checkId('xyz', ids)).toBe(false);
  });
});
