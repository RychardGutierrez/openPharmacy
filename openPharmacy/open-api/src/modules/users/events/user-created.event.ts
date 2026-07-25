/**
 * Domain event emitted by `UsersService` after a user is persisted.
 *
 * Consumers (currently `UserMailerListener`) react to this event to send the
 * welcome email with the temporary password and the 24h password-change link.
 */
export class UserCreatedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly fullName: string,
    public readonly tempPassword: string,
    public readonly changePasswordToken: string,
    public readonly changePasswordExpiresAt: Date,
  ) {}
}
