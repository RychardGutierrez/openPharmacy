import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User, UserRole } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface UsersQuery {
  page: number;
  pageSize: number;
  role?: UserRole;
  active?: boolean;
  q?: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Fields that should never be sent to the client or exposed outside of auth.
const SENSITIVE_USER_FIELDS: Prisma.UserOmit = {
  passwordHash: true,
  failed_attempts: true,
  locked_until: true,
  last_failed_at: true,
  password_changed_at: true,
};

/**
 * Data-access layer for the `auth.users` table.
 *
 * This is the single source of truth for user persistence. All access to the
 * `users` table from `AuthService` and `UsersService` goes through this
 * repository. It enforces the soft-delete policy: no `prisma.user.delete()` is
 * exposed here; deactivation is always done via `softDelete()`.
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Auth-only helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Look up an active user by email. Soft-deleted users are excluded so they
   * cannot authenticate.
   */
  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email, deleted_at: null },
    });
  }

  /**
   * Look up an active user by ID. Called by `JwtStrategy.validate()` and
   * `AuthService.refresh()`.
   */
  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id, deleted_at: null },
    });
  }

  /**
   * Reset the lockout counter and stamp `last_login` after a successful
   * authentication.
   */
  async registerSuccessfulLogin(id: string, now: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        failed_attempts: 0,
        locked_until: null,
        last_failed_at: null,
        last_login: now,
      },
    });
  }

  /**
   * Increment the failed-attempt counter and optionally set a lockout window.
   */
  async registerFailedAttempt(
    id: string,
    failedAttempts: number,
    lockedUntil: Date | null,
    now: Date,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        failed_attempts: failedAttempts,
        locked_until: lockedUntil,
        last_failed_at: now,
      },
    });
  }

  /**
   * Stamp the time the user last changed their password.
   */
  async setPasswordChangedAt(id: string, now: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { password_changed_at: now },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // User-management helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Create a new user with a pre-hashed password.
   */
  createWithHashedPassword(
    data: Omit<
      Prisma.UserUncheckedCreateInput,
      | 'passwordHash'
      | 'failed_attempts'
      | 'locked_until'
      | 'last_failed_at'
      | 'password_changed_at'
      | 'active'
    >,
    passwordHash: string,
  ): Promise<User> {
    return this.prisma.user.create({
      data: {
        ...data,
        passwordHash,
        active: true,
        deleted_at: null,
        failed_attempts: 0,
        locked_until: null,
        last_failed_at: null,
        password_changed_at: null,
      },
    });
  }

  /**
   * Transaction-aware version of createWithHashedPassword.
   */
  createWithHashedPasswordTx(
    tx: Prisma.TransactionClient,
    data: Omit<
      Prisma.UserUncheckedCreateInput,
      | 'passwordHash'
      | 'failed_attempts'
      | 'locked_until'
      | 'last_failed_at'
      | 'password_changed_at'
      | 'active'
    >,
    passwordHash: string,
  ): Promise<User> {
    return tx.user.create({
      data: {
        ...data,
        passwordHash,
        active: true,
        deleted_at: null,
        failed_attempts: 0,
        locked_until: null,
        last_failed_at: null,
        password_changed_at: null,
      },
    });
  }

  /**
   * Create a user with an unchecked create input. Used by the seed script.
   */
  create(data: Prisma.UserUncheckedCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  /**
   * Find a user by ID, including soft-deleted users. Used by the admin view.
   */
  findByIdIncludingDeleted(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      omit: SENSITIVE_USER_FIELDS,
    });
  }

  /**
   * Paginated, filterable user list. Always excludes sensitive fields.
   */
  async findAllPaginated(query: UsersQuery): Promise<Paginated<User>> {
    const { page, pageSize, role, active, q } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.UserWhereInput = {
      deleted_at: active === false ? { not: null } : null,
    };

    if (role) {
      where.roleName = role;
    }

    if (q) {
      where.OR = [
        { full_name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { ci: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        omit: SENSITIVE_USER_FIELDS,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Update any editable user fields. Excludes sensitive auth fields.
   */
  async update(
    id: string,
    data: Prisma.UserUncheckedUpdateInput,
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
      omit: SENSITIVE_USER_FIELDS,
    });
  }

  /**
   * Transaction-aware version of update.
   */
  updateTx(
    tx: Prisma.TransactionClient,
    id: string,
    data: Prisma.UserUncheckedUpdateInput,
  ): Promise<User> {
    return tx.user.update({
      where: { id },
      data,
      omit: SENSITIVE_USER_FIELDS,
    });
  }

  /**
   * Soft-delete a user and set active=false. Fails if the user is already
   * soft-deleted.
   */
  async softDelete(id: string, now: Date): Promise<User> {
    return this.softDeleteTx(this.prisma, id, now);
  }

  /**
   * Transaction-aware version of softDelete.
   */
  async softDeleteTx(
    tx: Prisma.TransactionClient,
    id: string,
    now: Date,
  ): Promise<User> {
    const result = await tx.user.updateMany({
      where: { id, deleted_at: null },
      data: {
        deleted_at: now,
        active: false,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException(
        `User ${id} not found or already deactivated`,
      );
    }

    return tx.user.findUniqueOrThrow({
      where: { id },
      omit: SENSITIVE_USER_FIELDS,
    });
  }

  /**
   * Reactivate a soft-deleted user.
   */
  async restore(id: string): Promise<User> {
    return this.restoreTx(this.prisma, id);
  }

  /**
   * Transaction-aware version of restore.
   */
  async restoreTx(tx: Prisma.TransactionClient, id: string): Promise<User> {
    const result = await tx.user.updateMany({
      where: { id, deleted_at: { not: null } },
      data: {
        deleted_at: null,
        active: true,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException(`User ${id} not found or already active`);
    }

    return tx.user.findUniqueOrThrow({
      where: { id },
      omit: SENSITIVE_USER_FIELDS,
    });
  }

  /**
   * Count active users with a given role.
   */
  countActiveByRole(role: UserRole): Promise<number> {
    return this.prisma.user.count({
      where: { roleName: role, active: true, deleted_at: null },
    });
  }

  /**
   * Existence checks for uniqueness validation.
   */
  existsActiveByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email, deleted_at: null },
    });
  }

  existsActiveByEmailExcept(email: string, id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email, deleted_at: null, NOT: { id } },
    });
  }

  existsActiveByCi(ci: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { ci, deleted_at: null },
    });
  }

  existsActiveByCiExcept(ci: string, id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { ci, deleted_at: null, NOT: { id } },
    });
  }
}
