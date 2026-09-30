import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  CORS_ORIGIN: Joi.string().default('http://localhost:3001'),
  COOKIE_SECRET: Joi.string().min(8).required(),
  CONFIG_ENCRYPTION_KEY: Joi.string().allow('').default(''),
  UPLOAD_DIR: Joi.string().default('./uploads'),

  BCRYPT_SALT_ROUNDS: Joi.number().integer().min(4).max(15).default(12),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL: Joi.string().default('8h'),
  JWT_REFRESH_TTL: Joi.string().default('7d'),

  LOCKOUT_MAX_ATTEMPTS: Joi.number().integer().min(1).default(5),
  LOCKOUT_DURATION_MIN: Joi.number().integer().min(1).default(15),

  THROTTLE_SHORT_TTL: Joi.number().integer().default(1000),
  THROTTLE_SHORT_LIMIT: Joi.number().integer().default(3),
  THROTTLE_MEDIUM_TTL: Joi.number().integer().default(10000),
  THROTTLE_MEDIUM_LIMIT: Joi.number().integer().default(20),
  THROTTLE_LONG_TTL: Joi.number().integer().default(60000),
  THROTTLE_LONG_LIMIT: Joi.number().integer().default(100),
  THROTTLE_LOGIN_TTL: Joi.number().integer().default(60000),
  THROTTLE_LOGIN_LIMIT: Joi.number().integer().default(5),

  // ─── Mailer (optional in dev; falls back to Ethereal test account) ───────
  SMTP_HOST: Joi.string().allow('').default(''),
  SMTP_PORT: Joi.number().integer().default(587),
  SMTP_USER: Joi.string().allow('').default(''),
  SMTP_PASS: Joi.string().allow('').default(''),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_FROM: Joi.string().email().default('noreply@openpharmacy.com'),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3001'),

  // ─── Reporting / export jobs ───────────────────────────────────────────────
  REPORT_SYNC_THRESHOLD: Joi.number().integer().min(0).default(2000),
  REPORT_MAX_ROWS: Joi.number().integer().min(1).default(200000),
  REPORT_MAX_RANGE_DAYS: Joi.number().integer().min(1).default(366),
  REPORT_MAX_FILE_BYTES: Joi.number().integer().min(1024).default(15728640),
  REPORT_WORKER_ENABLED: Joi.boolean().default(true),
  REPORT_WORKER_POLL_MS: Joi.number().integer().min(200).default(2000),
  REPORT_JOB_LEASE_SEC: Joi.number().integer().min(10).default(120),
  REPORT_FILE_TTL_DAYS: Joi.number().integer().min(1).default(7),
  REPORT_DEFAULT_TIMEZONE: Joi.string().default('America/La_Paz'),
  // Public base for emailed links. Warn (not fail) if left on localhost so a
  // misconfigured prod still boots but the operator sees the risk in logs.
  REPORT_DOWNLOAD_BASE_URL: Joi.string().uri().allow('').default(''),
  REPORT_DOWNLOAD_TTL_MIN: Joi.number().integer().min(5).default(10080),
  REPORT_DOWNLOAD_SECRET: Joi.string().allow('').default(''),

  // ─── PDF engine ──────────────────────────────────────────────────────────
  // Empty = auto-detect (env path → OS install paths → sparticuz on Linux).
  PUPPETEER_EXECUTABLE_PATH: Joi.string().allow('').default(''),
});
