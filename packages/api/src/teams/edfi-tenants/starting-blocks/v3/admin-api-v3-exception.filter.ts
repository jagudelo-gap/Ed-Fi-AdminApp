import { StatusResponse } from '@edanalytics/utils';
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { AxiosError } from 'axios';
import { Response } from 'express';

/**
 * Problem-details body shape returned by the Admin API V3, per RFC 7807.
 * `errors` is a map of field name to a list of validation messages, present
 * on 400-class validation failures (e.g. from ASP.NET Core model validation).
 */
interface AdminApiV3ProblemDetails {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  errors?: Record<string, string[]>;
}

function isAdminApiV3ProblemDetails(body: unknown): body is AdminApiV3ProblemDetails {
  return (
    typeof body === 'object' &&
    body !== null &&
    'title' in body &&
    typeof (body as { title: unknown }).title === 'string'
  );
}

/**
 * Catch AxiosErrors from Admin API V3 and convert them to StatusResponses.
 *
 * See AdminApiServiceV3 and AdminApiControllerV3 for
 * more details, but basically the pattern is that any "original" exceptions
 * (not HttpExceptions from Nest) that make it to this filter can be assumed
 * to have arisen in the route's ultimate Admin API call of interest. Other
 * exceptions (e.g. Admin API login, SBAA form validation, other intermediate
 * Admin API calls) are caught and handled in the service/controller.
 *
 * Unlike {@link AdminApiV1xExceptionFilter}, this filter parses the Admin
 * API V3's RFC 7807 problem-details error shape and preserves the upstream
 * HTTP status for non-auth/404 errors, so 400-class validation errors
 * round-trip correctly to the frontend.
 */
@Catch(AxiosError)
export class AdminApiV3ExceptionFilter implements ExceptionFilter {
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
    } else if (isAdminApiV3ProblemDetails(body)) {
      const result: StatusResponse = {
        title: body.title,
        type: 'Error',
        ...(body.detail ? { message: body.detail } : {}),
        ...(body.errors ? { data: body.errors as object } : {}),
      };
      response.status(status).json(result);
      return;
    }
    const result: StatusResponse = {
      title: 'We encountered an unexpected error.',
      type: 'Error',
    };
    response.status(500).json(result);
  }
}
