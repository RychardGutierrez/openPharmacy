import { NotFoundException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { SuppliersRepository } from './repositories/suppliers.repository';

describe('SuppliersService', () => {
  function buildService() {
    const repo = {
      findAll: jest.fn(),
      findAllPaginated: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    const service = new SuppliersService(repo as unknown as SuppliersRepository);
    return { service, repo };
  }

  it('findAll returns the active supplier list', async () => {
    const { service, repo } = buildService();
    repo.findAll.mockResolvedValue([{ id: 's-1', name: 'Acme' }]);

    await expect(service.findAll()).resolves.toEqual([{ id: 's-1', name: 'Acme' }]);
  });

  it('findAllPaginated maps the dto into the repository query', async () => {
    const { service, repo } = buildService();
    repo.findAllPaginated.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 });

    await service.findAllPaginated({ page: 2, pageSize: 25, q: '  Acme  ', active: true });

    expect(repo.findAllPaginated).toHaveBeenCalledWith({
      page: 2,
      pageSize: 25,
      q: 'Acme',
      active: true,
    });
  });

  it('findAllPaginated defaults page and pageSize when missing', async () => {
    const { service, repo } = buildService();
    repo.findAllPaginated.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 });

    await service.findAllPaginated({});

    expect(repo.findAllPaginated).toHaveBeenCalledWith({
      page: 1,
      pageSize: 50,
      q: undefined,
      active: undefined,
    });
  });

  it('findOne throws 404 when the supplier does not exist', async () => {
    const { service, repo } = buildService();
    repo.findById.mockResolvedValue(null);

    await expect(service.findOne('s-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create defaults `active` to true when not provided', async () => {
    const { service, repo } = buildService();
    repo.create.mockImplementation(async (data) => ({ id: 's-1', ...data }));

    await service.create({ name: 'Acme', nit: '123' });

    expect(repo.create).toHaveBeenCalledWith({ name: 'Acme', nit: '123', active: true });
  });

  it('update validates existence before delegating', async () => {
    const { service, repo } = buildService();
    repo.findById.mockResolvedValue(null);

    await expect(service.update('s-1', { name: 'New' })).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.update).not.toHaveBeenCalled();
  });
});
