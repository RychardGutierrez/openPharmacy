/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UserMailerListener } from './user-mailer.listener';
import { MailerService } from '../../../common/mailer/mailer.service';
import { UserCreatedEvent } from '../events/user-created.event';

describe('UserMailerListener', () => {
  let listener: UserMailerListener;
  let mailer: jest.Mocked<MailerService>;
  let config: { get: jest.Mock };

  beforeEach(async () => {
    mailer = {
      sendWelcome: jest.fn(),
    } as unknown as jest.Mocked<MailerService>;

    config = {
      get: jest.fn().mockReturnValue('http://localhost:4200'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserMailerListener,
        { provide: MailerService, useValue: mailer },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    listener = module.get<UserMailerListener>(UserMailerListener);
  });

  it('sends welcome email with change password link', async () => {
    const event = new UserCreatedEvent(
      'u-1',
      'test@example.com',
      'Test User',
      'temp-pass',
      'token-123',
      new Date(Date.now() + 24 * 60 * 60 * 1000),
    );

    await listener.handleUserCreated(event);

    expect(mailer.sendWelcome as jest.Mock).toHaveBeenCalledWith({
      email: event.email,
      fullName: event.fullName,
      tempPassword: event.tempPassword,
      changePasswordUrl:
        'http://localhost:4200/auth/change-password?token=token-123',
    });
  });

  it('does not propagate mailer errors', async () => {
    const event = new UserCreatedEvent(
      'u-1',
      'test@example.com',
      'Test User',
      'temp-pass',
      'token-123',
      new Date(Date.now() + 24 * 60 * 60 * 1000),
    );
    (mailer.sendWelcome as jest.Mock).mockRejectedValue(new Error('SMTP down'));

    await expect(listener.handleUserCreated(event)).resolves.toBeUndefined();
    expect(mailer.sendWelcome as jest.Mock).toHaveBeenCalled();
  });
});
