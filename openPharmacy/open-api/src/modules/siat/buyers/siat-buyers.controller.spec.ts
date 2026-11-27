import { ValidationPipe } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { ResolveBuyerDto, VerifyNitDto } from './dto/siat-buyers.dto';
import type { SiatBuyerService } from './siat-buyer.service';
import { SiatBuyersController } from './siat-buyers.controller';
import type { SiatCustomersService } from './siat-customers.service';
import type { SiatNitVerificationService } from './siat-nit-verification.service';

const roles = (method: keyof SiatBuyersController): unknown =>
  Reflect.getMetadata(
    ROLES_KEY,
    SiatBuyersController.prototype[method],
  ) as unknown;

const cashier: AuthenticatedUser = {
  id: 'user-1',
  role: UserRole.CASHIER,
  fullName: 'Caja',
  email: 'caja@example.com',
};

describe('SiatBuyersController (SIAT-10)', () => {
  it('lets only selling roles verify a NIT', () => {
    expect(roles('verifyNit')).toEqual([UserRole.CASHIER, UserRole.PHARMACIST]);
  });

  it('opens resolve and customer search to selling roles and ADMIN', () => {
    for (const method of ['resolve', 'searchCustomers'] as const) {
      expect(roles(method)).toEqual([
        UserRole.CASHIER,
        UserRole.PHARMACIST,
        UserRole.ADMIN,
      ]);
    }
  });

  it('passes the caller id and role to the services', async () => {
    const nits = { verify: jest.fn(() => Promise.resolve({})) };
    const buyers = { resolve: jest.fn(() => Promise.resolve({})) };
    const customers = { search: jest.fn(() => Promise.resolve([])) };
    const controller = new SiatBuyersController(
      buyers as unknown as SiatBuyerService,
      nits as unknown as SiatNitVerificationService,
      customers as unknown as SiatCustomersService,
    );

    await controller.verifyNit({ nit: '1020304022' }, cashier);
    await controller.resolve({ total: 10 }, cashier);
    await controller.searchCustomers({ docNumber: '102', docType: 5 });

    expect(nits.verify).toHaveBeenCalledWith('1020304022', 'user-1');
    expect(buyers.resolve).toHaveBeenCalledWith(
      { total: 10 },
      UserRole.CASHIER,
    );
    expect(customers.search).toHaveBeenCalledWith('102', 5);
  });

  describe('DTO validation (global pipe options)', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const body = (metatype: new () => object) => ({
      type: 'body' as const,
      metatype,
    });

    it('rejects a non-numeric NIT', async () => {
      await expect(
        pipe.transform({ nit: '12AB' }, body(VerifyNitDto)),
      ).rejects.toThrow();
    });

    it('rejects unknown buyer fields and a total with 3 decimals', async () => {
      await expect(
        pipe.transform(
          { total: 10, buyer: { docType: 5, extra: 'x' } },
          body(ResolveBuyerDto),
        ),
      ).rejects.toThrow();
      await expect(
        pipe.transform({ total: 10.123 }, body(ResolveBuyerDto)),
      ).rejects.toThrow();
    });

    it('accepts a resolve body without a buyer', async () => {
      await expect(
        pipe.transform({ total: '99.90' }, body(ResolveBuyerDto)),
      ).resolves.toMatchObject({ total: 99.9 });
    });
  });
});
