import { describe, expect, it } from 'vitest';
import { isDailyIngestTime } from '../src/app';

describe('Täglicher Startschuss des Workers', () => {
  it('startet um 12 Uhr deutscher Zeit, im Winter um 11 Uhr UTC, im Sommer um 10 Uhr UTC', () => {
    expect(isDailyIngestTime(Date.parse('2026-11-25T11:00:00Z'))).toBe(true);
    expect(isDailyIngestTime(Date.parse('2026-11-25T10:00:00Z'))).toBe(false);
    expect(isDailyIngestTime(Date.parse('2027-07-01T10:00:00Z'))).toBe(true);
    expect(isDailyIngestTime(Date.parse('2027-07-01T11:00:00Z'))).toBe(false);
  });
});
