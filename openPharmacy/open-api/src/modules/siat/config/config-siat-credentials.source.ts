import { Inject, Injectable } from '@nestjs/common';
import { ConfigService as PharmacyConfigService } from '../../config/config.service';
import { SiatConfigError } from '../client/siat-errors';
import { SIAT_CONFIG, type SiatConfig } from './siat.config';
import type {
  SiatCredentials,
  SiatCredentialsSource,
} from './siat-credentials';

const KEYS = ['SIAT_TOKEN', 'SIAT_SYSTEM_CODE', 'PHARMACY_NIT'] as const;

/**
 * Reads the SIAT credentials from the settings table on every call (a few rows; SIAT calls are
 * network-bound), so a change saved in Settings applies to the next call with no restart and
 * no cache to invalidate.
 *
 * Token precedence: the encrypted `SIAT_TOKEN` setting. The `SIAT_TOKEN` environment variable is
 * only a fallback for the **pilot** (local development and `siat:live-check`); in production
 * it is rejected at startup.
 */
@Injectable()
export class ConfigSiatCredentialsSource implements SiatCredentialsSource {
  constructor(
    private readonly settings: PharmacyConfigService,
    @Inject(SIAT_CONFIG) private readonly config: SiatConfig,
  ) {}

  async resolve(): Promise<SiatCredentials> {
    let stored: Record<string, unknown>;
    try {
      stored = await this.settings.getStoredValues(KEYS);
    } catch (error) {
      // Typically CONFIG_ENCRYPTION_KEY missing or changed. Never include the stored value.
      throw new SiatConfigError(
        `The SIAT settings could not be read: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }

    const storedToken = text(stored.SIAT_TOKEN);
    const token =
      storedToken ||
      (this.config.environment === 'pilot' ? this.config.token : '');

    return {
      token,
      nit: text(stored.PHARMACY_NIT),
      codigoSistema: text(stored.SIAT_SYSTEM_CODE),
    };
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
