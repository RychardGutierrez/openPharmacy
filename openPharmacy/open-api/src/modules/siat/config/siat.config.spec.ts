import { validationSchema } from '../../../common/config/validation.schema';
import { codigoAmbiente, readSiatConfig } from './siat.config';

describe('readSiatConfig', () => {
  it('defaults to the pilot host with safe timeouts and no token', () => {
    const config = readSiatConfig({});

    expect(config).toMatchObject({
      environment: 'pilot',
      baseUrl: 'https://pilotosiatservicios.impuestos.gob.bo/v2',
      token: '',
      connectTimeoutMs: 5000,
      totalTimeoutMs: 20000,
      readRetries: 2,
      retryBaseMs: 500,
      cuisRenewDays: 5,
      cuisAlertDays: 15,
      cufdRotateMinute: 5,
      cufdRenewBeforeMinutes: 60,
      cufdSweepMs: 60000,
      cufdRetryMaxMs: 900000,
    });
  });

  it('reads the CUFD rotation time as HH:mm and rejects anything else (SIAT-06)', () => {
    expect(
      readSiatConfig({ SIAT_CUFD_ROTATE_AT: '23:30' }).cufdRotateMinute,
    ).toBe(23 * 60 + 30);
    expect(() => readSiatConfig({ SIAT_CUFD_ROTATE_AT: '24:00' })).toThrow(
      'HH:mm',
    );
    expect(
      validationSchema.validate({ SIAT_CUFD_ROTATE_AT: '7:5' }).error,
    ).toBeDefined();
  });

  it('requires the production base URL when SIAT_ENV=production', () => {
    expect(() => readSiatConfig({ SIAT_ENV: 'production' })).toThrow(
      'SIAT_PRODUCTION_BASE_URL is required',
    );
  });

  it('uses the production base URL and strips trailing slashes', () => {
    const config = readSiatConfig({
      SIAT_ENV: 'production',
      SIAT_PRODUCTION_BASE_URL: 'https://prod.example.test/v2///',
    });

    expect(config.environment).toBe('production');
    expect(config.baseUrl).toBe('https://prod.example.test/v2');
  });

  it('refuses an environment token in production', () => {
    expect(() =>
      readSiatConfig({
        SIAT_ENV: 'production',
        SIAT_PRODUCTION_BASE_URL: 'https://prod.example.test/v2',
        SIAT_TOKEN: 'tok',
      }),
    ).toThrow('SIAT_TOKEN must be empty when SIAT_ENV=production');
  });

  it('rejects an unknown environment name', () => {
    expect(() => readSiatConfig({ SIAT_ENV: 'staging' })).toThrow(
      'SIAT_ENV must be "pilot" or "production"',
    );
  });

  it('rejects a non-numeric timeout', () => {
    expect(() => readSiatConfig({ SIAT_TOTAL_TIMEOUT_MS: 'soon' })).toThrow(
      'Expected a non-negative number',
    );
  });

  it('maps the environment to codigoAmbiente (1 = production, 2 = pruebas y piloto)', () => {
    expect(codigoAmbiente({ environment: 'pilot' })).toBe(2);
    expect(codigoAmbiente({ environment: 'production' })).toBe(1);
  });
});

describe('SIAT keys in the startup validation schema', () => {
  const base = {
    COOKIE_SECRET: 'cookie-secret-value',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
  };

  const siatPaths = (env: Record<string, string>) =>
    (
      validationSchema.validate({ ...base, ...env }, { allowUnknown: true })
        .error?.details ?? []
    )
      .map((d) => d.path.join('.'))
      .filter((p) => p.startsWith('SIAT_'));

  it('accepts the pilot defaults', () => {
    expect(siatPaths({})).toEqual([]);
  });

  it('requires SIAT_PRODUCTION_BASE_URL when SIAT_ENV=production', () => {
    expect(siatPaths({ SIAT_ENV: 'production' })).toEqual([
      'SIAT_PRODUCTION_BASE_URL',
    ]);
  });

  it('accepts production with a URL', () => {
    expect(
      siatPaths({
        SIAT_ENV: 'production',
        SIAT_PRODUCTION_BASE_URL: 'https://prod.example.test/v2',
      }),
    ).toEqual([]);
  });

  it('rejects SIAT_TOKEN in production (the token lives in Settings)', () => {
    expect(
      siatPaths({
        SIAT_ENV: 'production',
        SIAT_PRODUCTION_BASE_URL: 'https://prod.example.test/v2',
        SIAT_TOKEN: 'tok',
      }),
    ).toEqual(['SIAT_TOKEN']);
  });

  it('rejects a timeout below the minimum', () => {
    expect(siatPaths({ SIAT_TOTAL_TIMEOUT_MS: '10' })).toEqual([
      'SIAT_TOTAL_TIMEOUT_MS',
    ]);
  });
});
