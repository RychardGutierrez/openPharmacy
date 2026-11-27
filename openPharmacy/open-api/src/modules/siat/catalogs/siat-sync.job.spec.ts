import { latestCatalogSyncDue } from './siat-sync.job';

const minuteOfDay = 60; // 01:00 Bolivia

describe('latestCatalogSyncDue', () => {
  it('is today 01:00 Bolivia (05:00 UTC) once that time has passed', () => {
    expect(
      latestCatalogSyncDue(
        new Date('2026-11-26T06:30:00Z'),
        minuteOfDay,
      ).toISOString(),
    ).toBe('2026-11-26T05:00:00.000Z');
  });

  it('is yesterday 01:00 Bolivia before today’s time', () => {
    expect(
      latestCatalogSyncDue(
        new Date('2026-11-26T04:30:00Z'),
        minuteOfDay,
      ).toISOString(),
    ).toBe('2026-11-25T05:00:00.000Z');
  });

  it('uses the Bolivia calendar day, not the UTC day, near midnight', () => {
    // 23:30 on 25 Nov in Bolivia is 03:30 UTC on 26 Nov.
    expect(
      latestCatalogSyncDue(
        new Date('2026-11-26T03:30:00Z'),
        minuteOfDay,
      ).toISOString(),
    ).toBe('2026-11-25T05:00:00.000Z');
  });
});
