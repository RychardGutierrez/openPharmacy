import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { ResolvedBuyer } from './siat-buyer-rules';
import { SiatCustomersService } from './siat-customers.service';

const identified: ResolvedBuyer = {
  kind: 'IDENTIFIED',
  docType: 1,
  docNumber: '4567890',
  complement: '1A',
  name: 'Ana Quispe',
  email: null,
  codigoCliente: '4567890-1A',
  codigoExcepcion: null,
};

describe('SiatCustomersService (SIAT-10)', () => {
  it('searches by document number prefix, at most 10 rows', async () => {
    const findMany = jest.fn(() =>
      Promise.resolve([
        {
          id: 'c1',
          doc_type: 5,
          doc_number: '1020304022',
          complement: '',
          name: 'Empresa SRL',
          email: null,
        },
      ]),
    );
    const service = new SiatCustomersService({
      customer: { findMany },
    } as unknown as PrismaService);

    const rows = await service.search(' 10203 ', 5);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { doc_number: { startsWith: '10203' }, doc_type: 5 },
        take: 10,
      }),
    );
    expect(rows).toEqual([
      {
        id: 'c1',
        docType: 5,
        docNumber: '1020304022',
        complement: null,
        name: 'Empresa SRL',
        email: null,
      },
    ]);
  });

  it('returns nothing for an empty prefix', async () => {
    const findMany = jest.fn();
    const service = new SiatCustomersService({
      customer: { findMany },
    } as unknown as PrismaService);
    expect(await service.search('  ')).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('upserts an identified buyer on (type, number, complement) and keeps a known email', async () => {
    const upsert = jest.fn(() => Promise.resolve({ id: 'c1' }));
    const tx = { customer: { upsert } } as unknown as Prisma.TransactionClient;
    const service = new SiatCustomersService({} as PrismaService);

    const id = await service.upsertFromInvoice(tx, identified);

    expect(id).toBe('c1');
    expect(upsert).toHaveBeenCalledWith({
      where: {
        doc_type_doc_number_complement: {
          doc_type: 1,
          doc_number: '4567890',
          complement: '1A',
        },
      },
      create: {
        doc_type: 1,
        doc_number: '4567890',
        complement: '1A',
        name: 'Ana Quispe',
        email: null,
      },
      update: { name: 'Ana Quispe' },
      select: { id: true },
    });
  });

  it('stores an absent complement as an empty string', async () => {
    const upsert = jest.fn(() => Promise.resolve({ id: 'c2' }));
    const tx = { customer: { upsert } } as unknown as Prisma.TransactionClient;
    await new SiatCustomersService({} as PrismaService).upsertFromInvoice(tx, {
      ...identified,
      complement: null,
      email: 'ana@example.com',
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          doc_type_doc_number_complement: {
            doc_type: 1,
            doc_number: '4567890',
            complement: '',
          },
        },
        update: { name: 'Ana Quispe', email: 'ana@example.com' },
      }),
    );
  });

  it.each(['ANONYMOUS', 'SPECIAL'] as const)(
    'never stores a %s buyer',
    async (kind) => {
      const upsert = jest.fn();
      const tx = {
        customer: { upsert },
      } as unknown as Prisma.TransactionClient;
      const id = await new SiatCustomersService(
        {} as PrismaService,
      ).upsertFromInvoice(tx, { ...identified, kind });
      expect(id).toBeNull();
      expect(upsert).not.toHaveBeenCalled();
    },
  );
});
