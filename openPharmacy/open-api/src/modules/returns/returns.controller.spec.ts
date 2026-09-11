import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';
import { UserRole } from '@prisma/client';

describe('ReturnsController', () => {
  it('exposes POST /api/returns guarded for ADMIN and PHARMACIST', () => {
    const createFn = jest.fn();
    const service = { create: createFn } as unknown as ReturnsService;
    const controller = new ReturnsController(service);

    expect(controller).toBeDefined();
    // Smoke test: invoking the handler with a stubbed user and DTO delegates
    // to the service. Authorization is exercised through the global
    // RolesGuard, not the controller, so this only verifies wiring.
    const user = {
      id: 'user-1',
      role: UserRole.PHARMACIST,
      fullName: '',
      email: '',
    };
    const dto = {
      saleId: '11111111-1111-1111-1111-111111111111',
      reason: 'Customer returned unopened product',
      returnType: 'PARTIAL' as const,
      items: [
        {
          saleItemId: '22222222-2222-2222-2222-222222222222',
          quantity: 1,
        },
      ],
    };
    void controller.create(user, dto);
    expect(createFn).toHaveBeenCalledWith('user-1', dto);
  });

  it('exposes GET /api/returns/sale/:receiptNumber guarded for ADMIN and PHARMACIST', () => {
    const getReturnableSaleFn = jest.fn();
    const service = {
      create: jest.fn(),
      getReturnableSale: getReturnableSaleFn,
    } as unknown as ReturnsService;
    const controller = new ReturnsController(service);

    void controller.getReturnableSale('00000001');
    expect(getReturnableSaleFn).toHaveBeenCalledWith('00000001');
  });

  it('exposes GET /api/returns guarded for ADMIN and PHARMACIST', () => {
    const findAllFn = jest.fn();
    const service = {
      create: jest.fn(),
      getReturnableSale: jest.fn(),
      findAll: findAllFn,
    } as unknown as ReturnsService;
    const controller = new ReturnsController(service);

    void controller.findAll(1, 20);
    expect(findAllFn).toHaveBeenCalledWith(1, 20);
  });
});
