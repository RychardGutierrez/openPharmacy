import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { STRATEGY_NAME } from '../strategies/jwt.strategy';

/**
 * Authentication guard registered globally as `APP_GUARD`.
 *
 * Two behaviours:
 * 1. **Public routes** — If the handler or its class has the `@Public()`
 *    decorator, the guard returns `true` immediately without checking the JWT.
 * 2. **Protected routes** — Delegates to `passport-jwt` via
 *    `AuthGuard(STRATEGY_NAME)`. The JWT is extracted from the
 *    `Authorization: Bearer` header, verified using `JWT_ACCESS_SECRET`, and
 *    the payload is validated by `JwtStrategy.validate()`.
 *
 * Handler-level `@Public()` overrides a class-level `@Public()`.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard(STRATEGY_NAME) {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }
}
