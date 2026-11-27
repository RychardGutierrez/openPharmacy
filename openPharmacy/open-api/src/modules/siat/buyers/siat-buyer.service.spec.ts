import {
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { UserRole, type Prisma } from '@prisma/client';
import type { AuditLogRepository } from '../../../common/audit/audit-log.repository';
import type { SiatCatalogsService } from '../catalogs/siat-catalogs.service';
import { SIAT_DOC_TYPE } from './siat-buyer-rules';
import { SiatBuyerService } from './siat-buyer.service';
import type { SiatNitVerificationService } from './siat-nit-verification.service';

const NIT_BUYER = {
  docType: SIAT_DOC_TYPE.NIT,
  docNumber: '1020304022',
  name: 'Empresa SRL',
};

function setup(
  options: {
    docTypes?: string[];
    lastCheck?: { valid: boolean } | null;
  } = {},
) {
  const catalogs = {
    activeCodeSet: jest.fn(() =>
      Promise.resolve(new Set(options.docTypes ?? ['1', '2', '3', '4', '5'])),
    ),
  };
  const nits = {
    lastCheck: jest.fn(() => Promise.resolve(options.lastCheck ?? null)),
    verify: jest.fn(),
  };
  const audit = { createInTx: jest.fn(() => Promise.resolve()) };
  const service = new SiatBuyerService(
    catalogs as unknown as SiatCatalogsService,
    nits as unknown as SiatNitVerificationService,
    audit as unknown as AuditLogRepository,
  );
  return { service, catalogs, nits, audit };
}

describe('SiatBuyerService (SIAT-10)', () => {
  describe('resolve', () => {
    it('uses the synced document types and never calls SIAT', async () => {
      const { service, catalogs, nits } = setup();

      const result = await service.resolve(
        { buyer: NIT_BUYER, total: '120.50' },
        UserRole.CASHIER,
      );

      expect(catalogs.activeCodeSet).toHaveBeenCalledWith('document-types');
      expect(nits.lastCheck).toHaveBeenCalledWith('1020304022');
      expect(nits.verify).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        kind: 'IDENTIFIED',
        docType: 5,
        codigoExcepcion: null,
        nitCheck: 'UNCHECKED',
      });
    });

    it('reports VALID for a NIT verified in the last 24 h', async () => {
      const { service } = setup({ lastCheck: { valid: true } });
      const result = await service.resolve(
        { buyer: NIT_BUYER, total: 50 },
        UserRole.CASHIER,
      );
      expect(result.nitCheck).toBe('VALID');
    });

    it('returns 422 SIAT_NIT_INVALID after a failed check without confirmation', async () => {
      const { service } = setup({ lastCheck: { valid: false } });
      await expect(
        service.resolve({ buyer: NIT_BUYER, total: 50 }, UserRole.CASHIER),
      ).rejects.toMatchObject({
        constructor: UnprocessableEntityException,
        response: { code: 'SIAT_NIT_INVALID' },
      });
    });

    it('sets codigoExcepcion = 1 after a failed check plus confirmation', async () => {
      const { service } = setup({ lastCheck: { valid: false } });
      const result = await service.resolve(
        { buyer: NIT_BUYER, total: 50, confirmInvalidNit: true },
        UserRole.CASHIER,
      );
      expect(result).toMatchObject({ codigoExcepcion: 1, nitCheck: 'INVALID' });
    });

    it('does not look up a NIT check for a CI buyer', async () => {
      const { service, nits } = setup({ lastCheck: { valid: false } });
      const result = await service.resolve(
        {
          buyer: {
            docType: SIAT_DOC_TYPE.CI,
            docNumber: '4567890',
            name: 'Ana',
          },
          total: 50,
        },
        UserRole.CASHIER,
      );
      expect(nits.lastCheck).not.toHaveBeenCalled();
      expect(result.nitCheck).toBeNull();
    });

    it('returns 403 for a special code used by a cashier', async () => {
      const { service, nits } = setup();
      await expect(
        service.resolve(
          {
            buyer: { docType: SIAT_DOC_TYPE.NIT, docNumber: '99003' },
            total: 50,
          },
          UserRole.CASHIER,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(nits.lastCheck).not.toHaveBeenCalled();
    });

    it('returns 422 SIAT_BUYER_REQUIRED for S/N above Bs 1,000', async () => {
      const { service } = setup();
      await expect(
        service.resolve({ total: 1000.01 }, UserRole.CASHIER),
      ).rejects.toMatchObject({ response: { code: 'SIAT_BUYER_REQUIRED' } });
      await expect(
        service.resolve({ total: 1000 }, UserRole.CASHIER),
      ).resolves.toMatchObject({ kind: 'ANONYMOUS', nitCheck: null });
    });

    it('returns 409 while the document types are not synchronized', async () => {
      const { service } = setup({ docTypes: [] });
      await expect(
        service.resolve({ total: 10 }, UserRole.CASHIER),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('recordExceptionUse', () => {
    const tx = {} as Prisma.TransactionClient;

    it('audits codigoExcepcion with user and sale, in the transaction', async () => {
      const { service, audit } = setup();

      await service.recordExceptionUse(tx, {
        userId: 'user-1',
        saleId: 'sale-1',
        invoiceId: 'inv-1',
        buyer: { docNumber: '1020304022', codigoExcepcion: 1 },
      });

      expect(audit.createInTx).toHaveBeenCalledWith(tx, {
        userId: 'user-1',
        event: 'SIAT_CODIGO_EXCEPCION_USED',
        metadata: {
          saleId: 'sale-1',
          invoiceId: 'inv-1',
          nit: '1020304022',
          codigoExcepcion: 1,
        },
      });
    });

    it('writes nothing when codigoExcepcion is not set', async () => {
      const { service, audit } = setup();
      await service.recordExceptionUse(tx, {
        userId: 'user-1',
        saleId: 'sale-1',
        buyer: { docNumber: '1020304022', codigoExcepcion: null },
      });
      expect(audit.createInTx).not.toHaveBeenCalled();
    });
  });
});
