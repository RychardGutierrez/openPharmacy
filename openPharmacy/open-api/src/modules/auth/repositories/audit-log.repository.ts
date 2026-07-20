import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

/**
 * Audit event types tracked by the system. Each event maps to a single row in
 * the `auth.audit_logs` table. The naming follows `{ACTION}_{RESULT}` so
 * filtering by event is straightforward.
 */
export type AuditEvent =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAIL'
  | 'LOGIN_LOCKED'
  | 'REFRESH_SUCCESS'
  | 'REFRESH_FAIL'
  | 'LOGOUT';

/**
 * Shape passed to `AuditLogRepository.create()`. All fields except `event`
 * are optional so that unknown-email login attempts can be recorded without
 * a user reference.
 */
export interface AuditRecord {
  /** User who performed the action. `null` when unknown (e.g., bad email). */
  userId?: string | null;
  /** Which event occurred. */
  event: AuditEvent;
  /** Client IP from x-forwarded-for or socket. */
  ip?: string | null;
  /** User-agent header value. */
  userAgent?: string | null;
  /** Free-form JSON payload with per-event context. */
  metadata?: Prisma.InputJsonValue | null;
}

/**
 * Data-access layer for the `auth.audit_logs` table.
 *
 * Every login attempt (success or failure), refresh, and logout produces
 * exactly one audit row so that security events can be traced end-to-end.
 * See the lockout flow in `AuthService` for how these rows are written.
 */
@Injectable()
export class AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persist a single audit record.
   * `userId` can be `null` for attempts where the email does not match any
   * known user (enumeration prevention — the error message is identical
   * whether the email exists or not).
   */
  async create(record: AuditRecord): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        user_id: record.userId ?? null,
        event: record.event,
        ip: record.ip ?? null,
        user_agent: record.userAgent ?? null,
        metadata: record.metadata ?? Prisma.JsonNull,
      },
    });
  }

  /**
   * Count how many times a given event occurred for a user.
   * Used by e2e tests to verify the acceptance criteria (exactly N audit
   * rows per attempt type).
   */
  async countByUserAndEvent(
    userId: string,
    event: AuditEvent,
  ): Promise<number> {
    return this.prisma.auditLog.count({
      where: { user_id: userId, event },
    });
  }
}
