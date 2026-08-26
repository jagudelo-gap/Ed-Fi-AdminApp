import 'reflect-metadata';
import { AggregateErrorHandler } from './aggregate-error-handler';

function makeAggregateError(errors: unknown[]): Error {
  const err = new Error('aggregate') as Error & { name: string; errors: unknown[] };
  err.name = 'AggregateError';
  err.errors = errors;
  return err;
}

function makeDbError(message: string, code?: string): Error {
  const err = new Error(message) as Error & { code?: string };
  if (code) err.code = code;
  return err;
}

describe('AggregateErrorHandler.isAggregateError', () => {
  it('returns true for a well-formed AggregateError-like object', () => {
    const err = makeAggregateError([new Error('inner')]);
    expect(AggregateErrorHandler.isAggregateError(err)).toBe(true);
  });

  it('returns false for a regular Error', () => {
    expect(AggregateErrorHandler.isAggregateError(new Error('plain'))).toBe(false);
  });

  it('returns false for null', () => {
    expect(AggregateErrorHandler.isAggregateError(null)).toBe(false);
  });

  it('returns false for a string', () => {
    expect(AggregateErrorHandler.isAggregateError('oops')).toBe(false);
  });
});

describe('AggregateErrorHandler.handle', () => {
  it('identifies database errors inside an AggregateError', () => {
    const err = makeAggregateError([makeDbError('database connection lost', 'ECONNREFUSED')]);
    const result = AggregateErrorHandler.handle(err);
    expect(result.isDatabaseRelated).toBe(true);
    expect(result.safeMessage).toBe('Database connection issues detected');
  });

  it('marks non-database AggregateError as not database-related', () => {
    const err = makeAggregateError([new Error('some random error')]);
    const result = AggregateErrorHandler.handle(err);
    expect(result.isDatabaseRelated).toBe(false);
    expect(result.safeMessage).toBe('Multiple system errors occurred');
  });

  it('handles a plain database error (non-AggregateError)', () => {
    const err = makeDbError('connection refused', 'ECONNREFUSED');
    const result = AggregateErrorHandler.handle(err);
    expect(result.isDatabaseRelated).toBe(true);
  });

  it('handles a plain non-database error', () => {
    const err = new Error('permission denied');
    const result = AggregateErrorHandler.handle(err);
    expect(result.isDatabaseRelated).toBe(false);
    expect(result.safeMessage).toBe('permission denied');
  });

  it('handles an unknown non-Error value', () => {
    const result = AggregateErrorHandler.handle('a string error');
    expect(result.isDatabaseRelated).toBe(false);
    expect(result.safeMessage).toBe('Unknown error occurred');
  });
});

describe('AggregateErrorHandler.extractAllMessages', () => {
  it('extracts messages from all inner errors', () => {
    const err = makeAggregateError([new Error('msg1'), new Error('msg2')]);
    expect(AggregateErrorHandler.extractAllMessages(err)).toEqual(['msg1', 'msg2']);
  });

  it('returns a single-element array for a plain Error', () => {
    expect(AggregateErrorHandler.extractAllMessages(new Error('plain'))).toEqual(['plain']);
  });

  it('handles non-Error inner values by stringifying them', () => {
    const err = makeAggregateError(['a string', 42]);
    const msgs = AggregateErrorHandler.extractAllMessages(err);
    expect(msgs).toContain('a string');
    expect(msgs).toContain('42');
  });
});
