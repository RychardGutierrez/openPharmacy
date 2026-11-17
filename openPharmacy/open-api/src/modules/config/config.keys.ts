export type ConfigValueType = 'string' | 'integer' | 'boolean';

/**
 * `siat` keys are managed only through `/api/siat/settings` (SIAT-04): the generic `/api/config`
 * endpoints neither return nor accept them, so `SIAT_CONFIG_UPDATED` is always audited.
 */
export type ConfigKeyGroup = 'general' | 'siat';

export interface ConfigKeyDefinition {
  type: ConfigValueType;
  group?: ConfigKeyGroup;
  encrypted?: boolean;
  required?: boolean;
  min?: number;
  max?: number;
  /** For strings: a non-empty value must match. An empty string always means "not set". */
  pattern?: RegExp;
  maxLength?: number;
  /** Spanish message shown when the value is invalid. */
  message?: string;
}

export const CONFIG_KEYS: Record<string, ConfigKeyDefinition> = {
  PHARMACY_NAME: {
    type: 'string',
    required: true,
    message: 'El nombre de la farmacia es obligatorio',
  },
  // Also the NIT sent to SIAT (SIAT-04): it must match the Padrón exactly.
  PHARMACY_NIT: {
    type: 'string',
    pattern: /^\d{1,20}$/,
    message: 'El NIT debe contener solo dígitos',
  },
  PHARMACY_ADDRESS: { type: 'string' },
  PHARMACY_PHONE: { type: 'string' },
  PHARMACY_PROPRIETOR: { type: 'string' },
  INVENTORY_LOW_STOCK: { type: 'integer', min: 0 },
  EXPIRY_WARNING_DAYS: { type: 'integer', min: 0, max: 3650 },
  SMTP_HOST: { type: 'string' },
  SMTP_PORT: { type: 'integer', min: 1, max: 65535 },
  SMTP_USER: { type: 'string' },
  SMTP_PASSWORD: {
    type: 'string',
    encrypted: true,
    message: 'La contraseña SMTP es obligatoria',
  },
  SMTP_SECURE: { type: 'boolean' },
  SMTP_FROM: { type: 'string' },
  RECEIPT_FOOTER: { type: 'string' },
  RECEIPT_PAPER_WIDTH: { type: 'string' },
  RECEIPT_LOGO_PATH: { type: 'string' },

  // ─── SIAT electronic invoicing (SIAT-04). The NIT is PHARMACY_NIT. ───────
  SIAT_SYSTEM_CODE: {
    type: 'string',
    group: 'siat',
    pattern: /^\S{1,100}$/,
    message: 'El código de sistema no puede contener espacios',
  },
  SIAT_TOKEN: {
    type: 'string',
    group: 'siat',
    encrypted: true,
    pattern: /^\S{1,4096}$/,
    message: 'El token delegado no es válido',
  },
  SIAT_TOKEN_EXPIRES_AT: {
    type: 'string',
    group: 'siat',
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    message:
      'La fecha de vencimiento del token debe tener el formato AAAA-MM-DD',
  },
  // 2 = Computarizada en Línea (decision D1). The only modality supported.
  SIAT_MODALITY: {
    type: 'integer',
    group: 'siat',
    min: 2,
    max: 2,
    message: 'Solo se admite la modalidad Computarizada en Línea (2)',
  },
  SIAT_RAZON_SOCIAL: { type: 'string', group: 'siat', maxLength: 200 },
  SIAT_MUNICIPIO: { type: 'string', group: 'siat', maxLength: 100 },
  SIAT_TELEFONO: { type: 'string', group: 'siat', maxLength: 50 },
  SIAT_DEFAULT_ACTIVITY: {
    type: 'string',
    group: 'siat',
    pattern: /^\d{1,10}$/,
    message: 'El código de actividad debe contener solo dígitos',
  },
  SIAT_ENABLED: { type: 'boolean', group: 'siat' },
  SIAT_EMAIL_INVOICES: { type: 'boolean', group: 'siat' },
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

export const SIAT_SETTING_KEYS = [
  'SIAT_SYSTEM_CODE',
  'SIAT_TOKEN',
  'SIAT_TOKEN_EXPIRES_AT',
  'SIAT_MODALITY',
  'SIAT_RAZON_SOCIAL',
  'SIAT_MUNICIPIO',
  'SIAT_TELEFONO',
  'SIAT_DEFAULT_ACTIVITY',
  'SIAT_ENABLED',
  'SIAT_EMAIL_INVOICES',
] as const;

export type SiatSettingKey = (typeof SIAT_SETTING_KEYS)[number];

export function configKeyGroup(key: string): ConfigKeyGroup {
  return CONFIG_KEYS[key]?.group ?? 'general';
}
