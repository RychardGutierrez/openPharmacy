import { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  fullName: string;
  email: string;
}

export interface JwtPayload {
  sub: string;
  role: UserRole;
  iat?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  iat?: number;
  exp?: number;
}
