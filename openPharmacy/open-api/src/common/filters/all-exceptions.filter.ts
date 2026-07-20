import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global exception filter registered as `APP_FILTER`.
 *
 * Intercepts every unhandled exception in the request pipeline and returns a
 * consistent JSON response shape.  Client gets a safe HTTP status + message;
 * internal details (stack traces) are logged server-side only.
 *
 * Response shape:
 * ```json
 * {
 *   "statusCode": 401,
 *   "message": "Invalid credentials",
 *   "error": "Unauthorized",
 *   "path": "/api/auth/login",
 *   "timestamp": "2026-07-12T18:00:00.000Z"
 * }
 * ```
 *
 * - **4xx** — logged as a single-line `warn` with the request path and body.
 * - **5xx** — logged as an `error` with the full stack trace.
 * - **Non-HttpException** (unexpected crashes) — converted to 500.
 *
 * The `message` field is whatever the thrown exception provides (safe,
 * user-facing text).  Internal error details never leak to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload = isHttp
      ? exception.getResponse()
      : { message: 'Internal server error' };

    const body =
      typeof payload === 'string'
        ? { statusCode: status, message: payload }
        : (payload as Record<string, unknown>);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} -> ${status} ${JSON.stringify(body)}`,
      );
    }

    response.status(status).json({
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      ...body,
    });
  }
}
