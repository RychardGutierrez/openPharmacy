import type { ConfigService as PharmacyConfigService } from '../../config/config.service';
import { SiatConfigError } from '../client/siat-errors';
import { ConfigSiatCredentialsSource } from './config-siat-credentials.source';
import type { SiatConfig } from './siat.config';

function build(
  stored: Record<string, unknown> | Error,
  config: Partial<SiatConfig> = {},
) {
  const settings = {
    getStoredValues: jest.fn(() =>
      stored instanceof Error
        ? Promise.reject(stored)
        : Promise.resolve(stored),
    ),
  };
  const source = new ConfigSiatCredentialsSource(
    settings as unknown as PharmacyConfigService,
    {
      environment: 'pilot',
      baseUrl: 'https://pilot.example.test/v2',
      token: '',
      connectTimeoutMs: 5000,
      totalTimeoutMs: 20000,
      readRetries: 0,
      retryBaseMs: 0,
      cuisRenewDays: 5,
      cuisAlertDays: 15,
      cufdRotateMinute: 5,
      cufdRenewBeforeMinutes: 60,
      cufdSweepMs: 60000,
      cufdRetryMaxMs: 900000,
      catalogSyncMinute: 60,
      clockSyncMs: 3600000,
      clockWarnMs: 5000,
      clockMaxRttMs: 2000,
      ...config,
    },
  );
  return { source, settings };
}

describe('ConfigSiatCredentialsSource', () => {
  it('reads the token, the system code and PHARMACY_NIT as the NIT', async () => {
    const { source, settings } = build({
      SIAT_TOKEN: 'db-tok',
      SIAT_SYSTEM_CODE: 'ABC123',
      PHARMACY_NIT: '1023456789012',
    });

    await expect(source.resolve()).resolves.toEqual({
      token: 'db-tok',
      codigoSistema: 'ABC123',
      nit: '1023456789012',
    });
    expect(settings.getStoredValues).toHaveBeenCalledWith(
      expect.arrayContaining([
        'SIAT_TOKEN',
        'SIAT_SYSTEM_CODE',
        'PHARMACY_NIT',
      ]),
    );
  });

  it('prefers the token saved in Settings over the environment', async () => {
    const { source } = build({ SIAT_TOKEN: 'db-tok' }, { token: 'env-tok' });

    expect((await source.resolve()).token).toBe('db-tok');
  });

  it('falls back to the environment token in the pilot only', async () => {
    expect((await build({}, { token: 'env-tok' }).source.resolve()).token).toBe(
      'env-tok',
    );
    expect(
      (
        await build(
          {},
          { token: 'env-tok', environment: 'production' },
        ).source.resolve()
      ).token,
    ).toBe('');
  });

  it('reads the settings on every call, with no cache', async () => {
    const { source, settings } = build({ SIAT_TOKEN: 'db-tok' });

    await source.resolve();
    await source.resolve();

    expect(settings.getStoredValues).toHaveBeenCalledTimes(2);
  });

  it('maps an unreadable setting (for example a missing encryption key) to SiatConfigError', async () => {
    const { source } = build(new Error('CONFIG_ENCRYPTION_KEY is required'));

    await expect(source.resolve()).rejects.toBeInstanceOf(SiatConfigError);
  });
});
