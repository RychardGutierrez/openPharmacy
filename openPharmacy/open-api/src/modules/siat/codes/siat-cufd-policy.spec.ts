import {
  cufdMinutesLeft,
  cufdNeedsRequest,
  cufdRetryDelayMs,
  cufdState,
  cufdUsable,
  lastRotation,
} from './siat-cufd-policy';

const MIN = 60_000;
const windows = { cufdRotateMinute: 5, cufdRenewBeforeMinutes: 60 };
/** Bolivia (UTC-4) wall-clock time as an instant. */
const bo = (iso: string) => new Date(`${iso}-04:00`);

describe('lastRotation (00:05 Bolivia time)', () => {
  it('is today 00:05 once that time has passed', () => {
    expect(lastRotation(bo('2026-11-20T10:00:00'), windows)).toEqual(
      bo('2026-11-20T00:05:00'),
    );
  });

  it('is yesterday 00:05 before that time, also when the UTC date already changed', () => {
    // 23:30 in Bolivia is 03:30 UTC of the next day.
    expect(lastRotation(bo('2026-11-20T23:30:00'), windows)).toEqual(
      bo('2026-11-20T00:05:00'),
    );
    expect(lastRotation(bo('2026-11-21T00:04:59'), windows)).toEqual(
      bo('2026-11-20T00:05:00'),
    );
    expect(lastRotation(bo('2026-11-21T00:05:00'), windows)).toEqual(
      bo('2026-11-21T00:05:00'),
    );
  });
});

describe('cufdState', () => {
  const now = bo('2026-11-20T12:00:00');
  const cufd = (from: string, until: string, cuis: string | null = 'c1') => ({
    valid_from: bo(from),
    valid_until: bo(until),
    cuis_id: cuis,
  });

  it('missing and expired', () => {
    expect(cufdState(null, 'c1', now, windows)).toBe('missing');
    expect(
      cufdState(
        cufd('2026-11-19T00:05:00', '2026-11-20T00:05:00'),
        'c1',
        now,
        windows,
      ),
    ).toBe('expired');
  });

  it('stale when requested with a CUIS that is no longer the active one', () => {
    expect(
      cufdState(
        cufd('2026-11-20T00:05:00', '2026-11-21T00:05:00', 'old'),
        'new',
        now,
        windows,
      ),
    ).toBe('stale');
  });

  it('rotate when requested before today 00:05', () => {
    expect(
      cufdState(
        cufd('2026-11-19T23:06:00', '2026-11-20T23:06:00'),
        'c1',
        now,
        windows,
      ),
    ).toBe('rotate');
  });

  it('renew when fewer than 60 minutes are left', () => {
    expect(
      cufdState(
        cufd('2026-11-20T00:05:00', '2026-11-20T12:59:00'),
        'c1',
        now,
        windows,
      ),
    ).toBe('renew');
  });

  it('valid otherwise; a CUFD without cuis_id is never stale', () => {
    expect(
      cufdState(
        cufd('2026-11-20T00:05:00', '2026-11-21T00:05:00', null),
        'c1',
        now,
        windows,
      ),
    ).toBe('valid');
  });

  it('usable states keep issuing; only valid needs no request', () => {
    expect(
      ['valid', 'renew', 'rotate', 'stale'].every((s) =>
        cufdUsable(s as never),
      ),
    ).toBe(true);
    expect(cufdUsable('expired')).toBe(false);
    expect(cufdUsable('missing')).toBe(false);
    expect(cufdNeedsRequest('valid')).toBe(false);
    expect(cufdNeedsRequest('rotate')).toBe(true);
  });
});

describe('helpers', () => {
  it('minutes left rounds down, null without a CUFD', () => {
    const now = new Date('2026-11-20T12:00:00Z');
    expect(cufdMinutesLeft(new Date(now.getTime() + 90.5 * MIN), now)).toBe(90);
    expect(cufdMinutesLeft(null, now)).toBeNull();
  });

  it('backoff doubles from 1 minute and stops at the cap', () => {
    const cap = 15 * MIN;
    expect([1, 2, 3, 4, 5, 6, 50].map((n) => cufdRetryDelayMs(n, cap))).toEqual(
      [1, 2, 4, 8, 15, 15, 15].map((m) => m * MIN),
    );
  });
});
