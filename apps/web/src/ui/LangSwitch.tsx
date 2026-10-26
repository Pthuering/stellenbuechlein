// Sprachwahl: Deutsch, English, Srpski. Jede Sprache steht in sich selbst, damit man sie immer findet.

import { LANG_NAMES, LANG_TAGS, LANGS, setLang, texts, useLang, type Lang } from '../i18n';

const t = texts({
  de: { label: 'Sprache' },
  en: { label: 'Language' },
  sr: { label: 'Jezik' },
});

const CODES: Record<Lang, string> = { de: 'DE', en: 'EN', sr: 'SR' };

/** Kurzwahl oben im rosa Rand, auf jeder Seite der App. */
export function LangMargin() {
  const current = useLang();
  return (
    <div className="lang-margin" role="group" aria-label={t.label}>
      {LANGS.map((l) => (
        <button key={l} type="button" lang={LANG_TAGS[l]} title={LANG_NAMES[l]} aria-label={LANG_NAMES[l]} aria-pressed={current === l} onClick={() => setLang(l)}>
          {CODES[l]}
        </button>
      ))}
    </div>
  );
}

export function LangSwitch({ style }: { style?: React.CSSProperties }) {
  const current = useLang();
  return (
    <div className="segmented" role="group" aria-label={t.label} style={style}>
      {LANGS.map((l) => (
        <button key={l} type="button" lang={l === 'sr' ? 'sr-Latn' : l} aria-pressed={current === l} onClick={() => setLang(l)}>
          {LANG_NAMES[l]}
        </button>
      ))}
    </div>
  );
}
