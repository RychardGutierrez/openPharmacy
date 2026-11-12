/** SIAT environments. The SIN publishes the pilot host; the production host is configured explicitly. */
export type SiatEnvironmentName = 'pilot' | 'production';

export interface SiatConfig {
  environment: SiatEnvironmentName;
  /** Base URL of the SOAP services, without the trailing service name. */
  baseUrl: string;
  /** Token delegado (sent as `apikey: TokenApi <token>`). Empty until SIAT-00 delivers it. */
  token: string;
  connectTimeoutMs: number;
  totalTimeoutMs: number;
  /** Retries for read-only operations only. Write operations are never retried. */
  readRetries: number;
  retryBaseMs: number;
}

/** Reads SIAT settings from an environment map. Joi validates the same keys at startup. */
export function readSiatConfig(
  env: NodeJS.ProcessEnv = process.env,
): SiatConfig {
  const environment = (env.SIAT_ENV || 'pilot') as SiatEnvironmentName;
  if (environment !== 'pilot' && environment !== 'production') {
    throw new Error(
      `SIAT_ENV must be "pilot" or "production", got "${String(env.SIAT_ENV)}"`,
    );
  }

  const baseUrl =
    environment === 'production'
      ? required(
          env.SIAT_PRODUCTION_BASE_URL,
          'SIAT_PRODUCTION_BASE_URL is required when SIAT_ENV=production',
        )
      : env.SIAT_PILOT_BASE_URL ||
        'https://pilotosiatservicios.impuestos.gob.bo/v2';

  return {
    environment,
    baseUrl: baseUrl.replace(/\/+$/, ''),
    token: env.SIAT_TOKEN ?? '',
    connectTimeoutMs: numberOr(env.SIAT_CONNECT_TIMEOUT_MS, 5000),
    totalTimeoutMs: numberOr(env.SIAT_TOTAL_TIMEOUT_MS, 20000),
    readRetries: numberOr(env.SIAT_READ_RETRIES, 2),
    retryBaseMs: numberOr(env.SIAT_RETRY_BASE_MS, 500),
  };
}

export const SIAT_CONFIG = Symbol('SIAT_CONFIG');

/** codigoAmbiente sent in SIAT requests: 1 = production, 2 = pruebas y piloto. */
export function codigoAmbiente(config: Pick<SiatConfig, 'environment'>): 1 | 2 {
  return config.environment === 'production' ? 1 : 2;
}

function required(value: string | undefined, message: string): string {
  if (!value) throw new Error(message);
  return value;
}

function numberOr(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Expected a non-negative number, got "${value}"`);
  }
  return parsed;
}
