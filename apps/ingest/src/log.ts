// Protokoll eines Laufs – landet in der Datenbank und ist in der App unter "Quellen" einsehbar.

export class RunLog {
  readonly lines: string[] = [];
  constructor(private readonly echo = true) {}

  private add(level: string, msg: string): void {
    const line = `${new Date().toISOString().slice(11, 19)} ${level} ${msg}`;
    this.lines.push(line);
    if (this.echo) (level === 'FEHLER' ? console.error : console.log)(line);
  }

  info(msg: string): void {
    this.add('·', msg);
  }
  warn(msg: string): void {
    this.add('!', msg);
  }
  error(msg: string): void {
    this.add('FEHLER', msg);
  }
  text(): string {
    return this.lines.join('\n');
  }
}

export function errText(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
