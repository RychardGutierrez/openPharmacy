/**
 * Time source for SIAT code lifecycles (CUIS, later CUFD). Injected so renewal rules can be
 * tested with a fake clock. SIAT-07 can swap it for one corrected by the SIAT time offset.
 */
export interface SiatClock {
  now(): Date;
}

export const SIAT_CLOCK = Symbol('SIAT_CLOCK');

export const systemSiatClock: SiatClock = { now: () => new Date() };

/** A clock that returns a settable instant, for tests. */
export function fixedSiatClock(
  start: Date,
): SiatClock & { set(at: Date): void } {
  let current = new Date(start);
  return {
    now: () => new Date(current),
    set: (at: Date) => {
      current = new Date(at);
    },
  };
}
