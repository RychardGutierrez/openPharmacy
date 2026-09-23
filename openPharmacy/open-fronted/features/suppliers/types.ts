import { z } from "zod"

const supplierResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  nit: z.string(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  contactPerson: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  paymentTerms: z.string().nullable().optional(),
  active: z.boolean().default(true),
})

export const supplierSchema = z.preprocess((data) => {
  if (typeof data !== "object" || data === null) return data
  const record = data as Record<string, unknown>
  return {
    ...record,
    contactPerson:
      record.contactPerson ?? record.contact_person ?? null,
    paymentTerms:
      record.paymentTerms ?? record.payment_terms ?? null,
  }
}, supplierResponseSchema)
export type Supplier = z.infer<typeof supplierSchema>

export const paginatedSuppliersSchema = z.object({
  data: z.array(supplierSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
})
export type PaginatedSuppliers = z.infer<typeof paginatedSuppliersSchema>

export const supplierStatusSchema = z.enum(["ALL", "ACTIVE", "INACTIVE"])
export type SupplierStatus = z.infer<typeof supplierStatusSchema>

export const SUPPLIER_STATUS_LABELS: Record<SupplierStatus, string> = {
  ALL: "Todos los estados",
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
}

export interface SuppliersFiltersValue {
  q: string
  status: SupplierStatus
}

export interface SuppliersListQuery {
  page?: number
  pageSize?: number
  active?: boolean
  q?: string
}

export const supplierFormSchema = z.object({
  name: z
    .string()
    .min(2, "El nombre de la empresa es obligatorio")
    .max(255, "El nombre de la empresa es demasiado largo"),
  nit: z
    .string()
    .min(1, "El NIT es obligatorio")
    .regex(/^\d+$/, "El NIT solo debe contener dígitos"),
  address: z.string().max(255).optional(),
  city: z.string().max(120).optional(),
  contactPerson: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  email: z
    .union([z.string().email("Correo electrónico inválido").max(255), z.literal("")])
    .optional(),
  paymentTerms: z.string().max(120).optional(),
})
export type SupplierFormValues = z.infer<typeof supplierFormSchema>

export type CreateSupplierPayload = SupplierFormValues
export type UpdateSupplierPayload = Partial<SupplierFormValues>
