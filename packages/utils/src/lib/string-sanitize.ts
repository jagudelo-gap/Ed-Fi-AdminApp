/**
 * Sanitizes a string by converting it to lowercase, replacing whitespace with dashes,
 * and keeping only alphanumeric characters and dashes. Useful for creating URL-safe slugs.
 *
 * @param str - The string to sanitize
 * @returns A sanitized string containing only lowercase letters, digits, and dashes
 *
 * @example
 * sanitizeForUrl('Hello World!') // returns 'hello-world'
 * sanitizeForUrl('My App 123') // returns 'my-app-123'
 */
export const sanitizeForUrl = (str: string): string => {
  const isWhitespace = (char: string) =>
    char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '\f' || char === '\v';

  const isAlphanumericOrDash = (char: string) => {
    const code = char.charCodeAt(0);
    return (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || char === '-';
  };

  return str
    .toLowerCase()
    .split('')
    .map(char => (isWhitespace(char) ? '-' : isAlphanumericOrDash(char) ? char : ''))
    .join('');
};

/**
 * Removes trailing slashes from a pathname.
 *
 * @param pathname - The pathname to trim
 * @returns The pathname with all trailing slashes removed
 *
 * @example
 * trimTrailingSlashes('/path/to/resource/') // returns '/path/to/resource'
 * trimTrailingSlashes('/path///') // returns '/path'
 */
export const trimTrailingSlashes = (pathname: string): string => {
  let result = pathname;
  while (result.endsWith('/')) {
    result = result.slice(0, -1);
  }
  return result;
};
