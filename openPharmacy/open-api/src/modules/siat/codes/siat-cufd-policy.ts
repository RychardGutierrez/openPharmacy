const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
/** Bolivia is UTC-4 all year (no daylight saving time). */
const BOLIVIA_OFFSET_MS = -4 * 60 * MINUTE_MS;

/**
 * Where the latest CUFD of a point of sale stands (SIAT-06). In priority order:
 *  - `missing`: no CUFD was ever stored.
 *  - `expired`: the latest CUFD is no longer valid. Nothing can be issued until a new one arrives.
 *  - `stale`: valid, but requested with a CUIS that was replaced since. Renew; keep it if SIAT fails.
 *  - `rotate`: valid, but requested before today's rotation time (default 00:05 Bolivia time).
 *  - `renew`: valid, but fewer than `cufdRenewBeforeMinutes` are left (safety net).
 *  - `valid`: nothing to do.
 *
 * A CUFD lasts 24 h, so with the defaults the safety net renews at about 23:05 and the rotation
 * again at 00:05. Both are kept on purpose: the safety net guarantees an overlap (never a gap at
 * rotation time), and the rotation keeps one CUFD per Bolivian calendar day.
 */
export type SiatCufdState =
  | 'valid'
  | 'renew'
  | 'rotate'
  | 'stale'
  | 'expired'
  | 'missing';

export interface SiatCufdWindows {
  cufdRotateMinute: number;
  cufdRenewBeforeMinutes: number;
}

/** The fields of a stored CUFD that decide its state. */
export interface SiatCufdTimes {
  valid_from: Date;
  valid_until: Date;
  cuis_id: string | null;
}

export function cufdState(
  latest: SiatCufdTimes | null | undefined,
  activeCuisId: string | null | undefined,
  now: Date,
  windows: SiatCufdWindows,
): SiatCufdState {
  if (!latest) return 'missing';
  const left = latest.valid_until.getTime() - now.getTime();
  if (left <= 0) return 'expired';
  if (activeCuisId && latest.cuis_id && latest.cuis_id !== activeCuisId) {
    return 'stale';
  }
  if (latest.valid_from.getTime() < lastRotation(now, windows).getTime()) {
    return 'rotate';
  }
  if (left < windows.cufdRenewBeforeMinutes * MINUTE_MS) return 'renew';
  return 'valid';
}

/** True when SIAT must be asked for a CUFD. */
export function cufdNeedsRequest(state: SiatCufdState): boolean {
  return state !== 'valid';
}

/** True when the stored CUFD can still be used to issue invoices. */
export function cufdUsable(state: SiatCufdState): boolean {
  return (
    state === 'valid' ||
    state === 'renew' ||
    state === 'rotate' ||
    state === 'stale'
  );
}

/** The latest rotation instant at or before `now` (today's or yesterday's, in Bolivia time). */
export function lastRotation(
  now: Date,
  windows: Pick<SiatCufdWindows, 'cufdRotateMinute'>,
): Date {
  const local = now.getTime() + BOLIVIA_OFFSET_MS;
  let rotation =
    Math.floor(local / DAY_MS) * DAY_MS + windows.cufdRotateMinute * MINUTE_MS;
  if (rotation > local) rotation -= DAY_MS;
  return new Date(rotation - BOLIVIA_OFFSET_MS);
}

/** Whole minutes left (rounded down), negative once expired. Null without a CUFD. */
export function cufdMinutesLeft(
  validUntil: Date | null | undefined,
  now: Date,
): number | null {
  if (!validUntil) return null;
  return Math.floor((validUntil.getTime() - now.getTime()) / MINUTE_MS);
}

/** Exponential backoff after `failures` consecutive failures: 1 min, 2, 4, ... capped at `maxMs`. */
export function cufdRetryDelayMs(failures: number, maxMs: number): number {
  const exponent = Math.max(0, failures - 1);
  return Math.min(MINUTE_MS * 2 ** Math.min(exponent, 20), maxMs);
}
