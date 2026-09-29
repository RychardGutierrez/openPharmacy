import { mailerConfig, reportsConfig } from './configuration';

describe('config factories (emailed-link base URL)', () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  it('defaults the mailer frontend URL to the dev origin (3001) outside production', () => {
    delete process.env.NODE_ENV;
    delete process.env.FRONTEND_URL;
    expect(mailerConfig().mailer.frontendUrl).toBe('http://localhost:3001');
  });

  it('normalizes a configured FRONTEND_URL (trailing slash removed)', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://farmacia.example/';
    expect(mailerConfig().mailer.frontendUrl).toBe('https://farmacia.example');
  });

  it('throws in production when FRONTEND_URL points at localhost', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'http://localhost:4200';
    expect(() => mailerConfig()).toThrow(/non-localhost URL in production/i);
  });

  it('throws in production when FRONTEND_URL is missing (falls back to localhost)', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.FRONTEND_URL;
    delete process.env.REPORT_DOWNLOAD_BASE_URL;
    expect(() => mailerConfig()).toThrow(/non-localhost URL in production/i);
  });

  it('report download base falls back to FRONTEND_URL, then overrides', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.REPORT_DOWNLOAD_BASE_URL;
    process.env.FRONTEND_URL = 'https://farm.example';
    expect(reportsConfig().reports.downloadBaseUrl).toBe(
      'https://farm.example',
    );

    process.env.REPORT_DOWNLOAD_BASE_URL = 'https://dl.example/';
    expect(reportsConfig().reports.downloadBaseUrl).toBe('https://dl.example');
  });
});
