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

// Mock the UserRole enum so tests can reference UserRole.ADMIN etc.
export const UserRole = {
  ADMIN: 'ADMIN',
  PHARMACIST: 'PHARMACIST',
  CASHIER: 'CASHIER',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
