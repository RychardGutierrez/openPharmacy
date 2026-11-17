/**
 * Identity sent to SIAT. It is editable by ADMIN in Settings (SIAT-04), so it is read on every call
 * instead of being fixed at startup.
 */
export interface SiatCredentials {
  /** Token delegado (sent as `apikey: TokenApi <token>`). Empty when not configured. */
  token: string;
  /** NIT of the taxpayer. The same value as `PHARMACY_NIT`. */
  nit: string;
  /** Código de sistema assigned by the SIN when the system is registered. */
  codigoSistema: string;
}

export interface SiatCredentialsSource {
  resolve(): Promise<SiatCredentials>;
}

export const SIAT_CREDENTIALS = Symbol('SIAT_CREDENTIALS');

/** Fixed credentials, for scripts (`siat:live-check`) and tests. */
export function staticSiatCredentials(
  credentials: Partial<SiatCredentials>,
): SiatCredentialsSource {
  const value: SiatCredentials = {
    token: '',
    nit: '',
    codigoSistema: '',
    ...credentials,
  };
  return { resolve: () => Promise.resolve({ ...value }) };
}
