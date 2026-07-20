/* eslint-disable @typescript-eslint/unbound-method */
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

const buildContext = (): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers: {} }),
    }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  }) as unknown as ExecutionContext;

describe('JwtAuthGuard', () => {
  it('returns true when the route is marked @Public()', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);

    expect(guard.canActivate(buildContext())).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      expect.anything(),
      expect.anything(),
    ]);
  });

  it('delegates to the passport JWT strategy when route is not public', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);
    const proto = Object.getPrototypeOf(JwtAuthGuard.prototype) as {
      canActivate: (...args: unknown[]) => boolean;
    };
    const superSpy = jest.spyOn(proto, 'canActivate').mockReturnValue(true);

    expect(guard.canActivate(buildContext())).toBe(true);
    expect(superSpy).toHaveBeenCalled();
  });
});
