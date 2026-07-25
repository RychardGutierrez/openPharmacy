import { z } from "zod"
import { USER_ROLES, type UserRole } from "@/features/auth/types"

export { USER_ROLES }
export type { UserRole }

/**
 * Shape of a user as returned by the API. Dates are ISO strings.
 */
export const userSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  ci: z.string(),
  email: z.email(),
  role: z.enum(USER_ROLES),
  regNumber: z.string().nullable().optional(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable().optional(),
})
export type User = z.infer<typeof userSchema>

export const paginatedUsersSchema = z.object({
  data: z.array(userSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
})
export type PaginatedUsers = z.infer<typeof paginatedUsersSchema>

/**
 * Client-side form schema. Mirrors the backend validation rules and adds
 * the conditional reg. number requirement for Pharmacist.
 */
export const userFormSchema = z
  .object({
    fullName: z
      .string()
      .min(2, "Full name must be at least 2 characters")
      .max(100, "Full name is too long"),
    ci: z.string().regex(/^\d{6,12}$/, "CI must be 6 to 12 numeric digits"),
    email: z.email("Enter a valid email address"),
    role: z.enum(USER_ROLES),
    regNumber: z.string().optional(),
  })
  .refine(
    (data) =>
      data.role !== "PHARMACIST" ||
      (typeof data.regNumber === "string" && data.regNumber.trim().length > 0),
    {
      message: "Registration number is required for Pharmacist",
      path: ["regNumber"],
    },
  )
export type UserFormValues = z.infer<typeof userFormSchema>

export type UserStatus = "active" | "inactive"

export function getUserStatus(active: boolean): UserStatus {
  return active ? "active" : "inactive"
}

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: "Active",
  inactive: "Inactive",
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Admin",
  PHARMACIST: "Pharmacist",
  CASHIER: "Cashier",
}
