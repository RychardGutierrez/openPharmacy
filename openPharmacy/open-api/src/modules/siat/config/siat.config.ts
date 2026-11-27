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
  /**
   * Daily CUFD rotation, in minutes after midnight Bolivia time (SIAT-06). A CUFD requested before
   * today's rotation time is replaced once that time has passed. `SIAT_CUFD_ROTATE_AT`, default 00:05.
   */
  cufdRotateMinute: number;
  /** Renew a CUFD that has fewer than this many minutes left (safety net). Default 60. */
  cufdRenewBeforeMinutes: number;
  /** How often the CUFD job checks the points of sale. Default 60 s. */
  cufdSweepMs: number;
  /** Cap for the backoff between failed CUFD requests of one point of sale. Default 15 min. */
  cufdRetryMaxMs: number;
  /** Daily catalog sync, minutes after midnight Bolivia time (SIAT-07). Default 01:00. */
  catalogSyncMinute: number;
  /** How often the clock is re-sampled from sincronizarFechaHora (SIAT-07). Default 1 h. */
  clockSyncMs: number;
  /** Warn and emit siat.clock.drift when |offset| is above this. Default 5 s. */
  clockWarnMs: number;
  /** Discard a clock sample whose round trip is above this. Default 2 s. */
  clockMaxRttMs: number;
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
    cufdRotateMinute: parseClockTime(env.SIAT_CUFD_ROTATE_AT, 5),
    cufdRenewBeforeMinutes: numberOr(env.SIAT_CUFD_RENEW_BEFORE_MIN, 60),
    cufdSweepMs: numberOr(env.SIAT_CUFD_SWEEP_MS, 60_000),
    cufdRetryMaxMs: numberOr(env.SIAT_CUFD_RETRY_MAX_MS, 15 * 60_000),
    catalogSyncMinute: parseClockTime(env.SIAT_CATALOG_SYNC_AT, 60),
    clockSyncMs: numberOr(env.SIAT_CLOCK_SYNC_MS, 60 * 60_000),
    clockWarnMs: numberOr(env.SIAT_CLOCK_WARN_MS, 5000),
    clockMaxRttMs: numberOr(env.SIAT_CLOCK_MAX_RTT_MS, 2000),
  };
}

/** `HH:mm` (24 h) to minutes after midnight. */
function parseClockTime(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new Error(`Expected a time as HH:mm, got "${value}"`);
  return Number(match[1]) * 60 + Number(match[2]);
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
