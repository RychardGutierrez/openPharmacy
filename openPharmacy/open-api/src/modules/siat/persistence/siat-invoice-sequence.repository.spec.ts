import { SiatInvoiceSequenceRepository } from './siat-invoice-sequence.repository';

describe('SiatInvoiceSequenceRepository', () => {
  const repository = new SiatInvoiceSequenceRepository();
  const input = {
    cuisId: '29b4ea9a-d524-49d1-b537-ccf0c166dae3',
    pointOfSaleId: '0b6f7a2e-1d1c-4c55-9d43-0d1f6f6b2a10',
    documentType: 'INVOICE' as const,
  };

  it('returns the reserved number as a plain number', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ reserved: 7 }]);

    await expect(repository.reserveNumber({ $queryRaw: queryRaw }, input)).resolves.toBe(7);
  });

  it('upserts the counter for (CUIS, document type) with the supplied values', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ reserved: 1 }]);

    await repository.reserveNumber({ $queryRaw: queryRaw }, input);

    const [strings, ...values] = queryRaw.mock.calls[0] as [string[], ...string[]];
    const sql = strings.join('?');
    expect(sql).toContain('ON CONFLICT ("cuis_id", "document_type") DO UPDATE');
    expect(sql).toContain('RETURNING "next_number" - 1');
    expect(values).toEqual([input.cuisId, input.documentType, input.pointOfSaleId]);
  });

  it('converts a bigint-like value from the driver to a number', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ reserved: BigInt(12) }]);

    await expect(repository.reserveNumber({ $queryRaw: queryRaw }, input)).resolves.toBe(12);
  });

  it('fails when the statement returns no row', async () => {
    const queryRaw = jest.fn().mockResolvedValue([]);

    await expect(repository.reserveNumber({ $queryRaw: queryRaw }, input)).rejects.toThrow(
      'Invoice number reservation returned no row',
    );
  });
});
