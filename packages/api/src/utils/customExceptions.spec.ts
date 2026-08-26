import 'reflect-metadata';
import { HttpException } from '@nestjs/common';
import { StatusResponse } from '@edanalytics/utils';
import {
  isIAdminApiValidationError,
  CustomHttpException,
  ValidationHttpException,
} from './customExceptions';

describe('isIAdminApiValidationError', () => {
  it('returns true for a valid IAdminApiValidationError shape', () => {
    const err = {
      title: 'Validation failed',
      status: 400,
      errors: { Name: ['A claim set with this name already exists in the database.'] },
    };
    expect(isIAdminApiValidationError(err)).toBe(true);
  });

  it('returns false when title does not match', () => {
    const err = { title: 'Other error', status: 400, errors: {} };
    expect(isIAdminApiValidationError(err)).toBe(false);
  });

  it('returns false when errors values are not arrays of strings', () => {
    const err = { title: 'Validation failed', status: 400, errors: { Name: 'oops' } };
    expect(isIAdminApiValidationError(err)).toBe(false);
  });

  it('returns false for null / undefined', () => {
    expect(isIAdminApiValidationError(null)).toBeFalsy();
    expect(isIAdminApiValidationError(undefined)).toBeFalsy();
  });
});

describe('CustomHttpException', () => {
  it('creates a 409 for RequiresForceDelete type', () => {
    const ex = new CustomHttpException({
      type: 'RequiresForceDelete',
      title: 'Role in use',
      message: 'Must force-delete',
      regarding: 'Admin (Role)',
    });
    expect(ex.getStatus()).toBe(409);
    expect(ex).toBeInstanceOf(HttpException);
  });

  it('creates a 400 for ValidationError type', () => {
    const ex = new CustomHttpException({
      type: 'ValidationError',
      title: 'Invalid submission.',
      data: { errors: {} },
    });
    expect(ex.getStatus()).toBe(400);
  });

  it('uses the provided status for general errors', () => {
    const ex = new CustomHttpException(
      { type: 'Error', title: 'Forbidden', message: 'No access' },
      403
    );
    expect(ex.getStatus()).toBe(403);
  });
});

describe('ValidationHttpException', () => {
  it('creates a 400 with field errors from field+message objects', () => {
    const ex = new ValidationHttpException(
      { field: 'username', message: 'Already taken' },
      { field: 'email', message: 'Invalid format' }
    );
    expect(ex.getStatus()).toBe(400);
    const body = ex.getResponse() as StatusResponse;
    expect(body.type).toBe('ValidationError');
  });

  it('creates a 400 from a plain string message', () => {
    const ex = new ValidationHttpException('Something went wrong');
    expect(ex.getStatus()).toBe(400);
  });
});
