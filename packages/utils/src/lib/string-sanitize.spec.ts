import { sanitizeForUrl, trimTrailingSlashes } from './string-sanitize';

describe('sanitizeForUrl', () => {
  it('lowercases the string', () => {
    expect(sanitizeForUrl('HELLO')).toBe('hello');
  });

  it('replaces spaces with dashes', () => {
    expect(sanitizeForUrl('Hello World')).toBe('hello-world');
  });

  it('replaces tab, newline, carriage return, form feed, vertical tab with dashes', () => {
    expect(sanitizeForUrl('a\tb')).toBe('a-b');
    expect(sanitizeForUrl('a\nb')).toBe('a-b');
    expect(sanitizeForUrl('a\rb')).toBe('a-b');
    expect(sanitizeForUrl('a\fb')).toBe('a-b');
    expect(sanitizeForUrl('a\vb')).toBe('a-b');
  });

  it('removes non-alphanumeric, non-dash characters', () => {
    expect(sanitizeForUrl('Hello World!')).toBe('hello-world');
    expect(sanitizeForUrl('My App 123')).toBe('my-app-123');
  });

  it('preserves existing dashes', () => {
    expect(sanitizeForUrl('my-app')).toBe('my-app');
  });

  it('preserves digits', () => {
    expect(sanitizeForUrl('App 123')).toBe('app-123');
  });

  it('handles empty string', () => {
    expect(sanitizeForUrl('')).toBe('');
  });
});

describe('trimTrailingSlashes', () => {
  it('removes a single trailing slash', () => {
    expect(trimTrailingSlashes('/path/to/resource/')).toBe('/path/to/resource');
  });

  it('removes multiple trailing slashes', () => {
    expect(trimTrailingSlashes('/path///')).toBe('/path');
  });

  it('returns the same string when there are no trailing slashes', () => {
    expect(trimTrailingSlashes('/path')).toBe('/path');
  });

  it('handles empty string', () => {
    expect(trimTrailingSlashes('')).toBe('');
  });

  it('handles a string that is only slashes', () => {
    expect(trimTrailingSlashes('///')).toBe('');
  });
});
