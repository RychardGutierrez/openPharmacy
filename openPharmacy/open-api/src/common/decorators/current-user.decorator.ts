import {
  ExecutionContext,
  InternalServerErrorException,
  createParamDecorator,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedUser } from '../../modules/auth/interfaces/jwt-payload.interface';

/**
 * NestJS param decorator that injects the authenticated user from the
 * current request into a controller method parameter.
 *
 * The decorator reads `request.user` — a property set by `JwtStrategy.validate()`
 * after verifying the JWT. The user object contains only the fields needed
 * for authorization: `{ id, role, fullName, email }`.
 *
 * Usage:
 * ```ts
 * @Get('profile')
 * getProfile(@CurrentUser() user: AuthenticatedUser) {
 *   return `Hello ${user.fullName} (${user.role})`;
 * }
 * ```
 *
 * Only available on routes protected by `JwtAuthGuard`. If the route is not
 * protected (e.g., `@Public()` or no guard) the decorator throws an
 * `InternalServerErrorException` at runtime as a safety net.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      throw new InternalServerErrorException(
        'CurrentUser used on a route that is not protected by JwtAuthGuard',
      );
    }

    return user;
  },
);
