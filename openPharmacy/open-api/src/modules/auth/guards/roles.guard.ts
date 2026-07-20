import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

/**
 * Authorization guard registered globally as `APP_GUARD`.
 *
 * Runs after `JwtAuthGuard` (the order of `APP_GUARD` registrations in
 * `AuthModule`). Reads the `@Roles()` decorator metadata from the handler
 * and compares the required roles against `req.user.role`.
 *
 * - No `@Roles()` decorator → allow any authenticated user.
 * - User role not in the list → `ForbiddenException`.
 * - No authenticated user on `req.user` → `ForbiddenException` (defensive).
 *
 * Handler-level `@Roles()` overrides a class-level `@Roles()`.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) {
      throw new ForbiddenException('Authenticated user not found on request');
    }
    if (!required.includes(user.role)) {
      throw new ForbiddenException(
        `Role ${user.role} is not authorized for this resource`,
      );
    }
    return true;
  }
}
