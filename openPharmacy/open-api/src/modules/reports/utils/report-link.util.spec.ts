import {
  createSignedDownloadToken,
  verifySignedDownloadToken,
} from './report-link.util';

const SECRET = 'test-download-secret';
const JOB_ID = '2f1c9a34-7b6d-4e2a-9c1f-0a5d3e8b7c61';

describe('report-link.util', () => {
  it('round-trips a token back to its job id', () => {
    const token = createSignedDownloadToken(JOB_ID, SECRET, 60_000);
    const verified = verifySignedDownloadToken(token, SECRET);
    expect(verified).not.toBeNull();
    expect(verified!.jobId).toBe(JOB_ID);
    expect(verified!.expiresAtMs).toBeGreaterThan(Date.now());
  });

  it('is URL-path safe (no slashes or padding)', () => {
    const token = createSignedDownloadToken(JOB_ID, SECRET, 60_000);
    expect(token).toMatch(/^[A-Za-z0-9_\-.]+$/);
  });

  it('rejects a token signed with a different secret', () => {
    const token = createSignedDownloadToken(JOB_ID, SECRET, 60_000);
    expect(verifySignedDownloadToken(token, 'other-secret')).toBeNull();
  });

  it('rejects a tampered job id', () => {
    const token = createSignedDownloadToken(JOB_ID, SECRET, 60_000);
    const forged = token.replace(
      JOB_ID,
      '00000000-0000-4000-8000-000000000000',
    );
    expect(verifySignedDownloadToken(forged, SECRET)).toBeNull();
  });

  it('rejects an expired token', () => {
    const token = createSignedDownloadToken(JOB_ID, SECRET, 1); // 1ms TTL
    const future = Date.now() + 10_000;
    expect(verifySignedDownloadToken(token, SECRET, future)).toBeNull();
  });

  it('rejects malformed tokens', () => {
    expect(verifySignedDownloadToken('', SECRET)).toBeNull();
    expect(verifySignedDownloadToken('a.b', SECRET)).toBeNull();
    expect(verifySignedDownloadToken('a.b.c.d', SECRET)).toBeNull();
    // valid structure but non-uuid id
    expect(
      verifySignedDownloadToken('not-a-uuid.9999999999999.xyz', SECRET),
    ).toBeNull();
  });
});
