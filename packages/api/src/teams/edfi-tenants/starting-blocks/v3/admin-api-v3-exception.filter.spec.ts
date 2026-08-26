import 'reflect-metadata';
import { ArgumentsHost } from '@nestjs/common';
import { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { AdminApiV3ExceptionFilter } from './admin-api-v3-exception.filter';

describe('AdminApiV3ExceptionFilter', () => {
  let filter: AdminApiV3ExceptionFilter;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new AdminApiV3ExceptionFilter();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
      }),
    } as unknown as ArgumentsHost;
  });

  function makeAxiosError(status: number, data: unknown): AxiosError {
    return {
      isAxiosError: true,
      name: 'AxiosError',
      message: 'Request failed',
      config: {} as InternalAxiosRequestConfig,
      toJSON: () => ({}),
      response: {
        status,
        statusText: '',
        data,
        headers: {},
        config: {} as InternalAxiosRequestConfig,
      },
    } as unknown as AxiosError;
  }

  it('rethrows when the AxiosError has no response (e.g. network error)', () => {
    const error = { isAxiosError: true, response: undefined } as unknown as AxiosError;
    let thrown: unknown;
    try {
      filter.catch(error, host);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBe(error);
  });

  it('maps a 401 to a 500 authorization-problem StatusResponse', () => {
    const error = makeAxiosError(401, { title: 'Unauthorized', status: 401 });
    filter.catch(error, host);
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      title: 'Problem authorizing against Admin API',
      type: 'Error',
    });
  });

  it('maps a 403 to a 500 authorization-problem StatusResponse', () => {
    const error = makeAxiosError(403, { title: 'Forbidden', status: 403 });
    filter.catch(error, host);
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      title: 'Problem authorizing against Admin API',
      type: 'Error',
    });
  });

  it('passes through a 404 as a 404 StatusResponse', () => {
    const error = makeAxiosError(404, { title: 'Not Found', status: 404 });
    filter.catch(error, host);
    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({
      title: 'Not found',
      type: 'Error',
    });
  });

  it('parses an RFC 7807 problem-details body with a validation errors map, preserving the upstream status', () => {
    const problemDetails = {
      type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
      title: 'One or more validation errors occurred.',
      status: 400,
      detail: 'Data validation failed',
      errors: {
        Name: ['A vendor with this name already exists.'],
      },
    };
    const error = makeAxiosError(400, problemDetails);
    filter.catch(error, host);
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      title: 'One or more validation errors occurred.',
      type: 'Error',
      message: 'Data validation failed',
      data: problemDetails.errors,
    });
  });

  it('parses an RFC 7807 problem-details body with no detail/errors', () => {
    const problemDetails = {
      title: 'Internal Server Error',
      status: 500,
    };
    const error = makeAxiosError(500, problemDetails);
    filter.catch(error, host);
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      title: 'Internal Server Error',
      type: 'Error',
    });
  });

  it('falls back to a generic 500 for an unexpected non-problem-details body', () => {
    const error = makeAxiosError(502, 'Bad Gateway');
    filter.catch(error, host);
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      title: 'We encountered an unexpected error.',
      type: 'Error',
    });
  });
});
