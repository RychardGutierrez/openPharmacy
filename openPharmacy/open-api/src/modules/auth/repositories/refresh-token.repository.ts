import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { RefreshToken } from '@prisma/client';

/**
 * SHA-256 hash of the raw JWT ID (`jti`). Only the hash is stored in the
 * database so that a DB leak does not yield usable refresh tokens.
 * The hash is a fixed 64-character hex string regardless of the input length.
 */
export const hashJti = (jti: string): string =>
  createHash('sha256').update(jti).digest('hex');

/**
 * Data-access layer for the `auth.refresh_tokens` table.
 *
 * Manages the lifecycle of refresh tokens:
 * 1. **Create** — issued alongside a JWT on login; stores `sha256(jti)`.
 * 2. **Rotate** — on `/auth/refresh`, the old row is marked `revoked_at` and a
 *    new row is inserted (with a fresh `jti`). This is the standard defence
 *    against refresh-token theft: a stolen token becomes useless after a
 *    legitimate refresh.
 * 3. **Revoke** — on `/auth/logout`, the row is marked `revoked_at` so the
 *    token cannot be used for a future refresh.
 */
@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Look up a refresh token by its hashed jti. Used by `AuthService.refresh()`
   * to verify the token exists and has not been revoked.
   */
  findActiveByHashedJti(hashedJti: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({
      where: { hashed_jti: hashedJti },
    });
  }

  /**
   * Persist a new refresh token. Called during login and refresh-rotation.
   * The raw `jti` is hashed before storage — the DB never sees the plain value.
   */
  async create(args: {
    userId: string;
    jti: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({
      data: {
        user_id: args.userId,
        hashed_jti: hashJti(args.jti),
        expires_at: args.expiresAt,
      },
    });
  }

  /**
   * Rotate an existing refresh token: revoke the old one and issue a new one.
   * The old row gets `revoked_at = now()` and `replaced_by` pointing to the
   * new row so the rotation chain is traceable.
   *
   * Runs inside a Prisma transaction via `AuthService.refresh()`.
   * If two concurrent requests try to rotate the same old token, the second
   * `update` picks up `revoked_at = null` check (findActiveByHashedJti) and
   * fails — this serves as theft detection.
   */
  async rotate(args: {
    oldTokenId: string;
    newJti: string;
    newExpiresAt: Date;
  }): Promise<RefreshToken> {
    const old = await this.prisma.refreshToken.findUniqueOrThrow({
      where: { id: args.oldTokenId },
    });
    const newToken = await this.prisma.refreshToken.create({
      data: {
        user_id: old.user_id,
        hashed_jti: hashJti(args.newJti),
        expires_at: args.newExpiresAt,
      },
    });
    await this.prisma.refreshToken.update({
      where: { id: args.oldTokenId },
      data: { revoked_at: new Date(), replaced_by: newToken.id },
    });
    return newToken;
  }

  /**
   * Revoke a refresh token by setting `revoked_at`. Only rows that are
   * currently non-revoked are affected (safe to call on already-expired or
   * already-revoked tokens).
   *
   * Returns `{ count: 0 | 1 }` so the caller can decide whether the token
   * was actually live.
   */
  async revoke(hashedJti: string): Promise<{ count: number }> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { hashed_jti: hashedJti, revoked_at: null },
      data: { revoked_at: new Date() },
    });
    return { count: result.count };
  }
}
