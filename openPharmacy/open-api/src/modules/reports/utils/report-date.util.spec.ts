import {
  assertValidTimezone,
  formatDateInZone,
  formatInZone,
  resolveDateRange,
} from './report-date.util';

describe('report-date.util', () => {
  describe('resolveDateRange', () => {
    it('converts inclusive local dates to a half-open UTC range', () => {
      const range = resolveDateRange(
        { from: '2026-01-01', to: '2026-01-31' },
        'America/Bogota', // UTC-5 year-round
        366,
      );
      expect(range.startUtc.toISOString()).toBe('2026-01-01T05:00:00.000Z');
      // exclusive upper bound = (to + 1 day) local midnight
      expect(range.endUtc.toISOString()).toBe('2026-02-01T05:00:00.000Z');
      expect(range.timezone).toBe('America/Bogota');
    });

    it('applies the correct offset for a UTC+1 timezone', () => {
      const range = resolveDateRange(
        { from: '2026-06-01', to: '2026-06-01' },
        'Europe/Berlin', // CEST = UTC+2 in June
        366,
      );
      expect(range.startUtc.toISOString()).toBe('2026-05-31T22:00:00.000Z');
      expect(range.endUtc.toISOString()).toBe('2026-06-01T22:00:00.000Z');
    });

    it('rejects a to-date before the from-date', () => {
      expect(() =>
        resolveDateRange({ from: '2026-05-10', to: '2026-05-01' }, 'UTC', 366),
      ).toThrow(/on or after/);
    });

    it('rejects ranges longer than maxRangeDays', () => {
      expect(() =>
        resolveDateRange({ from: '2020-01-01', to: '2026-01-01' }, 'UTC', 366),
      ).toThrow(/exceeds the maximum/);
    });

    it('defaults to the last 30 days when no dates are provided', () => {
      const range = resolveDateRange({}, 'UTC', 366);
      const days = Math.round(
        (range.endUtc.getTime() - range.startUtc.getTime()) /
          (24 * 3600 * 1000),
      );
      expect(days).toBe(30);
    });

    it('throws for an invalid timezone', () => {
      expect(() =>
        resolveDateRange(
          { from: '2026-01-01', to: '2026-01-02' },
          'Not/AZone',
          366,
        ),
      ).toThrow(/timezone/i);
    });
  });

  describe('formatting', () => {
    const instant = new Date('2026-01-01T05:00:00.000Z');
    it('formats a date in the target timezone', () => {
      expect(formatDateInZone(instant, 'America/Bogota')).toBe('2026-01-01');
    });
    it('formats date-time in the target timezone', () => {
      expect(formatInZone(instant, 'America/Bogota')).toBe('2026-01-01 00:00');
    });
  });

  describe('assertValidTimezone', () => {
    it('accepts IANA zones and rejects garbage', () => {
      expect(() => assertValidTimezone('UTC')).not.toThrow();
      expect(() => assertValidTimezone('America/La_Paz')).not.toThrow();
      expect(() => assertValidTimezone('Mars/Olympus')).toThrow();
    });

    it('strips an invisible soft hyphen and still validates', () => {
      // "America/<U+00AD>La_Paz" — the exact copy-paste bug that previously
      // produced "Invalid IANA timezone: America/­La_Paz".
      const dirty = 'America/' + String.fromCharCode(0x00ad) + 'La_Paz';
      expect(assertValidTimezone(dirty)).toBe('America/La_Paz');
    });

    it('rejects a real space (invisible-char cleanup cannot fix it)', () => {
      const withSpace = 'America/La' + String.fromCharCode(0x20) + 'Paz';
      expect(() => assertValidTimezone(withSpace)).toThrow(
        /Invalid IANA timezone/,
      );
    });
  });

  describe('resolveDateRange + sanitization', () => {
    it('returns the sanitized timezone in the range', () => {
      const dirty = 'America/' + String.fromCharCode(0x00ad) + 'Bogota';
      const range = resolveDateRange(
        { from: '2026-01-01', to: '2026-01-31' },
        dirty,
        366,
      );
      expect(range.timezone).toBe('America/Bogota');
    });
  });
});
