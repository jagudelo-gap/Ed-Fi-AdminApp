import { StatusResponse } from '@edanalytics/utils';
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { AxiosError } from 'axios';
import { Response } from 'express';

/**
 * Catch AxiosErrors from Admin API and convert them to StatusResponses.
 *
 * See {@link AdminApiServiceV1 } and {@link AdminApiControllerV1 } for
 * more details, but basically the pattern is that any "original" exceptions
 * (not HttpExceptions from Nest) that make it to this filter can be assumed
 * to have arisen in the route's ultimate Admin API call of interest. Other
 * exceptions (e.g. Admin API login, SBAA form validation, other intermediate
 * Admin API calls) are caught and handled in the service/controller. For
 * example, if an Axios 404 comes through, you know it's a 404 on the actual
 * Admin API resource of interest.
 */
@Catch(AxiosError)
export class AdminApiV1xExceptionFilter implements ExceptionFilter {
  catch(exception: AxiosError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // If it's not a failed Admin API response, we don't do anything here.
    if (!exception.response) throw exception;

    const status = exception.response.status;
    const body = exception.response.data;

    if (status === 403 || status === 401) {
      const result: StatusResponse = {
        title: 'Problem authorizing against Admin API',
        type: 'Error',
      };
      response.status(500).json(result);
      return;
    } else if (status === 404) {
      const result: StatusResponse = {
        title: 'Not found',
        type: 'Error',
      };
      response.status(404).json(result);
      return;
    } else if (typeof body === 'object') {
      if ('title' in body) {
        const result: StatusResponse = {
          title: body.title as string,
          type: 'Error',
          ...('message' in body ? { message: body.message as string } : {}),
          ...('errors' in body ? { data: body.errors as object } : {}),
        };
        response.status(500).json(result);
        return;
      } else if ('message' in body) {
        const result: StatusResponse = {
          title: body.message as string,
          type: 'Error',
        };
        response.status(500).json(result);
        return;
      }
    }
    const result: StatusResponse = {
      title: 'We encountered an unexpected error.',
      type: 'Error',
    };
    response.status(500).json(result);
  }
}

/** Admin API sometimes returns the below response alongside a 200 status code. It's a bug. */
export const failureBut200Response = {
  message:
    'The server encountered an unexpected condition that prevented it from fulfilling the request.',
};
