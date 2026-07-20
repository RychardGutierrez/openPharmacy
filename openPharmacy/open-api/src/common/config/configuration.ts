export type AppConfig = ReturnType<typeof appConfig>;

export const appConfig = () => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
    cookieSecret: process.env.COOKIE_SECRET ?? 'change-me',
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12', 10),
  },
});

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
