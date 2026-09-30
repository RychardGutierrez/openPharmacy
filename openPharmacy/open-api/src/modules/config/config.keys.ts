export type ConfigValueType = 'string' | 'integer' | 'boolean';

export interface ConfigKeyDefinition {
  type: ConfigValueType;
  encrypted?: boolean;
  required?: boolean;
  min?: number;
  max?: number;
}

export const CONFIG_KEYS: Record<string, ConfigKeyDefinition> = {
  PHARMACY_NAME: { type: 'string', required: true },
  PHARMACY_NIT: { type: 'string' },
  PHARMACY_ADDRESS: { type: 'string' },
  PHARMACY_PHONE: { type: 'string' },
  PHARMACY_PROPRIETOR: { type: 'string' },
  INVENTORY_LOW_STOCK: { type: 'integer', min: 0 },
  EXPIRY_WARNING_DAYS: { type: 'integer', min: 0, max: 3650 },
  SMTP_HOST: { type: 'string' },
  SMTP_PORT: { type: 'integer', min: 1, max: 65535 },
  SMTP_USER: { type: 'string' },
  SMTP_PASSWORD: { type: 'string', encrypted: true },
  SMTP_SECURE: { type: 'boolean' },
  SMTP_FROM: { type: 'string' },
  RECEIPT_FOOTER: { type: 'string' },
  RECEIPT_PAPER_WIDTH: { type: 'string' },
  RECEIPT_LOGO_PATH: { type: 'string' },
};

export const PHARMACY_INFO_KEYS = [
  'PHARMACY_NAME',
  'PHARMACY_NIT',
  'PHARMACY_ADDRESS',
  'PHARMACY_PHONE',
  'PHARMACY_PROPRIETOR',
] as const;

export const RECEIPT_SETTING_KEYS = [
  'RECEIPT_FOOTER',
  'RECEIPT_PAPER_WIDTH',
  'RECEIPT_LOGO_PATH',
] as const;
