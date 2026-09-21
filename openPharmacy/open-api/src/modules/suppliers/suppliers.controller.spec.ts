import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

describe('SuppliersController', () => {
  it('exposes /api/suppliers CRUD endpoints', () => {
    const service = {
      findAll: jest.fn().mockReturnValue([]),
      findAllPaginated: jest.fn().mockReturnValue({ data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 }),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as SuppliersService;

    const controller = new SuppliersController(service);
    expect(controller).toBeDefined();

    controller.findAll();
    expect(service.findAll).toHaveBeenCalled();
  });
});
