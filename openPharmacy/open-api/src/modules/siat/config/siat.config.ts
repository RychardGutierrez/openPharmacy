/** SIAT environments. The SIN publishes the pilot host; the production host is configured explicitly. */
export type SiatEnvironmentName = 'pilot' | 'production';

export interface SiatConfig {
  environment: SiatEnvironmentName;
  /** Base URL of the SOAP services, without the trailing service name. */
  baseUrl: string;
  /**
   * `SIAT_TOKEN` from the environment: a **pilot-only fallback** for local development and
   * `siat:live-check`. The token used at runtime is the encrypted setting saved in Settings
   * (SIAT-04, see `ConfigSiatCredentialsSource`). Rejected when `SIAT_ENV=production`.
   */
  token: string;
  connectTimeoutMs: number;
  totalTimeoutMs: number;
  /** Retries for read-only operations only. Write operations are never retried. */
  readRetries: number;
  retryBaseMs: number;
  /**
   * Renew a CUIS when it has this many days left or fewer (SIAT-05). The annex allows renewal only
   * "a partir del quinto día anterior a su vencimiento", so the default is 5.
   */
  cuisRenewDays: number;
  /** Warn (log, later SIAT-27 alert) when a CUIS has this many days left or fewer. Default 15. */
  cuisAlertDays: number;
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

  if (environment === 'production' && env.SIAT_TOKEN) {
    throw new Error(
      'SIAT_TOKEN must be empty when SIAT_ENV=production. Load the token in Settings > Facturación SIAT.',
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
    cuisRenewDays: numberOr(env.SIAT_CUIS_RENEW_DAYS, 5),
    cuisAlertDays: numberOr(env.SIAT_CUIS_ALERT_DAYS, 15),
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
