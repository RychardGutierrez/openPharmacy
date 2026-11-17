import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  ConfigService as PharmacyConfigService,
  type ConfigRequestMetadata,
} from '../../config/config.service';
import type { SiatSettingKey } from '../../config/config.keys';
import {
  SiatHealthService,
  type SiatConnectionCheck,
} from '../client/siat-health.service';
import { SIAT_CONFIG, type SiatConfig } from '../config/siat.config';
import { PrismaSiatCuisStatusReader } from '../persistence/prisma-siat-cuis-status.reader';
import type { UpdateSiatSettingsDto } from './dto/update-siat-settings.dto';

export type SiatEnvironmentLabel = 'PILOTO' | 'PRODUCCION';

/** Fields that must be set before `SIAT_ENABLED` can be true. */
export type SiatReadinessGap =
  | 'nit'
  | 'systemCode'
  | 'razonSocial'
  | 'municipio'
  | 'defaultActivity'
  | 'token'
  | 'tokenExpired';

export interface SiatTokenStatus {
  configured: boolean;
  /** `settings` = encrypted setting. `environment` = pilot-only `SIAT_TOKEN` fallback. */
  source: 'settings' | 'environment' | null;
  expiresAt: string | null;
  expired: boolean;
  /** Days left, counted in Bolivia time. Negative once expired. Null without a date. */
  daysUntilExpiry: number | null;
}

/** What `GET /siat/settings` returns. Never contains the token. */
export interface SiatSettingsView {
  environment: SiatEnvironmentLabel;
  /** `PHARMACY_NIT`. Read-only here: it is edited in the general configuration. */
  nit: string;
  systemCode: string;
  modality: number;
  razonSocial: string;
  municipio: string;
  telefono: string;
  defaultActivity: string;
  enabled: boolean;
  emailInvoices: boolean;
  token: SiatTokenStatus;
  readiness: { ready: boolean; missing: SiatReadinessGap[] };
}

export interface SiatConnectionTestResult {
  environment: SiatEnvironmentLabel;
  connection: SiatConnectionCheck;
  cuis: {
    codigoSucursal: number;
    codigoPuntoVenta: number;
    status: 'active' | 'expired' | 'missing' | 'no-point-of-sale';
    validUntil: Date | null;
  };
}

/** Non-secret keys read for the view. The token is never decrypted here. */
const READ_KEYS = [
  'PHARMACY_NIT',
  'SIAT_SYSTEM_CODE',
  'SIAT_TOKEN_EXPIRES_AT',
  'SIAT_MODALITY',
  'SIAT_RAZON_SOCIAL',
  'SIAT_MUNICIPIO',
  'SIAT_TELEFONO',
  'SIAT_DEFAULT_ACTIVITY',
  'SIAT_ENABLED',
  'SIAT_EMAIL_INVOICES',
] as const;

const DTO_TO_KEY: Record<
  Exclude<keyof UpdateSiatSettingsDto, 'token'>,
  SiatSettingKey
> = {
  systemCode: 'SIAT_SYSTEM_CODE',
  tokenExpiresAt: 'SIAT_TOKEN_EXPIRES_AT',
  modality: 'SIAT_MODALITY',
  razonSocial: 'SIAT_RAZON_SOCIAL',
  municipio: 'SIAT_MUNICIPIO',
  telefono: 'SIAT_TELEFONO',
  defaultActivity: 'SIAT_DEFAULT_ACTIVITY',
  enabled: 'SIAT_ENABLED',
  emailInvoices: 'SIAT_EMAIL_INVOICES',
};

/** Computarizada en Línea (decision D1). */
const DEFAULT_MODALITY = 2;
const BOLIVIA_TIME_ZONE = 'America/La_Paz';

/**
 * SIAT settings editable by ADMIN (SIAT-04). Values live in the `config` table (group `siat`);
 * the token is stored encrypted and is write-only. `SIAT_ENV` stays an environment variable,
 * so production can never be switched to the pilot from the UI.
 */
@Injectable()
export class SiatSettingsService {
  constructor(
    private readonly settings: PharmacyConfigService,
    private readonly health: SiatHealthService,
    private readonly cuisReader: PrismaSiatCuisStatusReader,
    @Inject(SIAT_CONFIG) private readonly config: SiatConfig,
  ) {}

  async get(now: Date = new Date()): Promise<SiatSettingsView> {
    const [stored, configured] = await Promise.all([
      this.settings.getStoredValues(READ_KEYS),
      this.settings.getConfiguredKeys(['SIAT_TOKEN']),
    ]);
    const tokenInSettings = configured.has('SIAT_TOKEN');
    const token = this.tokenStatus(
      tokenInSettings,
      text(stored.SIAT_TOKEN_EXPIRES_AT),
      now,
    );

    return {
      environment: this.environmentLabel(),
      nit: text(stored.PHARMACY_NIT),
      systemCode: text(stored.SIAT_SYSTEM_CODE),
      modality:
        typeof stored.SIAT_MODALITY === 'number'
          ? stored.SIAT_MODALITY
          : DEFAULT_MODALITY,
      razonSocial: text(stored.SIAT_RAZON_SOCIAL),
      municipio: text(stored.SIAT_MUNICIPIO),
      telefono: text(stored.SIAT_TELEFONO),
      defaultActivity: text(stored.SIAT_DEFAULT_ACTIVITY),
      enabled: stored.SIAT_ENABLED === true,
      emailInvoices: stored.SIAT_EMAIL_INVOICES === true,
      token,
      readiness: this.readiness(stored, token),
    };
  }

  async update(
    dto: UpdateSiatSettingsDto,
    metadata: ConfigRequestMetadata,
    now: Date = new Date(),
  ): Promise<SiatSettingsView> {
    const values: Record<string, unknown> = {};
    for (const [field, key] of Object.entries(DTO_TO_KEY)) {
      const value = dto[field as keyof typeof DTO_TO_KEY];
      if (value !== undefined)
        values[key] = typeof value === 'string' ? value.trim() : value;
    }
    // Write-only: an empty token means "keep the stored one".
    const newToken = dto.token?.trim();
    if (newToken) {
      if (!dto.tokenExpiresAt) {
        throw new BadRequestException({
          code: 'SIAT_TOKEN_EXPIRY_REQUIRED',
          message: 'Indica la fecha de vencimiento del nuevo token delegado',
        });
      }
      values.SIAT_TOKEN = newToken;
    }
    if (Object.keys(values).length === 0) {
      throw new BadRequestException('No hay cambios para guardar');
    }

    const [stored, configured] = await Promise.all([
      this.settings.getStoredValues(READ_KEYS),
      this.settings.getConfiguredKeys(['SIAT_TOKEN']),
    ]);
    const merged = { ...stored, ...values };
    if (merged.SIAT_ENABLED === true) {
      const token = this.tokenStatus(
        configured.has('SIAT_TOKEN') || Boolean(newToken),
        text(merged.SIAT_TOKEN_EXPIRES_AT),
        now,
      );
      const { ready, missing } = this.readiness(merged, token);
      if (!ready) {
        throw new BadRequestException({
          code: 'SIAT_NOT_READY',
          message:
            'Completa la configuración SIAT antes de habilitar la facturación',
          missing,
        });
      }
    }

    // Validation, encryption and the SIAT_CONFIG_UPDATED audit row (secrets redacted).
    await this.settings.writeValues(values, metadata, 'siat');
    return this.get(now);
  }

  /** `verificarComunicacion` plus the CUIS stored for casa matriz 0 / PoS 0. Never throws. */
  async testConnection(
    now: Date = new Date(),
  ): Promise<SiatConnectionTestResult> {
    const [connection, stored] = await Promise.all([
      this.health.checkConnection(),
      this.cuisReader.find(0, 0),
    ]);

    let status: SiatConnectionTestResult['cuis']['status'] = 'no-point-of-sale';
    if (stored) {
      status = !stored.activeCuis
        ? 'missing'
        : stored.activeCuis.validUntil.getTime() > now.getTime()
          ? 'active'
          : 'expired';
    }

    return {
      environment: this.environmentLabel(),
      connection,
      cuis: {
        codigoSucursal: 0,
        codigoPuntoVenta: 0,
        status,
        validUntil: stored?.activeCuis?.validUntil ?? null,
      },
    };
  }

  private environmentLabel(): SiatEnvironmentLabel {
    return this.config.environment === 'production' ? 'PRODUCCION' : 'PILOTO';
  }

  private tokenStatus(
    inSettings: boolean,
    expiresAt: string,
    now: Date,
  ): SiatTokenStatus {
    const fromEnv =
      !inSettings &&
      this.config.environment === 'pilot' &&
      this.config.token !== '';
    const configured = inSettings || fromEnv;
    const days = expiresAt ? daysBetween(boliviaDate(now), expiresAt) : null;
    return {
      configured,
      source: inSettings ? 'settings' : fromEnv ? 'environment' : null,
      expiresAt: expiresAt || null,
      // The token is valid through its expiry date (inclusive).
      expired: days !== null && days < 0,
      daysUntilExpiry: days,
    };
  }

  private readiness(
    values: Record<string, unknown>,
    token: SiatTokenStatus,
  ): SiatSettingsView['readiness'] {
    const missing: SiatReadinessGap[] = [];
    if (!/^\d+$/.test(text(values.PHARMACY_NIT))) missing.push('nit');
    if (!text(values.SIAT_SYSTEM_CODE)) missing.push('systemCode');
    if (!text(values.SIAT_RAZON_SOCIAL).trim()) missing.push('razonSocial');
    if (!text(values.SIAT_MUNICIPIO).trim()) missing.push('municipio');
    if (!text(values.SIAT_DEFAULT_ACTIVITY)) missing.push('defaultActivity');
    if (!token.configured) missing.push('token');
    else if (token.expired) missing.push('tokenExpired');
    return { ready: missing.length === 0, missing };
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Calendar date (YYYY-MM-DD) in Bolivia for the given instant. */
export function boliviaDate(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BOLIVIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

function daysBetween(from: string, to: string): number {
  const utc = (date: string) => {
    const [y, m, d] = date.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}
