import { edorgCompositeKey, edorgKeyV2 } from './getApplicationCacheId';

describe('edorgCompositeKey', () => {
  it('returns just the edorg id as a string', () => {
    expect(edorgCompositeKey({ ods: 10, edorg: 99 })).toBe('99');
  });

  it('works with string ids', () => {
    expect(edorgCompositeKey({ ods: 'ods-1', edorg: 'edorg-2' })).toBe('edorg-2');
  });
});

describe('edorgKeyV2', () => {
  it('combines ods and edorg with a dash', () => {
    expect(edorgKeyV2({ ods: 5, edorg: 42 })).toBe('5-42');
  });

  it('works when ods is null', () => {
    expect(edorgKeyV2({ ods: null, edorg: 42 })).toBe('null-42');
  });

  it('works with string ids', () => {
    expect(edorgKeyV2({ ods: 'tenant-1', edorg: 'org-2' })).toBe('tenant-1-org-2');
  });
});
