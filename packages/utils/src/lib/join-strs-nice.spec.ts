import { joinStrsNice } from './join-strs-nice';

describe('joinStrsNice', () => {
  it('returns empty string for an empty array', () => {
    expect(joinStrsNice([])).toBe('');
  });

  it('returns the single item for a one-element array', () => {
    expect(joinStrsNice(['apple'])).toBe('apple');
  });

  it('joins two items with "and"', () => {
    expect(joinStrsNice(['apple', 'banana'])).toBe('apple and banana');
  });

  it('joins three items with commas and "and" before the last', () => {
    expect(joinStrsNice(['apple', 'banana', 'cherry'])).toBe('apple, banana and cherry');
  });

  it('joins four or more items with commas and "and" before the last', () => {
    expect(joinStrsNice(['a', 'b', 'c', 'd'])).toBe('a, b, c and d');
  });
});
