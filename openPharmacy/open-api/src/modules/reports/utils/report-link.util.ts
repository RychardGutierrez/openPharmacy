import { createHmac, timingSafeEqual } from 'crypto';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Purpose-scoped, stateless, time-limited download token.
 *
 * Rationale: a report download lives behind the JWT access guard, which reads
 * `Authorization: Bearer`. A clickable email link cannot carry that header, and
 * the frontend keeps its access token in memory (never a cookie a browser would
 * send on navigation), so an email must not point at the guarded route. Instead
 * we hand out a signed URL of the form `<uuid>.<expiryEpochMs>.<hmac>`. It is
 * verified without a session, bound to a single job id, and self-expires. The
 * secret is never transmitted; rotation invalidates every outstanding link.
 */
function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createSignedDownloadToken(
  jobId: string,
  secret: string,
  ttlMs: number,
): string {
  const exp = Date.now() + ttlMs;
  const payload = `${jobId}.${exp}`;
  return `${payload}.${sign(payload, secret)}`;
}

export interface VerifiedDownloadToken {
  jobId: string;
  expiresAtMs: number;
}

/**
 * Returns the embedded job id when the signature is valid, the token has not
 * expired, and the id is a UUID. Returns `null` for anything else (tampered,
 * malformed, or past expiry) so the caller can fail closed with a 404.
 */
export function verifySignedDownloadToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): VerifiedDownloadToken | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [jobId, expRaw, signature] = parts;
  const exp = Number(expRaw);

  if (!UUID_RE.test(jobId) || !Number.isFinite(exp) || !signature) return null;
  if (now > exp) return null;

  const expected = sign(`${jobId}.${expRaw}`, secret);
  const a = Buffer.from(signature, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return { jobId, expiresAtMs: exp };
}
