import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma, User } from '@prisma/client';

/**
 * Data-access layer for the `auth.users` table, scoped to the authentication
 * flow.  Every method here is called from `AuthService`.
 *
 * Methods intentionally avoid exposing `passwordHash` or lockout fields to
 * the caller unless they are explicitly needed — the returned `User` type
 * includes them for transparency, but the service layer is responsible for
 * keeping them out of API responses (see `UserResponseDto`).
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Look up an active user by email. Soft-deleted users (`deleted_at IS NOT
   * NULL`) are excluded so they cannot authenticate.
   * Called by `AuthService.login()` on every login attempt.
   */
  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email, deleted_at: null },
    });
  }

  /**
   * Look up an active user by ID.
   * Called by `JwtStrategy.validate()` on every authenticated request and
   * by `AuthService.refresh()` to check user status before issuing new tokens.
   */
  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id, deleted_at: null },
    });
  }

  /**
   * Reset the lockout counter and stamp `last_login` after a successful
   * authentication.  Called inside the login transaction so that a success
   * and its audit row are atomic.
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
   * When `lockedUntil` is not null the account is considered locked until that
   * timestamp (checked in `AuthService.login()` before bcrypt).
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
   * Stamp the time the user last changed their password.  `JwtStrategy`
   * compares this against `JWT.iat` to reject access tokens issued before the
   * change.  Call this when implementing the "change password" endpoint.
   */
  async setPasswordChangedAt(id: string, now: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { password_changed_at: now },
    });
  }

  /**
   * Create a new user (unchecked input — only used by the seed script and
   * future admin endpoints).
   */
  create(data: Prisma.UserUncheckedCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }
}
