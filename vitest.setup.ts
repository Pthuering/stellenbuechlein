// Feste Testuhr: Für alle Tests ist „heute“ der 26.10.2026.
//
// Die Testdaten enthalten feste Bewerbungsfristen (November 2026 bis Juli 2027). Mit der echten Uhr laufen sie
// nach und nach ab, und Tests werden rot, obwohl sich am Code nichts geändert hat. Die Uhr läuft normal weiter,
// nur versetzt: Wartezeiten, Zeitbudgets und Zeitstempel verhalten sich wie sonst.

const START = Date.parse('2026-10-26T10:00:00Z');
const RealDate = Date;
const offset = START - RealDate.now();

class TestDate extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length === 0) super(RealDate.now() + offset);
    else super(...(args as ConstructorParameters<DateConstructor>));
  }

  static override now(): number {
    return RealDate.now() + offset;
  }

  /** Auch Datumswerte, die noch mit der echten Klasse entstanden sind, gelten als Date. */
  static [Symbol.hasInstance](value: unknown): boolean {
    return value instanceof RealDate;
  }
}

globalThis.Date = TestDate as unknown as DateConstructor;
