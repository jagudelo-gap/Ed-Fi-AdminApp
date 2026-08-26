import { ValidationError } from 'class-validator';
import { FieldError } from 'react-hook-form';
import {
  formErrFromValidator,
  formValidationResult,
  flattenFieldErrors,
  isExplicitStatusResponse,
  isFormValidationError,
} from './form-err-from-validator';

function makeValidationError(property: string, constraintKey: string, message: string): ValidationError {
  const err = new ValidationError();
  err.property = property;
  err.constraints = { [constraintKey]: message };
  err.value = '';
  return err;
}

describe('formErrFromValidator', () => {
  it('converts a single validation error to FieldErrors', () => {
    const errors = [makeValidationError('username', 'isNotEmpty', 'Username is required')];
    const result = formErrFromValidator(errors);
    expect(result['username']).toMatchObject({ type: 'isNotEmpty', message: 'Username is required' });
  });

  it('converts multiple errors', () => {
    const errors = [
      makeValidationError('username', 'isNotEmpty', 'Username required'),
      makeValidationError('email', 'isEmail', 'Invalid email'),
    ];
    const result = formErrFromValidator(errors);
    expect(Object.keys(result)).toHaveLength(2);
    expect(result['email']).toMatchObject({ type: 'isEmail' });
  });

  it('prefixes nested errors with the parent path', () => {
    const parent = new ValidationError();
    parent.property = 'address';
    parent.value = {};
    parent.children = [makeValidationError('city', 'isNotEmpty', 'City required')];
    const result = formErrFromValidator([parent]);
    expect(result['address.city']).toMatchObject({ type: 'isNotEmpty' });
  });

  it('includes all constraint types on the error object', () => {
    const err = new ValidationError();
    err.property = 'field';
    err.constraints = { isNotEmpty: 'Required', isString: 'Must be string' };
    err.value = '';
    const result = formErrFromValidator([err]);
    expect((result['field'] as FieldError).types).toMatchObject({
      isNotEmpty: 'Required',
      isString: 'Must be string',
    });
  });
});

describe('formValidationResult', () => {
  it('creates a root.serverError entry from a string message', () => {
    const result = formValidationResult('Something went wrong');
    expect(result['root.serverError']).toMatchObject({ message: 'Something went wrong' });
  });

  it('creates field errors from an array of field/message objects', () => {
    const result = formValidationResult(
      { field: 'username', message: 'Required' },
      { field: 'email', message: 'Invalid' }
    );
    expect(result['username']).toMatchObject({ message: 'Required' });
    expect(result['email']).toMatchObject({ message: 'Invalid' });
  });
});

describe('flattenFieldErrors', () => {
  it('returns empty string when errors is empty and no fieldPath given', () => {
    const result = flattenFieldErrors({});
    expect(result).toBe('');
  });

  it('flattens a flat FieldErrors object into a message string', () => {
    const errors = formValidationResult({ field: 'name', message: 'Required' });
    const flat = flattenFieldErrors(errors);
    expect(flat).toContain('Required');
  });

  it('returns undefined when the specified fieldPath does not exist', () => {
    const errors = formValidationResult({ field: 'name', message: 'Required' });
    expect(flattenFieldErrors(errors, 'nonexistent')).toBeUndefined();
  });
});

describe('isExplicitStatusResponse', () => {
  it('returns true for a valid Success response', () => {
    expect(isExplicitStatusResponse({ type: 'Success', title: 'OK' })).toBe(true);
  });

  it('returns true for a ValidationError response', () => {
    expect(
      isExplicitStatusResponse({ type: 'ValidationError', title: 'Invalid submission.', data: { errors: {} } })
    ).toBe(true);
  });

  it('returns false for an arbitrary object', () => {
    expect(isExplicitStatusResponse({ foo: 'bar' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isExplicitStatusResponse(null)).toBe(false);
  });
});

describe('isFormValidationError', () => {
  it('returns true when type is ValidationError', () => {
    const resp = {
      type: 'ValidationError' as const,
      title: 'Invalid submission.' as const,
      data: { errors: {} },
    };
    expect(isFormValidationError(resp)).toBe(true);
  });

  it('returns false when type is Success', () => {
    const resp = { type: 'Success' as const, title: 'OK' };
    expect(isFormValidationError(resp)).toBe(false);
  });
});
