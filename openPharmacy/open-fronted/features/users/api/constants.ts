export const USERS_ERROR_MESSAGES = {
  EMAIL_EXISTS: "An account with this email already exists.",
  CI_EXISTS: "An account with this CI already exists.",
  LAST_ADMIN: "Cannot deactivate the last active admin account.",
  USER_NOT_FOUND: "User not found.",
  GENERIC: "Something went wrong. Please try again.",
} as const

export type UsersErrorCode = keyof typeof USERS_ERROR_MESSAGES | "UNKNOWN"
