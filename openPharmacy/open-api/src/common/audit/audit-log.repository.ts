import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { AuditEvent } from './audit-event';

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
 * Centralized in `common/audit` because both the authentication module and
 * the user-management module need to write security audit rows. Any module that
 * imports `AuditModule` can use this repository.
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
      data: this.buildData(record),
    });
  }

  /**
   * Persist a single audit record inside an existing Prisma transaction.
   */
  async createInTx(
    tx: Prisma.TransactionClient,
    record: AuditRecord,
  ): Promise<void> {
    await tx.auditLog.create({
      data: this.buildData(record),
    });
  }

  private buildData(record: AuditRecord): Prisma.AuditLogUncheckedCreateInput {
    return {
      user_id: record.userId ?? null,
      event: record.event,
      ip: record.ip ?? null,
      user_agent: record.userAgent ?? null,
      metadata: record.metadata ?? Prisma.JsonNull,
    };
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
