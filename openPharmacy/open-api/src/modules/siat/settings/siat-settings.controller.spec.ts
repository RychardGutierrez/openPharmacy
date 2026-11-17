import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import { SiatSettingsController } from './siat-settings.controller';

describe('SiatSettingsController', () => {
  it('is restricted to ADMIN, for reads and writes', () => {
    expect(Reflect.getMetadata(ROLES_KEY, SiatSettingsController)).toEqual([
      UserRole.ADMIN,
    ]);
    for (const method of ['get', 'update', 'testConnection'] as const) {
      // No method-level @Roles may widen the class-level restriction.
      expect(
        Reflect.getMetadata(
          ROLES_KEY,
          SiatSettingsController.prototype[method],
        ),
      ).toBeUndefined();
    }
  });
});
