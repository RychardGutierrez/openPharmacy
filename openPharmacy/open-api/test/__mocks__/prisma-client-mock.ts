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
};

export type User = Record<string, unknown>;
export type RefreshToken = Record<string, unknown>;
export type AuditLog = Record<string, unknown>;
export type Product = Record<string, unknown>;

// Mock enums so unit tests can reference enum values without loading the real
// generated client (which uses import.meta and breaks under ts-jest CJS).
export const UserRole = {
  ADMIN: 'ADMIN',
  PHARMACIST: 'PHARMACIST',
  CASHIER: 'CASHIER',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ProductCategory = {
  OTC: 'OTC',
  PRESCRIPTION_ONLY: 'PRESCRIPTION_ONLY',
  PSYCHOTROPIC: 'PSYCHOTROPIC',
  NARCOTIC: 'NARCOTIC',
  NON_PHARMACEUTICAL: 'NON_PHARMACEUTICAL',
} as const;
export type ProductCategory = (typeof ProductCategory)[keyof typeof ProductCategory];
