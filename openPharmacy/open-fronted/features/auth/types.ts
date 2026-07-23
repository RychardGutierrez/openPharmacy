import { z } from "zod"

export const USER_ROLES = ["ADMIN", "PHARMACIST", "CASHIER"] as const
export type UserRole = (typeof USER_ROLES)[number]

/** Safe user projection returned by the API (never includes credentials). */
export const authUserSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  email: z.email(),
  role: z.enum(USER_ROLES),
})
export type AuthUser = z.infer<typeof authUserSchema>

/** Shape shared by POST /api/auth/login and POST /api/auth/refresh. */
export const authResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
  user: authUserSchema,
})
export type AuthResponse = z.infer<typeof authResponseSchema>

/** Client-side validation for the login form. Mirrors the backend LoginDto. */
export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .max(128, "Password is too long"),
})
export type LoginValues = z.infer<typeof loginSchema>
