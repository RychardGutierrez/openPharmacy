import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export interface HasRoleAndRegNumber {
  role: UserRole;
  regNumber?: string;
}

/**
 * Class-validator decorator that requires `regNumber` to be a non-empty string
 * when `role` is `PHARMACIST`.
 *
 * Usage:
 *   @RegNumberRequiredForPharmacist()
 *   export class CreateUserDto { ... }
 */
export function RegNumberRequiredForPharmacist(
  validationOptions?: ValidationOptions,
): ClassDecorator {
  return function (target: object) {
    registerDecorator({
      name: 'RegNumberRequiredForPharmacist',
      target: target as new (...args: unknown[]) => unknown,
      propertyName: '',
      options: validationOptions,
      validator: {
        validate(_value: unknown, args: ValidationArguments) {
          const dto = args.object as HasRoleAndRegNumber;
          if (dto.role === UserRole.PHARMACIST) {
            return (
              typeof dto.regNumber === 'string' &&
              dto.regNumber.trim().length > 0
            );
          }
          return true;
        },
        defaultMessage() {
          return 'regNumber is required when role is PHARMACIST';
        },
      },
    });
  };
}
