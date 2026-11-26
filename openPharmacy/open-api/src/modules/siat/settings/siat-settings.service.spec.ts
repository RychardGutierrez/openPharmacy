import type { ConfigService as PharmacyConfigService } from '../../config/config.service';
import type { SiatHealthService } from '../client/siat-health.service';
import type { SiatConfig } from '../config/siat.config';
import type { PrismaSiatCuisStatusReader } from '../persistence/prisma-siat-cuis-status.reader';
import { SiatSettingsService, boliviaDate } from './siat-settings.service';

// 2026-11-15 12:00 in La Paz (UTC-4).
const NOW = new Date('2026-11-15T16:00:00Z');

const COMPLETE = {
  PHARMACY_NIT: '1023456789012',
  SIAT_SYSTEM_CODE: 'ABC123',
  SIAT_TOKEN_EXPIRES_AT: '2027-11-15',
  SIAT_RAZON_SOCIAL: 'FARMACIA EJEMPLO S.R.L.',
  SIAT_MUNICIPIO: 'La Paz',
  SIAT_DEFAULT_ACTIVITY: '477300',
};

function build(
  options: {
    stored?: Record<string, unknown>;
    tokenInSettings?: boolean;
    config?: Partial<SiatConfig>;
  } = {},
) {
  const settings = {
    getStoredValues: jest
      .fn<Promise<Record<string, unknown>>, [readonly string[]]>()
      .mockResolvedValue(options.stored ?? {}),
    getConfiguredKeys: jest
      .fn<Promise<Set<string>>, [readonly string[]]>()
      .mockResolvedValue(
        new Set(options.tokenInSettings ? ['SIAT_TOKEN'] : []),
      ),
    writeValues: jest
      .fn<Promise<void>, [Record<string, unknown>, unknown, string]>()
      .mockResolvedValue(undefined),
  };
  const health = {
    checkConnection: jest.fn().mockResolvedValue({
      service: 'FacturacionCodigos',
      status: 'ok',
      checkedAt: NOW,
      durationMs: 12,
      mensajes: [],
    }),
  };
  const cuisReader = { find: jest.fn().mockResolvedValue(null) };
  const config: SiatConfig = {
    environment: 'pilot',
    baseUrl: 'https://pilot.example.test/v2',
    token: '',
    connectTimeoutMs: 5000,
    totalTimeoutMs: 20000,
    readRetries: 2,
    retryBaseMs: 0,
    cuisRenewDays: 5,
    cuisAlertDays: 15,
    cufdRotateMinute: 5,
    cufdRenewBeforeMinutes: 60,
    cufdSweepMs: 60000,
    cufdRetryMaxMs: 900000,
    ...options.config,
  };
  const service = new SiatSettingsService(
    settings as unknown as PharmacyConfigService,
    health as unknown as SiatHealthService,
    cuisReader as unknown as PrismaSiatCuisStatusReader,
    config,
  );
  return { service, settings, health, cuisReader };
}

const metadata = { userId: 'admin-1' };

describe('SiatSettingsService.get', () => {
  it('never reads or returns the token, only its status', async () => {
    const { service, settings } = build({
      stored: COMPLETE,
      tokenInSettings: true,
    });

    const view = await service.get(NOW);

    expect(settings.getStoredValues.mock.calls[0][0]).not.toContain(
      'SIAT_TOKEN',
    );
    expect(JSON.stringify(view)).not.toMatch(/tok-/);
    expect(view.token).toEqual({
      configured: true,
      source: 'settings',
      expiresAt: '2027-11-15',
      expired: false,
      daysUntilExpiry: 365,
    });
  });

  it('uses PHARMACY_NIT as the SIAT NIT', async () => {
    const view = await build({ stored: COMPLETE }).service.get(NOW);

    expect(view.nit).toBe('1023456789012');
  });

  it('shows the environment from SIAT_ENV', async () => {
    expect((await build().service.get(NOW)).environment).toBe('PILOTO');
    expect(
      (await build({ config: { environment: 'production' } }).service.get(NOW))
        .environment,
    ).toBe('PRODUCCION');
  });

  it('defaults to modality 2 and reports what is missing to enable invoicing', async () => {
    const view = await build().service.get(NOW);

    expect(view.modality).toBe(2);
    expect(view.enabled).toBe(false);
    expect(view.readiness).toEqual({
      ready: false,
      missing: [
        'nit',
        'systemCode',
        'razonSocial',
        'municipio',
        'defaultActivity',
        'token',
      ],
    });
  });

  it('reports the pilot-only environment token as a fallback', async () => {
    const view = await build({ config: { token: 'env-tok' } }).service.get(NOW);

    expect(view.token).toMatchObject({
      configured: true,
      source: 'environment',
    });
  });

  it('treats the token as valid through its expiry date, in Bolivia time', async () => {
    const lastDay = await build({
      stored: { ...COMPLETE, SIAT_TOKEN_EXPIRES_AT: '2026-11-15' },
      tokenInSettings: true,
    }).service.get(NOW);
    const dayAfter = await build({
      stored: { ...COMPLETE, SIAT_TOKEN_EXPIRES_AT: '2026-11-14' },
      tokenInSettings: true,
    }).service.get(NOW);

    expect(lastDay.token).toMatchObject({ expired: false, daysUntilExpiry: 0 });
    expect(dayAfter.token).toMatchObject({
      expired: true,
      daysUntilExpiry: -1,
    });
    expect(dayAfter.readiness.missing).toEqual(['tokenExpired']);
  });

  it('uses the La Paz calendar date, not UTC', () => {
    // 02:00 UTC on the 16th is still the 15th in La Paz.
    expect(boliviaDate(new Date('2026-11-16T02:00:00Z'))).toBe('2026-11-15');
  });
});

describe('SiatSettingsService.update', () => {
  it('maps fields to keys and writes them in the siat group', async () => {
    const { service, settings } = build();

    await service.update(
      {
        systemCode: ' ABC123 ',
        razonSocial: 'FARMACIA S.R.L.',
        emailInvoices: true,
      },
      metadata,
      NOW,
    );

    expect(settings.writeValues).toHaveBeenCalledWith(
      {
        SIAT_SYSTEM_CODE: 'ABC123',
        SIAT_RAZON_SOCIAL: 'FARMACIA S.R.L.',
        SIAT_EMAIL_INVOICES: true,
      },
      metadata,
      'siat',
    );
  });

  it('keeps the stored token when the token field is empty', async () => {
    const { service, settings } = build();

    await service.update({ token: '', municipio: 'La Paz' }, metadata, NOW);

    expect(settings.writeValues.mock.calls[0][0]).toEqual({
      SIAT_MUNICIPIO: 'La Paz',
    });
  });

  it('requires an expiry date with a new token', async () => {
    const { service, settings } = build();

    await expect(
      service.update({ token: 'tok-NEW' }, metadata, NOW),
    ).rejects.toMatchObject({
      response: { code: 'SIAT_TOKEN_EXPIRY_REQUIRED' },
    });
    expect(settings.writeValues).not.toHaveBeenCalled();
  });

  it('saves a new token with its expiry date', async () => {
    const { service, settings } = build();

    await service.update(
      { token: 'tok-NEW', tokenExpiresAt: '2027-11-15' },
      metadata,
      NOW,
    );

    expect(settings.writeValues.mock.calls[0][0]).toEqual({
      SIAT_TOKEN: 'tok-NEW',
      SIAT_TOKEN_EXPIRES_AT: '2027-11-15',
    });
  });

  it('refuses to enable invoicing until the settings are complete', async () => {
    const { service, settings } = build({
      stored: { PHARMACY_NIT: '1023456789012' },
    });

    await expect(
      service.update({ enabled: true }, metadata, NOW),
    ).rejects.toMatchObject({
      response: {
        code: 'SIAT_NOT_READY',
        missing: [
          'systemCode',
          'razonSocial',
          'municipio',
          'defaultActivity',
          'token',
        ],
      },
    });
    expect(settings.writeValues).not.toHaveBeenCalled();
  });

  it('refuses to enable invoicing with an expired token', async () => {
    const { service } = build({
      stored: { ...COMPLETE, SIAT_TOKEN_EXPIRES_AT: '2026-11-01' },
      tokenInSettings: true,
    });

    await expect(
      service.update({ enabled: true }, metadata, NOW),
    ).rejects.toMatchObject({ response: { missing: ['tokenExpired'] } });
  });

  it('enables invoicing when everything is set, counting a token saved in the same request', async () => {
    const { service, settings } = build({ stored: COMPLETE });

    await service.update(
      { enabled: true, token: 'tok-NEW', tokenExpiresAt: '2027-11-15' },
      metadata,
      NOW,
    );

    expect(settings.writeValues).toHaveBeenCalledTimes(1);
  });

  it('blocks clearing a required field while invoicing is enabled', async () => {
    const { service } = build({
      stored: { ...COMPLETE, SIAT_ENABLED: true },
      tokenInSettings: true,
    });

    await expect(
      service.update({ razonSocial: '' }, metadata, NOW),
    ).rejects.toMatchObject({ response: { missing: ['razonSocial'] } });
  });

  it('rejects an empty request', async () => {
    await expect(build().service.update({}, metadata, NOW)).rejects.toThrow(
      'No hay cambios',
    );
  });
});

describe('SiatSettingsService.testConnection', () => {
  it('reports the environment, the connection check and the stored CUIS', async () => {
    const { service, cuisReader } = build();
    cuisReader.find.mockResolvedValueOnce({
      codigoSucursal: 0,
      codigoPuntoVenta: 0,
      activeCuis: {
        validUntil: new Date('2027-11-01T00:00:00Z'),
        requestedAt: new Date('2026-11-01T00:00:00Z'),
      },
    });

    const result = await service.testConnection(NOW);

    expect(cuisReader.find).toHaveBeenCalledWith(0, 0);
    expect(result).toMatchObject({
      environment: 'PILOTO',
      connection: { status: 'ok' },
      cuis: { status: 'active', validUntil: new Date('2027-11-01T00:00:00Z') },
    });
  });

  it.each([
    [null, 'no-point-of-sale'],
    [{ codigoSucursal: 0, codigoPuntoVenta: 0, activeCuis: null }, 'missing'],
    [
      {
        codigoSucursal: 0,
        codigoPuntoVenta: 0,
        activeCuis: {
          validUntil: new Date('2026-11-01T00:00:00Z'),
          requestedAt: new Date('2025-11-01T00:00:00Z'),
        },
      },
      'expired',
    ],
  ] as const)('reports a stored CUIS of %j as %s', async (stored, status) => {
    const { service, cuisReader } = build();
    cuisReader.find.mockResolvedValueOnce(stored);

    expect((await service.testConnection(NOW)).cuis.status).toBe(status);
  });
});
