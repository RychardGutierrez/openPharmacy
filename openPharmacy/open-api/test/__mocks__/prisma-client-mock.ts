/* eslint-disable */
// Stub PrismaClient for unit tests so we never load the real generated client
// (which uses import.meta and breaks under ts-jest CommonJS).
export class PrismaClient {
  $connect = async () => undefined;
  $disconnect = async () => undefined;
}

export const Prisma = {
  JsonNull: 'JsonNull',
  InputJsonValue: class {} as new () => unknown,
  TransactionIsolationLevel: { Serializable: 'Serializable' },
};

export class Decimal {
  constructor(value: string | number) {
    // Minimal Decimal stub for unit tests.
    void value;
  }

  toString(): string {
    return '0';
  }
}

export type User = Record<string, unknown>;
export type RefreshToken = Record<string, unknown>;
export type AuditLog = Record<string, unknown>;
export type Product = Record<string, unknown>;
export type Lot = Record<string, unknown>;
export type InventoryMovement = Record<string, unknown>;
export type SaleItem = Record<string, unknown>;
export type Sale = Record<string, unknown>;
export type ReturnItem = Record<string, unknown>;
export type Shift = Record<string, unknown>;
export type ShiftReopenRequest = Record<string, unknown>;

export type Prisma = {
  TransactionClient: Record<string, any>;
};

// Mock enums so unit tests can reference enum values without loading the real
// generated client (which uses import.meta and breaks under ts-jest CJS).
export const UserRole = {
  ADMIN: 'ADMIN',
  PHARMACIST: 'PHARMACIST',
  CASHIER: 'CASHIER',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const PaymentMethod = {
  CASH: 'CASH',
  CARD: 'CARD',
  TRANSFER: 'TRANSFER',
  QR: 'QR',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const SaleStatus = {
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
} as const;
export type SaleStatus = (typeof SaleStatus)[keyof typeof SaleStatus];

export const ShiftStatus = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
} as const;
export type ShiftStatus = (typeof ShiftStatus)[keyof typeof ShiftStatus];

export const ShiftReopenRequestStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type ShiftReopenRequestStatus =
  (typeof ShiftReopenRequestStatus)[keyof typeof ShiftReopenRequestStatus];

export const ProductCategory = {
  OTC: 'OTC',
  PRESCRIPTION_ONLY: 'PRESCRIPTION_ONLY',
  PSYCHOTROPIC: 'PSYCHOTROPIC',
  NARCOTIC: 'NARCOTIC',
  NON_PHARMACEUTICAL: 'NON_PHARMACEUTICAL',
} as const;
export type ProductCategory =
  (typeof ProductCategory)[keyof typeof ProductCategory];
