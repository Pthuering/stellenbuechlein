// Sprachwahl: Deutsch, English, Srpski. Jede Sprache steht in sich selbst, damit man sie immer findet.

import { LANG_NAMES, LANGS, setLang, texts, useLang } from '../i18n';

const t = texts({
  de: { label: 'Sprache' },
  en: { label: 'Language' },
  sr: { label: 'Jezik' },
});

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
