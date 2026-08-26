import { intersection, union, isSuperset } from './set-operations';

describe('intersection', () => {
  it('returns elements present in both sets', () => {
    const result = intersection(new Set([1, 2, 3]), new Set([2, 3, 4]));
    expect(result).toEqual(new Set([2, 3]));
  });

  it('returns empty set when there is no overlap', () => {
    const result = intersection(new Set([1, 2]), new Set([3, 4]));
    expect(result).toEqual(new Set());
  });

  it('returns empty set when either input is empty', () => {
    expect(intersection(new Set<number>(), new Set([1]))).toEqual(new Set());
    expect(intersection(new Set([1]), new Set<number>())).toEqual(new Set());
  });

  it('works with string sets', () => {
    const result = intersection(new Set(['a', 'b', 'c']), new Set(['b', 'c', 'd']));
    expect(result).toEqual(new Set(['b', 'c']));
  });
});

describe('union', () => {
  it('combines two sets into one', () => {
    const result = union(new Set([1, 2]), new Set([3, 4]));
    expect(result).toEqual(new Set([1, 2, 3, 4]));
  });

  it('deduplicates overlapping elements', () => {
    const result = union(new Set([1, 2, 3]), new Set([2, 3, 4]));
    expect(result).toEqual(new Set([1, 2, 3, 4]));
  });

  it('works with empty sets', () => {
    expect(union(new Set<number>(), new Set([1]))).toEqual(new Set([1]));
    expect(union(new Set([1]), new Set<number>())).toEqual(new Set([1]));
  });
});

describe('isSuperset', () => {
  it('returns true when all subset elements are in the superset', () => {
    expect(isSuperset(new Set([1, 2, 3, 4]), new Set([2, 3]))).toBe(true);
  });

  it('returns true when subset equals superset', () => {
    expect(isSuperset(new Set([1, 2]), new Set([1, 2]))).toBe(true);
  });

  it('returns false when subset has elements not in the superset', () => {
    expect(isSuperset(new Set([1, 2]), new Set([2, 3]))).toBe(false);
  });

  it('returns true for an empty subset', () => {
    expect(isSuperset(new Set([1, 2]), new Set<number>())).toBe(true);
  });

  it('returns false when superset is empty and subset is not', () => {
    expect(isSuperset(new Set<number>(), new Set([1]))).toBe(false);
  });
});
