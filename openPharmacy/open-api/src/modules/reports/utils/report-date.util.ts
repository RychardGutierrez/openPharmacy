import { stripInvisible } from '../../../common/util/invisible-chars';
import { ReportFilters, ResolvedDateRange } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Offset (ms east of UTC) for `timeZone` at the given instant. Uses
 * `Intl.DateTimeFormat` so no external timezone database dependency is needed.
 */
function tzOffsetMs(timeZone: string, instantMs: number): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(new Date(instantMs));
  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - instantMs;
}

/**
 * Strips invisible formatting characters (soft hyphen, zero-width space/joiner,
 * word-joiner, BOM) that sneak in when a timezone is copy-pasted from docs or
 * chat, then trims. An IANA id never legitimately contains these, so removing
 * them prevents a cryptic "Invalid IANA timezone" error from an invisible byte.
 */
export function sanitizeIanaTimezone(timeZone: string): string {
  return stripInvisible(timeZone);
}

/**
 * Validates that `timeZone` is a real IANA identifier, returning the sanitized
 * value. Throws for anything else (including ids with a stray space, which
 * formatting chars cannot fix).
 */
export function assertValidTimezone(timeZone: string): string {
  const clean = sanitizeIanaTimezone(timeZone);
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: clean });
  } catch {
    throw new Error(`Invalid IANA timezone: "${clean}"`);
  }
  return clean;
}

/**
 * Convert a wall-clock date/time in `timeZone` to a UTC instant (ms). Runs a
 * two-pass offset resolution so DST boundaries land on the correct UTC hour.
 */
function zonedToUtcMs(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  let utc = guess - tzOffsetMs(timeZone, guess);
  utc = guess - tzOffsetMs(timeZone, utc);
  return utc;
}

function parseCalendarDate(value: string): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.slice(0, 10));
  if (!match) {
    throw new Error(`Expected a YYYY-MM-DD date but received "${value}"`);
  }
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function defaultCalendarDate(offsetDays: number, timeZone: string): string {
  const target = new Date(Date.now() + offsetDays * DAY_MS);
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return dtf.format(target);
}

/**
 * Turn inclusive local calendar dates into a half-open UTC range so a report
 * that spans a full year never double-counts or drops the boundary day, and so
 * DST transitions do not shift the window by an hour.
 */
export function resolveDateRange(
  filters: ReportFilters,
  timeZone: string,
  maxRangeDays: number,
): ResolvedDateRange {
  const tz = assertValidTimezone(timeZone);

  const fromStr = filters.from ?? defaultCalendarDate(-29, tz);
  const toStr = filters.to ?? defaultCalendarDate(0, tz);
  const from = parseCalendarDate(fromStr);
  const to = parseCalendarDate(toStr);

  const startUtc = new Date(zonedToUtcMs(tz, from.y, from.m, from.d));
  const endUtc = new Date(zonedToUtcMs(tz, to.y, to.m, to.d) + DAY_MS);

  if (endUtc.getTime() <= startUtc.getTime()) {
    throw new Error('The "to" date must be on or after the "from" date');
  }

  const spanDays = Math.round((endUtc.getTime() - startUtc.getTime()) / DAY_MS);
  if (spanDays > maxRangeDays) {
    throw new Error(
      `Report range of ${spanDays} days exceeds the maximum of ${maxRangeDays} days`,
    );
  }

  return { startUtc, endUtc, timezone: tz };
}

/** Formats a UTC instant as a `YYYY-MM-DD HH:mm` string in the report timezone. */
export function formatInZone(instant: Date, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return dtf.format(instant).replace(',', '');
}

/** Formats a UTC instant as a `YYYY-MM-DD` date string in the report timezone. */
export function formatDateInZone(instant: Date, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return dtf.format(instant);
}
