export const USERS_ERROR_MESSAGES = {
  EMAIL_EXISTS: "Ya existe una cuenta con este correo electrónico.",
  CI_EXISTS: "Ya existe una cuenta con este CI.",
  LAST_ADMIN: "No se puede desactivar la última cuenta de administrador activa.",
  USER_NOT_FOUND: "Usuario no encontrado.",
  GENERIC: "Ocurrió un error. Inténtalo nuevamente.",
} as const

export type UsersErrorCode = keyof typeof USERS_ERROR_MESSAGES | "UNKNOWN"
