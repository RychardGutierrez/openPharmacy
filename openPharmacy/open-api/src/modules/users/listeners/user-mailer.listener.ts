import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '../../../common/mailer/mailer.service';
import {
  isLocalUrl,
  normalizeBaseUrl,
} from '../../../common/config/public-url.util';
import { UserCreatedEvent } from '../events/user-created.event';

/**
 * Listens for user lifecycle events and sends the corresponding emails.
 *
 * Kept separate from `UsersService` so the user-management service does not
 * depend on the mailer (single-responsibility). Errors are caught and logged;
 * they never propagate to the HTTP request that triggered the event.
 */
@Injectable()
export class UserMailerListener {
  private readonly logger = new Logger(UserMailerListener.name);

  constructor(
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {}

  @OnEvent('user.created')
  async handleUserCreated(event: UserCreatedEvent): Promise<void> {
    // `mailer.frontendUrl` is already normalized + production-guarded by config;
    // this is a last-mile safety net so a local value in a non-prod env is loud.
    const base = normalizeBaseUrl(
      this.config.get<string>('mailer.frontendUrl'),
      'http://localhost:3001',
    );
    if (isLocalUrl(base)) {
      this.logger.warn(
        `Welcome link will point at "${base}" (a local URL) — set FRONTEND_URL to the public app origin.`,
      );
    }
    const changePasswordUrl = `${base}/auth/change-password?token=${encodeURIComponent(event.changePasswordToken)}`;

    try {
      await this.mailer.sendWelcome({
        email: event.email,
        fullName: event.fullName,
        tempPassword: event.tempPassword,
        changePasswordUrl,
      });
      this.logger.log(`Welcome email sent to ${event.email}`);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send welcome email to ${event.email}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
