import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

/**
 * Metadata key read by `RolesGuard` to determine the roles that are allowed to
 * access a controller handler.
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator that restricts a route to one or more user roles.
 *
 * Usage:
 * ```ts
 * @Roles(UserRole.ADMIN)
 * @Get('sensitive')
 * getSensitiveData() { ... }
 *
 * @Roles(UserRole.ADMIN, UserRole.PHARMACIST)
 * @Get('pharmacy-data')
 * getPharmacyData() { ... }
 * ```
 *
 * The decorator stores the required role list as metadata under `ROLES_KEY`.
 * `RolesGuard` (registered globally as `APP_GUARD`) reads this metadata and
 * compares it against `req.user.role` (set by `JwtStrategy.validate`).
 *
 * - If no `@Roles()` decorator is present, the route is accessible by any
 *   authenticated user.
 * - If the user's role is not in the list, the guard throws
 *   `ForbiddenException`.
 * - Handler-level metadata overrides any class-level metadata.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
