// Kleine Absichten zwischen Seiten, z. B. „öffne den Probelauf für diese Adresse“ aus einer Anzeige heraus.
// Lebt nur im Speicher, solange die App offen ist.

type IntentKey = 'checkUrl' | 'editBridge' | 'kiAnzeige' | 'kiThema';

const intents = new Map<IntentKey, string>();

export function setIntent(key: IntentKey, value: string): void {
  intents.set(key, value);
}

/** Liest eine Absicht und vergisst sie gleich wieder. */
export function takeIntent(key: IntentKey): string | null {
  const v = intents.get(key) ?? null;
  intents.delete(key);
  return v;
}
