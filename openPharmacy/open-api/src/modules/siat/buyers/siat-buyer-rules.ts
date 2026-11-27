/**
 * Buyer rules for an invoice (SIAT-10). Pure functions: no I/O, no clock. The service supplies
 * the active document types and the stored NIT check.
 *
 * Field limits come from the V3 XSD (`facturaComputarizadaCompraVenta.xsd`):
 * `numeroDocumento` 1-20, `complemento` <= 5, `nombreRazonSocial` 1-500, `codigoCliente` 1-100,
 * `codigoTipoDocumentoIdentidad` 1-5, `codigoExcepcion` nillable 0..1.
 */
import { UserRole } from '@prisma/client';

/** `sincronizarParametricaTipoDocumentoIdentidad` codes. Checked against the synced catalog. */
export const SIAT_DOC_TYPE = {
  CI: 1,
  CEX: 2,
  PAS: 3,
  OD: 4,
  NIT: 5,
} as const;

/** Above this total (in cents, Bs 1,000.00) the buyer must be identified. 1000.00 is still S/N. */
export const SN_MAX_TOTAL_CENTS = 100_000;

/**
 * Anonymous buyer ("sin nombre") for totals up to Bs 1,000.
 * CONFIRM IN ANNEX: the research notes give "S/N" with number 0, but not the document type.
 */
export const SIAT_SN_BUYER = {
  docType: SIAT_DOC_TYPE.CI,
  docNumber: '0',
  name: 'S/N',
} as const;

/**
 * Special buyer numbers (ADMIN only). 99001 exempt entities, 99002 control tributario,
 * 99003 "VENTAS MENORES DEL DÍA" (daily consolidation).
 * CONFIRM IN ANNEX: document type and fixed names.
 */
export const SIAT_SPECIAL_DOC_TYPE = SIAT_DOC_TYPE.NIT;
export const SIAT_SPECIAL_BUYERS: Record<
  string,
  { defaultName: string | null }
> = {
  '99001': { defaultName: null },
  '99002': { defaultName: 'CONTROL TRIBUTARIO' },
  '99003': { defaultName: 'VENTAS MENORES DEL DIA' },
};

export function isSpecialBuyerNumber(docNumber: string): boolean {
  return Object.keys(SIAT_SPECIAL_BUYERS).includes(docNumber);
}

export interface BuyerInput {
  docType?: number | null;
  docNumber?: string | null;
  complement?: string | null;
  name?: string | null;
  email?: string | null;
  codigoCliente?: string | null;
}

export interface ResolveBuyerInput {
  /** Absent, null or empty = anonymous buyer. */
  buyer?: BuyerInput | null;
  /** Invoice total in cents (integer). */
  totalCents: number;
  role: UserRole;
  /** Active codes of the `document-types` catalog. */
  activeDocTypes: ReadonlySet<number>;
  /** Stored `verificarNit` answer for this NIT, or null when it was never checked recently. */
  nitCheck?: { valid: boolean } | null;
  /** The cashier explicitly confirmed issuing to a NIT that SIAT reported invalid. */
  confirmInvalidNit?: boolean;
}

export type BuyerKind = 'ANONYMOUS' | 'SPECIAL' | 'IDENTIFIED';

export interface ResolvedBuyer {
  kind: BuyerKind;
  docType: number;
  docNumber: string;
  /** Null when absent (stored as '' in `customers`). */
  complement: string | null;
  name: string;
  email: string | null;
  codigoCliente: string;
  /** 1 only after a failed NIT check and an explicit confirmation. Never set by default. */
  codigoExcepcion: 1 | null;
}

export type BuyerRuleCode =
  | 'SIAT_BUYER_REQUIRED'
  | 'SIAT_BUYER_DOC_TYPE_INVALID'
  | 'SIAT_BUYER_DOC_NUMBER_INVALID'
  | 'SIAT_BUYER_COMPLEMENT_NOT_ALLOWED'
  | 'SIAT_BUYER_COMPLEMENT_INVALID'
  | 'SIAT_BUYER_NAME_REQUIRED'
  | 'SIAT_BUYER_CODIGO_CLIENTE_INVALID'
  | 'SIAT_BUYER_SPECIAL_CODE_FORBIDDEN'
  | 'SIAT_NIT_INVALID'
  | 'SIAT_NIT_EXCEPTION_NOT_ALLOWED'
  | 'SIAT_BUYER_TOTAL_INVALID';

/** A broken buyer rule. `forbidden` maps to 403, everything else to 422. */
export class SiatBuyerRuleError extends Error {
  constructor(
    readonly code: BuyerRuleCode,
    message: string,
    readonly forbidden = false,
  ) {
    super(message);
    this.name = 'SiatBuyerRuleError';
  }
}

const MAX_DOC_NUMBER = 20;
const MAX_COMPLEMENT = 5;
const MAX_NAME = 500;
const MAX_CODIGO_CLIENTE = 100;
const DIGITS = /^\d+$/;
const ALPHANUMERIC = /^[A-Z0-9-]+$/;
const COMPLEMENT = /^[A-Z0-9]+$/;

/** Bolivianos (number or decimal string) to integer cents, half-up. */
export function toCents(amount: number | string): number {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(value) || value < 0) {
    throw new SiatBuyerRuleError(
      'SIAT_BUYER_TOTAL_INVALID',
      'The total must be a non-negative amount',
    );
  }
  return Math.round(value * 100 + Number.EPSILON);
}

export function resolveBuyer(input: ResolveBuyerInput): ResolvedBuyer {
  if (!Number.isInteger(input.totalCents) || input.totalCents < 0) {
    throw new SiatBuyerRuleError(
      'SIAT_BUYER_TOTAL_INVALID',
      'The total must be a non-negative amount in cents',
    );
  }
  const buyer = input.buyer ?? {};
  const docNumber = clean(buyer.docNumber)?.toUpperCase() ?? null;
  const name = clean(buyer.name);

  if (isAnonymous(docNumber, name)) {
    return anonymous(input);
  }
  if (input.confirmInvalidNit && buyer.docType !== SIAT_DOC_TYPE.NIT) {
    throw exceptionNotAllowed();
  }

  const docType = buyer.docType;
  if (
    typeof docType !== 'number' ||
    !Number.isInteger(docType) ||
    !input.activeDocTypes.has(docType)
  ) {
    throw new SiatBuyerRuleError(
      'SIAT_BUYER_DOC_TYPE_INVALID',
      'The document type is not an active SIN document type',
    );
  }
  if (!docNumber) {
    throw new SiatBuyerRuleError(
      'SIAT_BUYER_DOC_NUMBER_INVALID',
      'The document number is required',
    );
  }
  const email = clean(buyer.email);

  if (isSpecialBuyerNumber(docNumber)) {
    return special(input, docType, docNumber, name, email, buyer);
  }

  validateDocNumber(docType, docNumber);
  const complement = normalizeComplement(docType, buyer.complement);
  if (!name) {
    throw new SiatBuyerRuleError(
      'SIAT_BUYER_NAME_REQUIRED',
      'The buyer name (razón social) is required',
    );
  }
  if (name.length > MAX_NAME) {
    throw new SiatBuyerRuleError(
      'SIAT_BUYER_NAME_REQUIRED',
      `The buyer name must be at most ${MAX_NAME} characters`,
    );
  }

  return {
    kind: 'IDENTIFIED',
    docType,
    docNumber,
    complement,
    name,
    email,
    codigoCliente: codigoCliente(buyer.codigoCliente, docNumber, complement),
    codigoExcepcion: nitException(input, docType),
  };
}

/** No number, number 0, or the "S/N" name with no number. */
function isAnonymous(docNumber: string | null, name: string | null): boolean {
  if (docNumber === SIAT_SN_BUYER.docNumber) return true;
  if (docNumber) return false;
  return !name || name.toUpperCase() === SIAT_SN_BUYER.name;
}

function anonymous(input: ResolveBuyerInput): ResolvedBuyer {
  if (input.totalCents > SN_MAX_TOTAL_CENTS) {
    throw new SiatBuyerRuleError(
      'SIAT_BUYER_REQUIRED',
      'Buyer data is required for totals above Bs 1,000',
    );
  }
  if (input.confirmInvalidNit) throw exceptionNotAllowed();
  return {
    kind: 'ANONYMOUS',
    docType: SIAT_SN_BUYER.docType,
    docNumber: SIAT_SN_BUYER.docNumber,
    complement: null,
    name: SIAT_SN_BUYER.name,
    email: clean(input.buyer?.email),
    codigoCliente: SIAT_SN_BUYER.docNumber,
    codigoExcepcion: null,
  };
}

function special(
  input: ResolveBuyerInput,
  docType: number,
  docNumber: string,
  name: string | null,
  email: string | null,
  buyer: BuyerInput,
): ResolvedBuyer {
  if (input.role !== UserRole.ADMIN) {
    throw new SiatBuyerRuleError(
      'SIAT_BUYER_SPECIAL_CODE_FORBIDDEN',
      `Buyer number ${docNumber} can only be used by an administrator`,
      true,
    );
  }
  if (docType !== SIAT_SPECIAL_DOC_TYPE) {
    throw new SiatBuyerRuleError(
      'SIAT_BUYER_DOC_TYPE_INVALID',
      `Buyer number ${docNumber} must use the NIT document type`,
    );
  }
  if (clean(buyer.complement)) {
    throw complementNotAllowed();
  }
  if (input.confirmInvalidNit) throw exceptionNotAllowed();
  const finalName = name ?? SIAT_SPECIAL_BUYERS[docNumber].defaultName;
  if (!finalName || finalName.length > MAX_NAME) {
    throw new SiatBuyerRuleError(
      'SIAT_BUYER_NAME_REQUIRED',
      `Buyer number ${docNumber} needs a name (razón social)`,
    );
  }
  return {
    kind: 'SPECIAL',
    docType,
    docNumber,
    complement: null,
    name: finalName,
    email,
    codigoCliente: codigoCliente(buyer.codigoCliente, docNumber, null),
    codigoExcepcion: null,
  };
}

function validateDocNumber(docType: number, docNumber: string): void {
  const numeric = docType === SIAT_DOC_TYPE.CI || docType === SIAT_DOC_TYPE.NIT;
  const ok =
    docNumber.length <= MAX_DOC_NUMBER &&
    (numeric ? DIGITS.test(docNumber) : ALPHANUMERIC.test(docNumber));
  if (!ok) {
    throw new SiatBuyerRuleError(
      'SIAT_BUYER_DOC_NUMBER_INVALID',
      numeric
        ? `The document number must be digits only (at most ${MAX_DOC_NUMBER})`
        : `The document number must be letters, digits or '-' (at most ${MAX_DOC_NUMBER})`,
    );
  }
}

/** The CI complemento (for duplicated CI numbers). Only valid for CI. */
function normalizeComplement(
  docType: number,
  raw: string | null | undefined,
): string | null {
  const complement = clean(raw)?.toUpperCase() ?? null;
  if (!complement) return null;
  if (docType !== SIAT_DOC_TYPE.CI) throw complementNotAllowed();
  if (complement.length > MAX_COMPLEMENT || !COMPLEMENT.test(complement)) {
    throw new SiatBuyerRuleError(
      'SIAT_BUYER_COMPLEMENT_INVALID',
      `The complemento must be at most ${MAX_COMPLEMENT} letters or digits`,
    );
  }
  return complement;
}

/**
 * `codigoExcepcion = 1` only when all three hold: NIT document type, the stored check says
 * invalid, and the cashier confirmed. Inspectors check that it is never set by default.
 */
function nitException(input: ResolveBuyerInput, docType: number): 1 | null {
  if (docType !== SIAT_DOC_TYPE.NIT) {
    if (input.confirmInvalidNit) throw exceptionNotAllowed();
    return null;
  }
  const failed = input.nitCheck?.valid === false;
  if (failed && !input.confirmInvalidNit) {
    throw new SiatBuyerRuleError(
      'SIAT_NIT_INVALID',
      'SIAT reported this NIT as invalid. Confirm explicitly to issue the invoice with the exception code',
    );
  }
  if (!failed && input.confirmInvalidNit) throw exceptionNotAllowed();
  return failed ? 1 : null;
}

function codigoCliente(
  raw: string | null | undefined,
  docNumber: string,
  complement: string | null,
): string {
  const given = clean(raw);
  if (given) {
    if (given.length > MAX_CODIGO_CLIENTE) {
      throw new SiatBuyerRuleError(
        'SIAT_BUYER_CODIGO_CLIENTE_INVALID',
        `codigoCliente must be at most ${MAX_CODIGO_CLIENTE} characters`,
      );
    }
    return given;
  }
  return complement ? `${docNumber}-${complement}` : docNumber;
}

function exceptionNotAllowed(): SiatBuyerRuleError {
  return new SiatBuyerRuleError(
    'SIAT_NIT_EXCEPTION_NOT_ALLOWED',
    'The exception code is only allowed for a NIT that SIAT reported invalid',
  );
}

function complementNotAllowed(): SiatBuyerRuleError {
  return new SiatBuyerRuleError(
    'SIAT_BUYER_COMPLEMENT_NOT_ALLOWED',
    'The complemento is only allowed for a CI',
  );
}

function clean(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
