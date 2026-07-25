import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { Request } from 'express';
import { AuditLogRepository } from '../../../common/audit/audit-log.repository';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly audit: AuditLogRepository) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const startedAt = Date.now();
    const route = `${request.method} ${request.url}`;

    return next.handle().pipe(
      tap(() => {
        this.logger.debug(
          `${route} ok in ${Date.now() - startedAt}ms (interceptor)`,
        );
      }),
      catchError((err: unknown) => {
        this.logger.debug(
          `${route} failed in ${Date.now() - startedAt}ms: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        return throwError(() => err as Error);
      }),
    );
  }
}
