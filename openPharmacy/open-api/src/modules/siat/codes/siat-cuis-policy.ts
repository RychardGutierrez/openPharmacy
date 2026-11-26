const DAY_MS = 86_400_000;

/**
 * Where a stored CUIS stands.
 *  - `valid`: nothing to do.
 *  - `alert`: inside the alert window (default 15 days). Warn, do not request yet: SIAT would
 *    answer "CUIS vigente" and return the same code.
 *  - `renew`: inside the renewal window (default 5 days, the annex limit). Request a new one.
 *  - `expired`: no longer usable. Request a new one before issuing anything.
 *  - `missing`: no active CUIS stored.
 */
export type SiatCuisState = 'valid' | 'alert' | 'renew' | 'expired' | 'missing';

export interface SiatCuisWindows {
  cuisRenewDays: number;
  cuisAlertDays: number;
}

export function cuisState(
  validUntil: Date | null | undefined,
  now: Date,
  windows: SiatCuisWindows,
): SiatCuisState {
  if (!validUntil) return 'missing';
  const left = validUntil.getTime() - now.getTime();
  if (left <= 0) return 'expired';
  if (left <= windows.cuisRenewDays * DAY_MS) return 'renew';
  if (left <= windows.cuisAlertDays * DAY_MS) return 'alert';
  return 'valid';
}

/** True when the state means SIAT must be asked for a CUIS. */
export function cuisNeedsRequest(state: SiatCuisState): boolean {
  return state === 'missing' || state === 'expired' || state === 'renew';
}

/** True when a CUIS in this state can still be used to operate. */
export function cuisUsable(state: SiatCuisState): boolean {
  return state === 'valid' || state === 'alert' || state === 'renew';
}

/** Whole days left (rounded down), negative once expired. Null without a CUIS. */
export function cuisDaysLeft(
  validUntil: Date | null | undefined,
  now: Date,
): number | null {
  if (!validUntil) return null;
  return Math.floor((validUntil.getTime() - now.getTime()) / DAY_MS);
}
