import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key read by `JwtAuthGuard` to decide whether a route requires
 * authentication. When `IS_PUBLIC_KEY` is set to `true` on a handler or class,
 * the guard skips JWT verification and allows unauthenticated access.
 *
 * Usage:
 * ```ts
 * @Public()
 * @Get('health')
 * health() { return { status: 'ok' }; }
 * ```
 *
 * `@Public()` can be placed on a single handler or on an entire controller
 * class. Handler-level metadata overrides class-level metadata.
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
