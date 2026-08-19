export const SHIFTS_ERROR_MESSAGES = {
  SHIFT_ALREADY_OPEN: "Ya tienes un turno abierto.",
  SHIFT_ALREADY_CLOSED: "El turno ya está cerrado.",
  SHIFT_NOT_FOUND: "Turno no encontrado.",
  SHIFT_NOT_OWNER: "Solo el dueño del turno puede cerrarlo.",
  REOPEN_PENDING_EXISTS: "Ya existe una solicitud de reapertura para este turno.",
  REOPEN_NOT_FOUND: "Solicitud de reapertura no encontrada.",
  REOPEN_ALREADY_REVIEWED: "La solicitud ya fue revisada.",
  NOT_OPEN_SHIFT: "Debes abrir un turno antes de operar.",
  GENERIC: "Algo salió mal. Intenta nuevamente.",
} as const

export type ShiftsErrorCode = keyof typeof SHIFTS_ERROR_MESSAGES | "UNKNOWN"
