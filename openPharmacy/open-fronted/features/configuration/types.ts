import { z } from "zod"

export const configurationSchema = z.object({
  PHARMACY_NAME: z.string(),
  PHARMACY_NIT: z.string(),
  PHARMACY_ADDRESS: z.string(),
  PHARMACY_PHONE: z.string(),
  PHARMACY_PROPRIETOR: z.string(),
  INVENTORY_LOW_STOCK: z.number().int().min(0),
  EXPIRY_WARNING_DAYS: z.number().int().min(0).max(3650),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.number().int().min(1).max(65535),
  SMTP_USER: z.string(),
  SMTP_PASSWORD: z.string(),
  SMTP_SECURE: z.boolean(),
  SMTP_FROM: z.string(),
  RECEIPT_FOOTER: z.string(),
  RECEIPT_PAPER_WIDTH: z.enum(["58mm", "80mm"]),
  RECEIPT_LOGO_PATH: z.string(),
})

export type ConfigurationValues = z.infer<typeof configurationSchema>

export const EMPTY_CONFIGURATION: ConfigurationValues = {
  PHARMACY_NAME: "",
  PHARMACY_NIT: "",
  PHARMACY_ADDRESS: "",
  PHARMACY_PHONE: "",
  PHARMACY_PROPRIETOR: "",
  INVENTORY_LOW_STOCK: 0,
  EXPIRY_WARNING_DAYS: 60,
  SMTP_HOST: "",
  SMTP_PORT: 587,
  SMTP_USER: "",
  SMTP_PASSWORD: "",
  SMTP_SECURE: false,
  SMTP_FROM: "",
  RECEIPT_FOOTER: "",
  RECEIPT_PAPER_WIDTH: "80mm",
  RECEIPT_LOGO_PATH: "",
}
