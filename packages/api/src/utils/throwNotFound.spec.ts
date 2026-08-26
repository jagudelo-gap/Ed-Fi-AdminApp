import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { throwNotFound, throwNotFoundText } from './throwNotFound';

describe('throwNotFound', () => {
  it('throws a NotFoundException', () => {
    expect(() => throwNotFound(new Error('oops'))).toThrow(NotFoundException);
  });

  it('always throws regardless of the argument', () => {
    expect(() => throwNotFound(null)).toThrow(NotFoundException);
    expect(() => throwNotFound('string error')).toThrow(NotFoundException);
  });
});

describe('throwNotFoundText', () => {
  it('returns a function', () => {
    expect(typeof throwNotFoundText('something')).toBe('function');
  });

  it('the returned function throws NotFoundException with the given message', () => {
    const fn = throwNotFoundText('Resource not found');
    expect(() => fn(new Error('oops'))).toThrow(NotFoundException);
  });
});
