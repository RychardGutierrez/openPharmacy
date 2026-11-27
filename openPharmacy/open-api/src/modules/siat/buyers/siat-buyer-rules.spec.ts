import { UserRole } from '@prisma/client';
import {
  SIAT_DOC_TYPE,
  SIAT_SN_BUYER,
  SiatBuyerRuleError,
  resolveBuyer,
  toCents,
  type ResolveBuyerInput,
} from './siat-buyer-rules';

const ALL_TYPES = new Set([1, 2, 3, 4, 5]);

function resolve(overrides: Partial<ResolveBuyerInput>) {
  return resolveBuyer({
    totalCents: 5_000,
    role: UserRole.CASHIER,
    activeDocTypes: ALL_TYPES,
    ...overrides,
  });
}

function ruleCode(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    if (error instanceof SiatBuyerRuleError) return error.code;
    throw error;
  }
  throw new Error('expected a SiatBuyerRuleError');
}

describe('resolveBuyer (SIAT-10)', () => {
  describe('document type from the catalog', () => {
    it.each([
      ['CI', SIAT_DOC_TYPE.CI, '4567890'],
      ['CEX', SIAT_DOC_TYPE.CEX, 'E-12345'],
      ['PAS', SIAT_DOC_TYPE.PAS, 'AB123456'],
      ['OD', SIAT_DOC_TYPE.OD, 'X99'],
      ['NIT', SIAT_DOC_TYPE.NIT, '1020304022'],
    ])('accepts %s', (_label, docType, docNumber) => {
      const result = resolve({
        buyer: { docType, docNumber, name: 'Juan Pérez' },
      });
      expect(result).toMatchObject({
        kind: 'IDENTIFIED',
        docType,
        docNumber: docNumber.toUpperCase(),
        name: 'Juan Pérez',
        codigoExcepcion: null,
      });
    });

    it('rejects a type that is not active in the synced catalog', () => {
      expect(
        ruleCode(() =>
          resolve({
            activeDocTypes: new Set([1, 5]),
            buyer: { docType: 3, docNumber: 'AB1', name: 'X' },
          }),
        ),
      ).toBe('SIAT_BUYER_DOC_TYPE_INVALID');
    });

    it('rejects a missing type for an identified buyer', () => {
      expect(
        ruleCode(() => resolve({ buyer: { docNumber: '123', name: 'X' } })),
      ).toBe('SIAT_BUYER_DOC_TYPE_INVALID');
    });

    it.each([
      [SIAT_DOC_TYPE.CI, '12A45'],
      [SIAT_DOC_TYPE.NIT, '10203-04'],
      [SIAT_DOC_TYPE.NIT, '1'.repeat(21)],
      [SIAT_DOC_TYPE.PAS, 'AB 12'],
    ])('rejects an invalid number for type %s (%s)', (docType, docNumber) => {
      expect(
        ruleCode(() => resolve({ buyer: { docType, docNumber, name: 'X' } })),
      ).toBe('SIAT_BUYER_DOC_NUMBER_INVALID');
    });

    it('requires a name for an identified buyer', () => {
      expect(
        ruleCode(() =>
          resolve({ buyer: { docType: SIAT_DOC_TYPE.CI, docNumber: '123' } }),
        ),
      ).toBe('SIAT_BUYER_NAME_REQUIRED');
    });
  });

  describe('CI complemento', () => {
    it('is accepted for a CI, trimmed and uppercased', () => {
      const result = resolve({
        buyer: {
          docType: SIAT_DOC_TYPE.CI,
          docNumber: '4567890',
          complement: ' 1a ',
          name: 'Ana',
        },
      });
      expect(result.complement).toBe('1A');
      expect(result.codigoCliente).toBe('4567890-1A');
    });

    it('is null when absent', () => {
      const result = resolve({
        buyer: { docType: SIAT_DOC_TYPE.CI, docNumber: '4567890', name: 'Ana' },
      });
      expect(result.complement).toBeNull();
      expect(result.codigoCliente).toBe('4567890');
    });

    it.each([SIAT_DOC_TYPE.NIT, SIAT_DOC_TYPE.CEX, SIAT_DOC_TYPE.PAS])(
      'is rejected for document type %s',
      (docType) => {
        expect(
          ruleCode(() =>
            resolve({
              buyer: {
                docType,
                docNumber: '1020304022',
                complement: '1A',
                name: 'X',
              },
            }),
          ),
        ).toBe('SIAT_BUYER_COMPLEMENT_NOT_ALLOWED');
      },
    );

    it('is rejected when longer than 5 characters or not alphanumeric', () => {
      for (const complement of ['123456', '1-A']) {
        expect(
          ruleCode(() =>
            resolve({
              buyer: {
                docType: SIAT_DOC_TYPE.CI,
                docNumber: '1',
                complement,
                name: 'X',
              },
            }),
          ),
        ).toBe('SIAT_BUYER_COMPLEMENT_INVALID');
      }
    });
  });

  describe('S/N and the Bs 1,000 limit', () => {
    it.each([
      ['no buyer', undefined],
      ['an empty buyer', { docNumber: '  ', name: '' }],
      ['number 0', { docType: SIAT_DOC_TYPE.NIT, docNumber: '0', name: 'X' }],
      ['the S/N name', { name: 's/n' }],
    ])('%s becomes S/N up to Bs 1,000', (_label, buyer) => {
      const result = resolve({ buyer, totalCents: toCents('1000.00') });
      expect(result).toEqual({
        kind: 'ANONYMOUS',
        docType: SIAT_SN_BUYER.docType,
        docNumber: '0',
        complement: null,
        name: 'S/N',
        email: null,
        codigoCliente: '0',
        codigoExcepcion: null,
      });
    });

    it('requires buyer data above Bs 1,000 (1000.01)', () => {
      expect(ruleCode(() => resolve({ totalCents: toCents('1000.01') }))).toBe(
        'SIAT_BUYER_REQUIRED',
      );
      expect(
        ruleCode(() =>
          resolve({
            totalCents: toCents(1500),
            buyer: { docType: SIAT_DOC_TYPE.NIT, docNumber: '0', name: 'X' },
          }),
        ),
      ).toBe('SIAT_BUYER_REQUIRED');
    });

    it('accepts an identified buyer above Bs 1,000', () => {
      const result = resolve({
        totalCents: toCents(25_000),
        buyer: { docType: SIAT_DOC_TYPE.CI, docNumber: '123', name: 'Ana' },
      });
      expect(result.kind).toBe('IDENTIFIED');
    });

    it('keeps the email of an anonymous buyer', () => {
      expect(resolve({ buyer: { email: 'a@b.bo' } }).email).toBe('a@b.bo');
    });
  });

  describe('codigoExcepcion', () => {
    const nitBuyer = {
      docType: SIAT_DOC_TYPE.NIT,
      docNumber: '1020304022',
      name: 'Empresa SRL',
    };

    it('is null by default, also for an unchecked NIT', () => {
      expect(resolve({ buyer: nitBuyer }).codigoExcepcion).toBeNull();
      expect(
        resolve({ buyer: nitBuyer, nitCheck: { valid: true } }).codigoExcepcion,
      ).toBeNull();
    });

    it('blocks an invalid NIT without an explicit confirmation', () => {
      expect(
        ruleCode(() =>
          resolve({ buyer: nitBuyer, nitCheck: { valid: false } }),
        ),
      ).toBe('SIAT_NIT_INVALID');
    });

    it('is 1 only after a failed check plus an explicit confirmation', () => {
      const result = resolve({
        buyer: nitBuyer,
        nitCheck: { valid: false },
        confirmInvalidNit: true,
      });
      expect(result.codigoExcepcion).toBe(1);
    });

    it('refuses the confirmation for a valid or unchecked NIT', () => {
      for (const nitCheck of [{ valid: true }, null, undefined]) {
        expect(
          ruleCode(() =>
            resolve({ buyer: nitBuyer, nitCheck, confirmInvalidNit: true }),
          ),
        ).toBe('SIAT_NIT_EXCEPTION_NOT_ALLOWED');
      }
    });

    it('refuses the confirmation for a CI or an anonymous buyer', () => {
      expect(
        ruleCode(() =>
          resolve({
            buyer: { docType: SIAT_DOC_TYPE.CI, docNumber: '1', name: 'Ana' },
            nitCheck: { valid: false },
            confirmInvalidNit: true,
          }),
        ),
      ).toBe('SIAT_NIT_EXCEPTION_NOT_ALLOWED');
      expect(ruleCode(() => resolve({ confirmInvalidNit: true }))).toBe(
        'SIAT_NIT_EXCEPTION_NOT_ALLOWED',
      );
    });

    it('ignores a failed NIT check for a CI buyer', () => {
      const result = resolve({
        buyer: { docType: SIAT_DOC_TYPE.CI, docNumber: '1', name: 'Ana' },
        nitCheck: { valid: false },
      });
      expect(result.codigoExcepcion).toBeNull();
    });
  });

  describe('special codes 99001 / 99002 / 99003', () => {
    it.each(['99001', '99002', '99003'])(
      'are forbidden for a cashier or pharmacist (%s)',
      (docNumber) => {
        for (const role of [UserRole.CASHIER, UserRole.PHARMACIST]) {
          let error: unknown;
          try {
            resolve({
              role,
              buyer: { docType: SIAT_DOC_TYPE.NIT, docNumber, name: 'X' },
            });
          } catch (e) {
            error = e;
          }
          expect(error).toBeInstanceOf(SiatBuyerRuleError);
          expect(error).toMatchObject({
            code: 'SIAT_BUYER_SPECIAL_CODE_FORBIDDEN',
            forbidden: true,
          });
        }
      },
    );

    it('99003 is available to ADMIN with its consolidation name', () => {
      const result = resolve({
        role: UserRole.ADMIN,
        totalCents: toCents(4_000),
        buyer: { docType: SIAT_DOC_TYPE.NIT, docNumber: '99003' },
      });
      expect(result).toMatchObject({
        kind: 'SPECIAL',
        docNumber: '99003',
        name: 'VENTAS MENORES DEL DIA',
        codigoExcepcion: null,
      });
    });

    it('99001 needs a name, since it has no default', () => {
      expect(
        ruleCode(() =>
          resolve({
            role: UserRole.ADMIN,
            buyer: { docType: SIAT_DOC_TYPE.NIT, docNumber: '99001' },
          }),
        ),
      ).toBe('SIAT_BUYER_NAME_REQUIRED');
    });

    it('must use the NIT document type', () => {
      expect(
        ruleCode(() =>
          resolve({
            role: UserRole.ADMIN,
            buyer: { docType: SIAT_DOC_TYPE.CI, docNumber: '99002' },
          }),
        ),
      ).toBe('SIAT_BUYER_DOC_TYPE_INVALID');
    });
  });

  describe('toCents', () => {
    it('converts half-up to integer cents', () => {
      expect(toCents('1000.00')).toBe(100_000);
      expect(toCents(1000.005)).toBe(100_001);
      expect(toCents(0.1 + 0.2)).toBe(30);
    });

    it('rejects negative or non-numeric totals', () => {
      expect(ruleCode(() => toCents(-1))).toBe('SIAT_BUYER_TOTAL_INVALID');
      expect(ruleCode(() => toCents('abc'))).toBe('SIAT_BUYER_TOTAL_INVALID');
    });
  });
});
