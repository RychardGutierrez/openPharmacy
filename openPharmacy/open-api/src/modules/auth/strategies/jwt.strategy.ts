/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersRepository } from '../repositories/users.repository';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../interfaces/jwt-payload.interface';

/** Used in `@AuthGuard('jwt')` references (e.g., `JwtAuthGuard`). */
export const STRATEGY_NAME = 'jwt';

/** Config namespace for the access-token secret. */
export const ACCESS_SECRET_KEY = 'auth.accessSecret';

/**
 * JWT `iat` is stored in seconds since epoch. Multiply by this to compare
 * against JavaScript `Date.getTime()` which returns milliseconds.
 */
const MS_PER_SECOND = 1000;

/**
 * Error messages exposed to the client. They are intentionally vague for the
 * "not found" case (no user enumeration).
 */
const ERROR_USER_INACTIVE = 'User not found or inactive';
const ERROR_TOKEN_INVALIDATED = 'Token invalidated by password change';

/**
 * Passport strategy that extracts and verifies the JWT access token.
 *
 * - Token source: `Authorization: Bearer <token>` header.
 * - Verification: HS256 using `JWT_ACCESS_SECRET` from config.
 * - Expiration: the library checks `exp` automatically (`ignoreExpiration: false`).
 *
 * On every authenticated request the `validate()` callback re-fetches the
 * user from the database so that:
 *   - a deactivated or soft-deleted user cannot use a still-valid JWT.
 *   - a token issued before `password_changed_at` is rejected.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, STRATEGY_NAME) {
  constructor(
    config: ConfigService,
    private readonly users: UsersRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>(ACCESS_SECRET_KEY),
    });
  }

  /**
   * Called by Passport after the JWT signature and expiration have been
   * verified. Returns a sanitised user object (`AuthenticatedUser`) that
   * will be attached to `request.user`.
   *
   * Rejects the request if:
   *   - the user does not exist, is inactive, or is soft-deleted
   *   - the token's `iat` is older than `user.password_changed_at`
   *     (password changed after this token was issued)
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.users.findById(payload.sub);
    if (!user || !user.active) {
      throw new UnauthorizedException(ERROR_USER_INACTIVE);
    }

    if (user.password_changed_at && payload.iat) {
      const tokenIssuedAtMs = payload.iat * MS_PER_SECOND;
      if (tokenIssuedAtMs < user.password_changed_at.getTime()) {
        throw new UnauthorizedException(ERROR_TOKEN_INVALIDATED);
      }
    }

    return {
      id: user.id,
      role: user.roleName,
      fullName: user.full_name,
      email: user.email,
    };
  }
}
