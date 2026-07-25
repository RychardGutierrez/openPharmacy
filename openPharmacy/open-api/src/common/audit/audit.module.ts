import { Module } from '@nestjs/common';
import { AuditLogRepository } from './audit-log.repository';

/**
 * Cross-cutting audit module.
 *
 * Exposes `AuditLogRepository` to any feature module that needs to persist
 * security/operation audit rows. Imported by `AuthModule` and `UsersModule`.
 */
@Module({
  providers: [AuditLogRepository],
  exports: [AuditLogRepository],
})
export class AuditModule {}
