import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule as NestMailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { createTestAccount } from 'nodemailer';
import { existsSync } from 'fs';
import { join } from 'path';
import { MailerService } from './mailer.service';

export interface EtherealAccount {
  user: string;
  pass: string;
  host: string;
  port: number;
  secure: boolean;
}

/**
 * Creates an Ethereal test account when SMTP_HOST is not configured.
 * Credentials are logged so the welcome email can be previewed in development.
 */
async function createEtherealAccount(logger: Logger): Promise<EtherealAccount> {
  const account = await createTestAccount();
  logger.log(
    `Ethereal mailer ready: preview inbox at https://ethereal.email/login ` +
      `user=${account.user} pass=${account.pass}`,
  );
  return {
    user: account.user,
    pass: account.pass,
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
  };
}

function resolveTemplateDir(): string {
  const candidates = [
    join(process.cwd(), 'src', 'common', 'mailer', 'templates'),
    join(process.cwd(), 'dist', 'common', 'mailer', 'templates'),
    join(__dirname, 'templates'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
}

@Module({
  imports: [
    NestMailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const logger = new Logger('MailerModule');
        const host = config.get<string>('mailer.host', '');
        const port = config.get<number>('mailer.port', 587);
        const user = config.get<string>('mailer.user', '');
        const pass = config.get<string>('mailer.pass', '');
        const secure = config.get<boolean>('mailer.secure', false);
        const from = config.get<string>(
          'mailer.from',
          'noreply@openpharmacy.com',
        );
        const ethereal = config.get<boolean>('mailer.ethereal', !host);

        let transport: string;
        if (ethereal) {
          const account = await createEtherealAccount(logger);
          const protocol = account.secure ? 'smtps' : 'smtp';
          transport = `${protocol}://${encodeURIComponent(account.user)}:${encodeURIComponent(account.pass)}@${account.host}:${account.port}`;
        } else {
          const protocol = secure ? 'smtps' : 'smtp';
          transport = `${protocol}://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}`;
        }

        return {
          transport,
          defaults: { from },
          template: {
            dir: resolveTemplateDir(),
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },
        };
      },
    }),
  ],
  providers: [MailerService],
  exports: [MailerService],
})
export class MailerModule {}
