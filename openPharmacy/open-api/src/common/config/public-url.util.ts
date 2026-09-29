/**
 * Helpers for turning the configured base URL into safe, absolute links that
 * appear inside emails (welcome / password reset / report downloads).
 *
 * The whole reason these exist: an emailed link is opened on the *recipient's*
 * machine, so a `localhost`/`127.0.0.1` base would point at their own computer
 * and break. We normalize formatting here and let config fail fast in
 * production (see `configuration.ts`) rather than silently shipping localhost.
 */

const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '0.0.0.1',
  '::1',
  '[::1]',
]);

/** Returns `url` trimmed with no trailing slash, or `fallback` when blank. */
export function normalizeBaseUrl(
  url: string | undefined | null,
  fallback: string,
): string {
  const raw = (url ?? '').trim() || fallback;
  return raw.replace(/\/+$/, '');
}

/** True when the URL points at the local machine and would break for a remote recipient. */
export function isLocalUrl(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}
