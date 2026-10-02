# Users Module

User administration and self-service account management for authenticated
OpenPharmacy users.

## Responsibilities

- Admin-only user creation, listing, lookup, editing, activation, and
  deactivation.
- Safe user response projection that excludes password and lockout fields.
- Current-user profile retrieval and full-name editing.
- Current-user password changes with current-password verification.
- Audit events for administrative and self-service changes.

## Endpoints

All routes require a Bearer access token unless stated otherwise.

| Method | Route | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/users` | ADMIN | Create a user and issue a temporary password workflow |
| `GET` | `/api/users` | ADMIN | Paginated user list and filters |
| `GET` | `/api/users/lookup` | ADMIN, PHARMACIST | Lightweight user lookup |
| `GET` | `/api/users/me` | Any authenticated user | Read current profile |
| `PATCH` | `/api/users/me` | Any authenticated user | Update current full name |
| `PATCH` | `/api/users/me/password` | Any authenticated user | Change current password |
| `GET` | `/api/users/:id` | Authenticated user | Read a user by id |
| `PATCH` | `/api/users/:id` | ADMIN | Update managed user fields |
| `PATCH` | `/api/users/:id/deactivate` | ADMIN | Soft-deactivate a user |
| `PATCH` | `/api/users/:id/activate` | ADMIN | Reactivate a user |

## Security and invariants

- Passwords are bcrypt hashes and never appear in response DTOs.
- Profile editing cannot change role, CI, email, or registration number.
- Password changes require the existing password and matching new-password
  confirmation, update `password_changed_at`, revoke refresh sessions, and
  write `PASSWORD_CHANGED` to the audit log.
- The final active administrator cannot be deactivated.
- Email and CI uniqueness are checked before managed-user updates.
- New users receive a generated temporary password through the mailer event.

## Structure

- `users.controller.ts`: route and role declarations.
- `users.service.ts`: user rules, password workflow, audit integration.
- `repositories/users.repository.ts`: persistence and sensitive-field omission.
- `dto/`: admin, profile, password, lookup, and response contracts.
- `listeners/user-mailer.listener.ts`: temporary-password email handling.

## Dependencies

`AuditModule`, `MailerModule`, `JwtModule`, Prisma, bcrypt, and the global JWT
and role guards.
