export const REFRESH_COOKIE_NAME = 'refresh';

export interface RefreshCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  maxAgeMs: number;
}
