import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  CORS_ORIGIN: Joi.string().default('http://localhost:4200'),
  COOKIE_SECRET: Joi.string().min(8).required(),

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
});
