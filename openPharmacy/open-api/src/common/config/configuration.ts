import { stripInvisible } from '../util/invisible-chars';
import { isLocalUrl, normalizeBaseUrl } from './public-url.util';
import { join } from 'path';

export type AppConfig = ReturnType<typeof appConfig>;

export const appConfig = () => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3001',
    cookieSecret: process.env.COOKIE_SECRET ?? 'change-me',
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12', 10),
    configEncryptionKey: process.env.CONFIG_ENCRYPTION_KEY ?? '',
    uploadDir: process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads'),
  },
});

export type MailerConfigType = ReturnType<typeof mailerConfig>;

export const mailerConfig = () => {
  const frontendUrl = normalizeBaseUrl(
    process.env.FRONTEND_URL,
    'http://localhost:3001',
  );
  // Emailed links (welcome, password reset, report download) are opened on the
  // recipient's own machine, so a localhost base is always a misconfiguration
  // outside local dev. Fail fast in production rather than silently ship dead links.
  if (
    (process.env.NODE_ENV ?? 'development') === 'production' &&
    isLocalUrl(frontendUrl)
  ) {
    throw new Error(
      'FRONTEND_URL must be a public, non-localhost URL in production (emailed links would otherwise point at the recipient\u2019s own machine).',
    );
  }
  return {
    mailer: {
      host: process.env.SMTP_HOST ?? '',
      port: parseInt(process.env.SMTP_PORT ?? '587', 10),
      user: process.env.SMTP_USER ?? '',
      pass: process.env.SMTP_PASS ?? '',
      secure: process.env.SMTP_SECURE === 'true',
      from: process.env.SMTP_FROM ?? 'noreply@openpharmacy.com',
      frontendUrl,
      ethereal: !process.env.SMTP_HOST,
    },
  };
};

export const authConfig = () => ({
  auth: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'change-me-access',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-me-refresh',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '8h',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
    lockoutMaxAttempts: parseInt(process.env.LOCKOUT_MAX_ATTEMPTS ?? '5', 10),
    lockoutDurationMin: parseInt(process.env.LOCKOUT_DURATION_MIN ?? '15', 10),
  },
});

export const throttleConfig = () => ({
  throttle: {
    shortTtl: parseInt(process.env.THROTTLE_SHORT_TTL ?? '1000', 10),
    shortLimit: parseInt(process.env.THROTTLE_SHORT_LIMIT ?? '3', 10),
    mediumTtl: parseInt(process.env.THROTTLE_MEDIUM_TTL ?? '10000', 10),
    mediumLimit: parseInt(process.env.THROTTLE_MEDIUM_LIMIT ?? '20', 10),
    longTtl: parseInt(process.env.THROTTLE_LONG_TTL ?? '60000', 10),
    longLimit: parseInt(process.env.THROTTLE_LONG_LIMIT ?? '100', 10),
    loginTtl: parseInt(process.env.THROTTLE_LOGIN_TTL ?? '60000', 10),
    loginLimit: parseInt(process.env.THROTTLE_LOGIN_LIMIT ?? '5', 10),
  },
});

export type ReportsConfigType = ReturnType<typeof reportsConfig>;

/**
 * Reporting / export tunables. Reports below `syncThreshold` rows are produced
 * synchronously; larger ones are enqueued in `report_jobs` and drained by the
 * in-process poller worker. Since Redis is not available in this deployment,
 * PostgreSQL (`SELECT … FOR UPDATE SKIP LOCKED`) is the queue backend.
 */
export const reportsConfig = () => ({
  reports: {
    syncThreshold: parseInt(process.env.REPORT_SYNC_THRESHOLD ?? '2000', 10),
    maxRows: parseInt(process.env.REPORT_MAX_ROWS ?? '200000', 10),
    maxRangeDays: parseInt(process.env.REPORT_MAX_RANGE_DAYS ?? '366', 10),
    maxFileBytes: parseInt(
      process.env.REPORT_MAX_FILE_BYTES ?? String(15 * 1024 * 1024),
      10,
    ),
    workerEnabled: (process.env.REPORT_WORKER_ENABLED ?? 'true') !== 'false',
    workerPollMs: parseInt(process.env.REPORT_WORKER_POLL_MS ?? '2000', 10),
    jobLeaseSec: parseInt(process.env.REPORT_JOB_LEASE_SEC ?? '120', 10),
    fileTtlDays: parseInt(process.env.REPORT_FILE_TTL_DAYS ?? '7', 10),
    defaultTimezone: stripInvisible(
      process.env.REPORT_DEFAULT_TIMEZONE ?? 'America/La_Paz',
    ),
    // Public origin baked into emailed download links. Must be the externally
    // reachable host (never `localhost`) in staging/production. The link itself
    // targets `/api/reports/d/:token`, which is same-origin to the app (Next
    // rewrites `/api/*` to this API), so pointing at the app host is enough.
    // Falls back to FRONTEND_URL. Production is guarded by `mailerConfig`.
    downloadBaseUrl: normalizeBaseUrl(
      process.env.REPORT_DOWNLOAD_BASE_URL || process.env.FRONTEND_URL,
      'http://localhost:3001',
    ),
    // Lifetime of the signed email link, in minutes. Independent of, and never
    // longer than, the stored file's retention (`fileTtlDays`).
    downloadTtlMin: parseInt(
      process.env.REPORT_DOWNLOAD_TTL_MIN ?? '10080',
      10,
    ),
    // HMAC secret for the download token. Dedicated env preferred; falls back
    // to the access secret so a misconfigured dev env still works.
    downloadSecret:
      process.env.REPORT_DOWNLOAD_SECRET?.trim() ||
      process.env.JWT_ACCESS_SECRET?.trim() ||
      'change-me-access',
  },
});
