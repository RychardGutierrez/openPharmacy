/* eslint-disable @typescript-eslint/unbound-method */
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

describe('SuppliersController', () => {
  function buildController() {
    const service = {
      findAll: jest.fn().mockReturnValue([]),
      findAllPaginated: jest.fn().mockReturnValue({
        data: [],
        total: 0,
        page: 1,
        pageSize: 50,
        totalPages: 0,
      }),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deactivate: jest.fn(),
      activate: jest.fn(),
    } as unknown as jest.Mocked<SuppliersService>;

    return { controller: new SuppliersController(service), service };
  }

  it('exposes the supplier CRUD + soft-delete endpoints', () => {
    const { controller, service } = buildController();
    const user = { id: 'u-1' } as never;
    const request = { headers: {}, ip: '', socket: {} } as never;

    void controller.findAll();
    expect(service.findAll).toHaveBeenCalled();

    void controller.create({ name: 'Acme', nit: '123' }, user, request);
    expect(service.create).toHaveBeenCalled();

    void controller.deactivate('s-1', user, request);
    expect(service.deactivate).toHaveBeenCalledWith(
      's-1',
      'u-1',
      expect.anything(),
    );

    void controller.activate('s-1', user, request);
    expect(service.activate).toHaveBeenCalledWith(
      's-1',
      'u-1',
      expect.anything(),
    );
  });

  it('has no hard-delete remove method', () => {
    const { controller } = buildController();
    expect(
      (controller as unknown as { remove?: unknown }).remove,
    ).toBeUndefined();
  });
});
