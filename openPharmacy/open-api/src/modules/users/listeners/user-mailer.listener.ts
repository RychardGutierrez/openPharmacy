import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '../../../common/mailer/mailer.service';
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
    const frontendUrl = this.config.get<string>(
      'mailer.frontendUrl',
      'http://localhost:4200',
    );
    const changePasswordUrl = `${frontendUrl}/auth/change-password?token=${encodeURIComponent(event.changePasswordToken)}`;

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
