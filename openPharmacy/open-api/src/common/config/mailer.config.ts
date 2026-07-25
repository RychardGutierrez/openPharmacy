import { registerAs } from '@nestjs/config';

export interface MailerConfig {
  /** SMTP host. If empty, the dev Ethereal transport is used. */
  host: string;
  port: number;
  user: string;
  pass: string;
  /** Secure flag (STARTTLS when false, SSL when true). */
  secure: boolean;
  /** Default From address. */
  from: string;
  /** Frontend URL used in password-change links. */
  frontendUrl: string;
  /** Fallback to Ethereal auto-generated test account when true. */
  ethereal: boolean;
}

export const MAILER_CONFIG_KEY = 'mailer';

export const mailerConfig = registerAs(
  MAILER_CONFIG_KEY,
  (): MailerConfig => ({
    host: process.env.SMTP_HOST ?? '',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    secure: process.env.SMTP_SECURE === 'true',
    from: process.env.SMTP_FROM ?? 'noreply@openpharmacy.com',
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:4200',
    ethereal: !process.env.SMTP_HOST,
  }),
);
