import { Injectable, Logger } from '@nestjs/common';
import { MailerService as NestMailerService } from '@nestjs-modules/mailer';

export interface WelcomeMailPayload {
  email: string;
  fullName: string;
  tempPassword: string;
  changePasswordUrl: string;
}

export interface PasswordResetPayload {
  email: string;
  fullName: string;
  resetUrl: string;
}

/**
 * Thin wrapper around the NestJS mailer that hides template names and keeps
 * callers type-safe.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(private readonly mailer: NestMailerService) {}

  async sendWelcome(payload: WelcomeMailPayload): Promise<void> {
    await this.mailer.sendMail({
      to: payload.email,
      subject: 'Welcome to openPharmacy',
      template: 'welcome',
      context: {
        fullName: payload.fullName,
        tempPassword: payload.tempPassword,
        changePasswordUrl: payload.changePasswordUrl,
      },
    });
  }

  async sendPasswordReset(payload: PasswordResetPayload): Promise<void> {
    await this.mailer.sendMail({
      to: payload.email,
      subject: 'Reset your openPharmacy password',
      template: 'reset-password',
      context: {
        fullName: payload.fullName,
        resetUrl: payload.resetUrl,
      },
    });
  }
}
