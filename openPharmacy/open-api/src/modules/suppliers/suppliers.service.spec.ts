/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { SuppliersRepository } from './repositories/suppliers.repository';
import { AuditLogRepository } from '../../common/audit/audit-log.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { DuplicateNitException } from './exceptions/duplicate-nit.exception';
import { normalizeNit } from './dto/create-supplier.dto';

describe('SuppliersService', () => {
  let service: SuppliersService;
  let repo: jest.Mocked<SuppliersRepository>;
  let prisma: jest.Mocked<PrismaService>;
  let audit: jest.Mocked<AuditLogRepository>;

  const mockTx = {};

  beforeEach(() => {
    repo = {
      findAll: jest.fn(),
      findAllPaginated: jest.fn(),
      findById: jest.fn(),
      findByNit: jest.fn(),
      findByNitExcept: jest.fn(),
      isActive: jest.fn(),
      createTx: jest.fn(),
      updateTx: jest.fn(),
      deactivateTx: jest.fn(),
      activateTx: jest.fn(),
    } as unknown as jest.Mocked<SuppliersRepository>;

    prisma = {
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(mockTx),
      ),
    } as unknown as jest.Mocked<PrismaService>;

    audit = {
      createInTx: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditLogRepository>;

    service = new SuppliersService(repo, prisma, audit);
  });

  it('findAll returns the active supplier list', async () => {
    repo.findAll.mockResolvedValue([{ id: 's-1', name: 'Acme' } as never]);

    await expect(service.findAll()).resolves.toEqual([
      { id: 's-1', name: 'Acme' },
    ]);
  });

  it('findAllPaginated maps the dto into the repository query', async () => {
    repo.findAllPaginated.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 50,
      totalPages: 0,
    });

    await service.findAllPaginated({
      page: 2,
      pageSize: 25,
      q: '  Acme  ',
      active: true,
    });

    expect(repo.findAllPaginated).toHaveBeenCalledWith({
      page: 2,
      pageSize: 25,
      q: 'Acme',
      active: true,
    });
  });

  it('findAllPaginated accepts false as an active filter', async () => {
    repo.findAllPaginated.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 50,
      totalPages: 0,
    });

    await service.findAllPaginated({ active: false });

    expect(repo.findAllPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ active: false }),
    );
  });

  it('findOne throws 404 when the supplier does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(service.findOne('s-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  describe('create', () => {
    it('defaults active to true when not provided', async () => {
      repo.findByNit.mockResolvedValue(null);
      repo.createTx.mockImplementation(
        (_tx, data) => Promise.resolve({ id: 's-1', ...data }) as never,
      );

      await service.create({ name: 'Acme', nit: '123' });

      expect(repo.createTx).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ name: 'Acme', nit: '123', active: true }),
      );
    });

    it('throws 409 when the NIT already exists', async () => {
      repo.findByNit.mockResolvedValue({ id: 'other', nit: '123' } as never);

      await expect(
        service.create({ name: 'Acme', nit: '123' }),
      ).rejects.toBeInstanceOf(DuplicateNitException);
    });

    it('maps a P2002 unique violation into a 409 (race condition)', async () => {
      repo.findByNit.mockResolvedValue(null);
      const uniqueError = Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
      });
      repo.createTx.mockRejectedValue(uniqueError);

      await expect(
        service.create({ name: 'Acme', nit: '123' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('update', () => {
    it('throws 404 when the supplier does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(
        service.update('s-1', { name: 'New' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.updateTx).not.toHaveBeenCalled();
    });

    it('validates NIT uniqueness excluding the current supplier', async () => {
      repo.findById.mockResolvedValue({ id: 's-1', nit: '111' } as never);
      repo.findByNitExcept.mockResolvedValue(null);
      repo.updateTx.mockImplementation(
        (_tx, id, data) => Promise.resolve({ id, ...data }) as never,
      );

      await service.update('s-1', { nit: '222' });

      expect(repo.findByNitExcept).toHaveBeenCalledWith('222', 's-1');
    });

    it('throws 409 when the new NIT belongs to another supplier', async () => {
      repo.findById.mockResolvedValue({ id: 's-1', nit: '111' } as never);
      repo.findByNitExcept.mockResolvedValue({
        id: 's-2',
        nit: '222',
      } as never);

      await expect(
        service.update('s-1', { nit: '222' }),
      ).rejects.toBeInstanceOf(DuplicateNitException);
    });
  });

  describe('soft delete', () => {
    it('deactivate flips active to false (never a hard delete)', async () => {
      repo.findById.mockResolvedValue({ id: 's-1', active: true } as never);
      repo.deactivateTx.mockResolvedValue({
        id: 's-1',
        active: false,
      } as never);

      await service.deactivate('s-1');

      expect(repo.deactivateTx).toHaveBeenCalledWith(mockTx, 's-1');
      expect(audit.createInTx).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ event: 'SUPPLIER_DEACTIVATED' }),
      );
    });

    it('activate restores a deactivated supplier', async () => {
      repo.findById.mockResolvedValue({ id: 's-1', active: false } as never);
      repo.activateTx.mockResolvedValue({ id: 's-1', active: true } as never);

      await service.activate('s-1');

      expect(repo.activateTx).toHaveBeenCalledWith(mockTx, 's-1');
    });
  });
});

describe('normalizeNit', () => {
  it('strips non-digit characters and whitespace', () => {
    expect(normalizeNit('123-456-789')).toBe('123456789');
    expect(normalizeNit('  900123456  ')).toBe('900123456');
    expect(normalizeNit('NIT 900-1')).toBe('9001');
  });

  it('returns an empty string for non-string input', () => {
    expect(normalizeNit(undefined)).toBe('');
    expect(normalizeNit(123)).toBe('');
  });
});
