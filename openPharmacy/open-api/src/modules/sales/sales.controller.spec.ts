import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { ReturnsService } from '../returns/returns.service';

describe('SalesController', () => {
  it('exposes POST /api/sales/:id/cancel guarded for ADMIN/PHARMACIST', () => {
    const salesService = {} as unknown as SalesService;
    const cancelFn = jest.fn().mockResolvedValue({ id: 'cancel-sale-1' });
    const returnsService = { cancel: cancelFn } as unknown as ReturnsService;

    const controller = new SalesController(salesService, returnsService);

    const user = { id: 'user-1', role: 'PHARMACIST', fullName: '', email: '' };
    void controller.cancel(user, '11111111-1111-1111-1111-111111111111', {
      reason: 'Duplicate sale recorded',
    });

    expect(cancelFn).toHaveBeenCalledWith(
      'user-1',
      '11111111-1111-1111-1111-111111111111',
      { reason: 'Duplicate sale recorded' },
    );
  });
});
