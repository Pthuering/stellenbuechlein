// Horizont: Stellen außerhalb des Kernbereichs, die über eine Brücke zu dir passen könnten.
// Brücken bearbeiten, KI-Vorschläge annehmen, Weite und Dosis im Stapel einstellen.

import { useMemo, useState } from 'react';
import {
  cleanTerms,
  horizontOf,
  isOpen,
  matchBridges,
  newItemId,
  STANDARD_ANKER,
  starterHorizont,
  todayBerlin,
  type Bruecke,
  type Horizont,
  type HorizontDosis,
} from '@stellen/core';
import { useAppState, useStore, useViews } from '../../data/hooks';
import { navigate, openJob } from '../../lib/router';
import { setIntent, takeIntent } from '../../lib/intent';
import { Sheet } from '../../ui/Sheet';
import { IconPencil, IconPlus, IconTrash } from '../../ui/icons';
import { srForm, texts } from '../../i18n';
import { profileLabel } from '../../i18n/katalog';
import { categoryLabel, dosisCards, dosisLabel, laneName } from '../../i18n/labels';
import { SubPage } from './Settings';

function parseList(raw: string, max = 40): string[] {
  return cleanTerms(raw.split(/[\n,;]+/), max);
}

const DOSEN: HorizontDosis[] = ['aus', 'selten', 'normal', 'oft'];

const t = texts({
  de: {
    origin: { start: 'Start-Brücke', steckbrief: 'aus dem Steckbrief', ki: 'KI-Vorschlag', manuell: 'selbst angelegt' } as Record<Bruecke['herkunft'], string>,
    dose: { aus: 'aus', selten: 'selten', normal: 'normal', oft: 'oft' } as Record<HorizontDosis, string>,
    ringsLabel: 'Drei Ringe: Kern in der Mitte, darum Horizont, außen Weite',
    // Brücke bearbeiten
    newBridge: 'Neue Brücke',
    editBridge: 'Brücke bearbeiten',
    needName: 'Bitte einen Namen eingeben.',
    needField: 'Bitte mindestens einen Begriff für das Feld eintragen.',
    editorHint: (
      <>
        Eine Anzeige passt, wenn sie einen Begriff aus dem <b>Feld</b> und einen aus der <b>Anknüpfung</b> enthält. Schreibweise wie im Suchprofil: Wortanfänge reichen, * passt überall im Wort.
      </>
    ),
    name: 'Name',
    namePlaceholder: 'z. B. IT-Sicherheit',
    fieldLabel: 'Feld (einer reicht, je Zeile einer)',
    linkLabel: 'Anknüpfung an dich (leer = Standard)',
    linkDefault: (examples: string, more: number) => `Standard: Begriffe für Menschen, Verhalten und empirische Arbeit, etwa ${examples} und ${more} weitere.`,
    searchLabel: 'Suchwörter für die Erkundung (optional)',
    whyLabel: 'Warum diese Brücke? (optional)',
    whyPlaceholder: 'z. B. Verhalten von Menschen ist oft die größte Sicherheitslücke',
    active: 'Brücke aktiv',
    tryLabel: 'Ausprobieren:',
    tryResult: (n: number, outside: number) => `passt auf ${n} offene Anzeige${n === 1 ? '' : 'n'}${n ? `, davon ${outside} außerhalb des Kerns` : ''}. Neue Treffer sammelt der nächste Lauf ein.`,
    via: (terms: string) => ` über ${terms}`,
    save: 'Speichern',
    cancel: 'Abbrechen',
    delete: 'Löschen',
    // Seite
    sub: 'Stellen außerhalb deines Kernbereichs',
    intro: (
      <>
        Der <b>Kern</b> sind Stellen, die deine Kernthemen aus dem Suchprofil treffen. Der <b>Horizont</b> holt Stellen aus anderen Feldern dazu, wenn eine Brücke passt: ein Feld-Begriff und eine Anknüpfung an dich. In der <b>Weite</b> prüft die KI auch Stellen ohne Brücke, ob deine Fähigkeiten dort tragen. Völlig Fremdes sortiert sie aus. Ausgeblendet wird nichts: Was hier landet, steht immer auch unter „Alle“.
      </>
    ),
    undo: 'Rückgängig',
    noneFound: 'Die KI hat gerade keine neuen Brücken gefunden.',
    inStack: 'Im Stapel',
    doseLabel: 'Wie oft eine Horizont-Karte kommt',
    doseOff: 'Horizont-Anzeigen werden nicht eingestreut, sie stehen nach Score sortiert im Stapel und unter „Alle“.',
    doseOn: (d: HorizontDosis) => `Zwischen den Kern-Karten kommt ${dosisLabel(d)} Karte aus dem Horizont, zufällig verteilt.`,
    openNow: (horizont: number, weite: number) => `Gerade offen: ${horizont} aus dem Horizont, ${weite} aus der Weite.`,
    bridges: 'Brücken',
    noBridges: 'Noch keine Brücken. Der Steckbrief aus dem Interview legt sie an, oder du fügst selbst welche hinzu.',
    activeTitle: 'aktiv',
    pausedTitle: 'pausiert',
    bridgeActive: (name: string) => `${name} aktiv`,
    editNamed: (name: string) => `${name} bearbeiten`,
    fieldList: (terms: string) => `Feld: ${terms}`,
    andMore: (n: number) => ` und ${n} weitere`,
    linkList: (terms: string) => `; Anknüpfung: ${terms}`,
    openInHorizon: (n: number) => `, ${n} offene Anzeige${n === 1 ? '' : 'n'} im Horizont`,
    pausedSuffix: ', pausiert',
    addBridge: 'Brücke hinzufügen',
    thinking: 'KI denkt nach …',
    suggest: 'Brücken vorschlagen lassen',
    discuss: 'Mit der KI besprechen',
    needKey: 'Für Vorschläge braucht der Worker einen KI-Schlüssel (siehe Betriebsanleitung).',
    suggestions: 'Vorschläge der KI',
    suggestionsHint: 'Übernommen wird nur, was du annimmst. Danach lässt sich jede Brücke bearbeiten.',
    apply: 'Übernehmen',
    noThanks: 'Nein danke',
    bridgeAdded: (name: string) => `Brücke „${name}“ übernommen.`,
    bridgeDeleted: (name: string) => `Brücke „${name}“ gelöscht.`,
    weiteToggle: 'KI prüft auch Stellen ohne Brücke',
    weiteHint: 'Nur Stellen, in denen eine deiner Fähigkeiten und ein Bezug zu Menschen oder Empirie vorkommt. Die KI sagt „passt“, „eher“ oder „nein“; „nein“ steht unter Quellen → Aussortiert.',
    skills: 'Fähigkeiten, die in andere Felder tragen',
    skillsHint: (category: string) => `Zusätzlich zählen die Begriffe aus „${category}“ im Suchprofil.`,
    interests: 'Interessen außerhalb der Psychologie',
    interestsPlaceholder: 'z. B. KI, Nachhaltigkeit, Stadtentwicklung',
    interestsHint: 'Die KI nutzt die Interessen für Brücken-Vorschläge und ihr Urteil.',
    reset: 'Auf Start-Horizont zurücksetzen',
    resetDone: 'Start-Horizont wiederhergestellt.',
  },
  en: {
    origin: { start: 'Starter bridge', steckbrief: 'from the profile sheet', ki: 'AI suggestion', manuell: 'added by you' },
    dose: { aus: 'off', selten: 'rarely', normal: 'normal', oft: 'often' },
    ringsLabel: 'Three rings: Core in the middle, Horizon around it, Beyond on the outside',
    newBridge: 'New bridge',
    editBridge: 'Edit bridge',
    needName: 'Please enter a name.',
    needField: 'Please add at least one term for the field.',
    editorHint: (
      <>
        A posting matches if it contains a term from the <b>field</b> and one from the <b>link</b>. Spelling as in the search profile: word beginnings are enough, * matches anywhere in a word.
      </>
    ),
    name: 'Name',
    namePlaceholder: 'e.g. IT security',
    fieldLabel: 'Field (one term is enough, one per line)',
    linkLabel: 'Link to you (empty = default)',
    linkDefault: (examples, more) => `Default: terms for people, behavior and empirical work, such as ${examples} and ${more} more.`,
    searchLabel: 'Search queries for exploration (optional)',
    whyLabel: 'Why this bridge? (optional)',
    whyPlaceholder: 'e.g. human behavior is often the biggest security gap',
    active: 'Bridge active',
    tryLabel: 'Test:',
    tryResult: (n, outside) => `matches ${n} open ${n === 1 ? 'posting' : 'postings'}${n ? `, ${outside} of them outside the core` : ''}. The next run collects new matches.`,
    via: (terms) => ` via ${terms}`,
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    sub: 'Jobs outside your core field',
    intro: (
      <>
        The <b>Core</b> covers jobs that match the core topics in your search profile. <b>Horizon</b> brings in jobs from other fields when a bridge fits: a field term plus a link to you. In <b>Beyond</b>, the AI also checks jobs without a bridge to see whether your skills carry over there. It filters out anything completely unrelated. Nothing gets hidden: whatever lands here always shows up under “All” too.
      </>
    ),
    undo: 'Undo',
    noneFound: 'The AI didn’t find any new bridges this time.',
    inStack: 'In the stack',
    doseLabel: 'How often a Horizon card comes up',
    doseOff: 'Horizon postings aren’t mixed in; they’re sorted by match in the stack and under “All”.',
    doseOn: (d) => `In the stack, ${dosisCards(d)} comes from Horizon, mixed in at random between core cards.`,
    openNow: (horizont, weite) => `Open right now: ${horizont} from Horizon, ${weite} from Beyond.`,
    bridges: 'Bridges',
    noBridges: 'No bridges yet. The profile sheet from the interview creates them, or you can add your own.',
    activeTitle: 'active',
    pausedTitle: 'paused',
    bridgeActive: (name) => `${name} active`,
    editNamed: (name) => `Edit ${name}`,
    fieldList: (terms) => `Field: ${terms}`,
    andMore: (n) => ` and ${n} more`,
    linkList: (terms) => `; link: ${terms}`,
    openInHorizon: (n) => `, ${n} open ${n === 1 ? 'posting' : 'postings'} in Horizon`,
    pausedSuffix: ', paused',
    addBridge: 'Add bridge',
    thinking: 'AI is thinking…',
    suggest: 'Get bridge suggestions',
    discuss: 'Discuss with the AI',
    needKey: 'For suggestions, the Worker needs an AI key (see the operating guide).',
    suggestions: 'AI suggestions',
    suggestionsHint: 'Only what you accept gets added. You can edit any bridge afterwards.',
    apply: 'Apply',
    noThanks: 'No thanks',
    bridgeAdded: (name) => `Bridge “${name}” added.`,
    bridgeDeleted: (name) => `Bridge “${name}” deleted.`,
    weiteToggle: 'AI also checks jobs without a bridge',
    weiteHint: 'Only jobs that mention one of your skills and a connection to people or empirical work. The AI says “fits”, “maybe” or “no”; “no” ends up under Sources → Filtered out.',
    skills: 'Skills that carry over to other fields',
    skillsHint: (category) => `Terms from “${category}” in your search profile count too.`,
    interests: 'Interests outside psychology',
    interestsPlaceholder: 'e.g. AI, sustainability, urban development',
    interestsHint: 'The AI uses your interests for bridge suggestions and its assessments.',
    reset: 'Reset to starter Horizon',
    resetDone: 'Starter Horizon restored.',
  },
  sr: {
    origin: { start: 'Početni most', steckbrief: 'iz ličnog kartona', ki: 'AI predlog', manuell: 'ručno dodat' },
    dose: { aus: 'isključeno', selten: 'retko', normal: 'normalno', oft: 'često' },
    ringsLabel: 'Tri prstena: Jezgro u sredini, oko njega Horizont, spolja Daljina',
    newBridge: 'Novi most',
    editBridge: 'Izmeni most',
    needName: 'Unesi naziv.',
    needField: 'Unesi bar jedan pojam za oblast.',
    editorHint: (
      <>
        Oglas se poklapa ako sadrži pojam iz <b>oblasti</b> i pojam iz <b>veze</b>. Pisanje kao u profilu pretrage: dovoljni su počeci reči, * se poklapa bilo gde u reči.
      </>
    ),
    name: 'Naziv',
    namePlaceholder: 'npr. IT bezbednost',
    fieldLabel: 'Oblast (dovoljan je jedan pojam, po jedan u redu)',
    linkLabel: 'Veza sa tobom (prazno = podrazumevano)',
    linkDefault: (examples, more) => `Podrazumevano: pojmovi za ljude, ponašanje i empirijski rad, na primer ${examples} i još ${more}.`,
    searchLabel: 'Upiti za izviđanje (opciono)',
    whyLabel: 'Zašto ovaj most? (opciono)',
    whyPlaceholder: 'npr. ljudsko ponašanje je često najveća bezbednosna rupa',
    active: 'Most aktivan',
    tryLabel: 'Proba:',
    tryResult: (n, outside) => `obuhvata ${n} ${srForm(n, 'otvoren oglas', 'otvorena oglasa', 'otvorenih oglasa')}${n ? `, od toga ${outside} van jezgra` : ''}. Nove pogotke prikuplja sledeći prolaz.`,
    via: (terms) => ` preko pojmova ${terms}`,
    save: 'Sačuvaj',
    cancel: 'Otkaži',
    delete: 'Obriši',
    sub: 'Poslovi van tvoje osnovne oblasti',
    intro: (
      <>
        <b>Jezgro</b> čine pozicije koje pogađaju tvoje osnovne teme iz profila pretrage. <b>Horizont</b> dodaje pozicije iz drugih oblasti kada neki most odgovara: pojam iz oblasti i veza sa tobom. U <b>Daljini</b> AI proverava i pozicije bez mosta, da li su tvoje veštine i tamo primenljive. Ono što je potpuno nepovezano izbacuje. Ništa se ne sakriva: sve što se ovde nađe uvek stoji i pod „Sve“.
      </>
    ),
    undo: 'Opozovi',
    noneFound: 'AI ovog puta nije pronašao nove mostove.',
    inStack: 'U špilu',
    doseLabel: 'Koliko često dolazi kartica iz Horizonta',
    doseOff: 'Oglasi iz Horizonta se ne ubacuju, nego stoje u špilu i pod „Sve“, sortirani po poklapanju.',
    doseOn: (d) => `U špilu je ${dosisCards(d)} iz Horizonta, nasumično između kartica iz jezgra.`,
    openNow: (horizont, weite) => `Trenutno otvoreno: ${horizont} iz Horizonta, ${weite} iz Daljine.`,
    bridges: 'Mostovi',
    noBridges: 'Još nema mostova. Pravi ih lični karton iz intervjua, a možeš ih dodati i ručno.',
    activeTitle: 'aktivan',
    pausedTitle: 'pauziran',
    bridgeActive: (name) => `${name} aktivan`,
    editNamed: (name) => `Izmeni „${name}“`,
    fieldList: (terms) => `Oblast: ${terms}`,
    andMore: (n) => ` i još ${n}`,
    linkList: (terms) => `; veza: ${terms}`,
    openInHorizon: (n) => `, ${n} ${srForm(n, 'otvoren oglas', 'otvorena oglasa', 'otvorenih oglasa')} u Horizontu`,
    pausedSuffix: ', pauziran',
    addBridge: 'Dodaj most',
    thinking: 'AI razmišlja…',
    suggest: 'Zatraži predloge mostova',
    discuss: 'Razgovaraj sa AI asistentom',
    needKey: 'Za predloge je Workeru potreban AI ključ (pogledaj uputstvo za rad).',
    suggestions: 'AI predlozi',
    suggestionsHint: 'Dodaje se samo ono što prihvatiš. Posle toga svaki most može da se izmeni.',
    apply: 'Primeni',
    noThanks: 'Ne, hvala',
    bridgeAdded: (name) => `Most „${name}“ je dodat.`,
    bridgeDeleted: (name) => `Most „${name}“ je obrisan.`,
    weiteToggle: 'AI proverava i pozicije bez mosta',
    weiteHint: 'Samo pozicije u kojima se pojavljuje neka tvoja veština i veza sa ljudima ili empirijom. AI kaže „odgovara“, „možda“ ili „ne“; „ne“ završava pod Izvori → Odbačeno.',
    skills: 'Veštine primenljive i u drugim oblastima',
    skillsHint: (category) => `Računaju se i pojmovi iz „${category}“ u profilu pretrage.`,
    interests: 'Interesovanja van psihologije',
    interestsPlaceholder: 'npr. AI, održivost, urbanizam',
    interestsHint: 'AI koristi interesovanja za predloge mostova i za svoje procene.',
    reset: 'Vrati početni Horizont',
    resetDone: 'Početni Horizont je vraćen.',
  },
});

/** Drei Ringe als kleine Skizze: Kern, Horizont, Weite. */
function Rings() {
  return (
    <svg className="rings" viewBox="0 0 320 140" role="img" aria-label={t.ringsLabel}>
      <ellipse cx="160" cy="70" rx="152" ry="64" fill="none" stroke="var(--secondary)" strokeWidth="1.6" strokeDasharray="5 6" />
      <ellipse cx="160" cy="72" rx="110" ry="44" fill="var(--secondary-soft)" stroke="var(--secondary-strong)" strokeWidth="1.6" />
      <ellipse cx="160" cy="76" rx="56" ry="20" fill="var(--primary-soft)" stroke="var(--primary-strong)" strokeWidth="1.8" />
      <text x="160" y="81" textAnchor="middle" className="rings__label">{laneName('kern')}</text>
      <text x="160" y="47" textAnchor="middle" className="rings__label rings__label--h">{laneName('horizont')}</text>
      <text x="160" y="20" textAnchor="middle" className="rings__label rings__label--w">{laneName('weite')}</text>
    </svg>
  );
}

function BridgeEditor({ bridge, onSave, onDelete, onClose }: { bridge: Bruecke | null; onSave: (b: Bruecke) => void; onDelete?: () => void; onClose: () => void }) {
  const views = useViews();
  const [name, setName] = useState(bridge?.name ?? '');
  const [feld, setFeld] = useState((bridge?.feld ?? []).join('\n'));
  const [anker, setAnker] = useState((bridge?.anker ?? []).join('\n'));
  const [suche, setSuche] = useState((bridge?.suche ?? []).join('\n'));
  const [warum, setWarum] = useState(bridge?.warum ?? '');
  const [aktiv, setAktiv] = useState(bridge?.aktiv ?? true);
  const [error, setError] = useState<string | null>(null);

  const draft: Bruecke = useMemo(
    () => ({
      id: bridge?.id ?? newItemId('h'),
      // nur für den Test; gespeichert wird nie ohne Namen
      name: name.trim() || t.newBridge,
      feld: parseList(feld),
      anker: parseList(anker),
      suche: parseList(suche, 8).filter((q) => q.length >= 2),
      warum: warum.trim() || null,
      aktiv,
      herkunft: bridge?.herkunft ?? 'manuell',
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [name, feld, anker, suche, warum, aktiv],
  );

  // Ausprobieren an allen offenen Anzeigen
  const test = useMemo(() => {
    if (draft.feld.length === 0) return null;
    const today = todayBerlin();
    const h: Horizont = { ...starterHorizont(), bruecken: [{ ...draft, aktiv: true }] };
    let n = 0;
    let outside = 0;
    const examples: { id: string; title: string; terms: string }[] = [];
    for (const v of views.values()) {
      if (!isOpen(v.job, today)) continue;
      const hit = matchBridges(v.norm, h)[0];
      if (!hit) continue;
      n++;
      if (v.lane.lane !== 'kern') outside++;
      if (examples.length < 4) examples.push({ id: v.job.id, title: v.job.title, terms: [...hit.feld.slice(0, 2), ...hit.anker.slice(0, 2)].join(', ') });
    }
    return { n, outside, examples };
  }, [draft, views]);

  const save = () => {
    if (!name.trim()) return setError(t.needName);
    if (draft.feld.length === 0) return setError(t.needField);
    onSave({ ...draft, name: name.trim() });
  };

  return (
    <Sheet title={bridge ? t.editBridge : t.newBridge} onClose={onClose} full>
      <p className="hint" style={{ marginTop: 0 }}>
        {t.editorHint}
      </p>
      <label className="field">
        <span>{t.name}</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} maxLength={80} />
      </label>
      <label className="field">
        <span>{t.fieldLabel}</span>
        <textarea className="input" style={{ minHeight: 100 }} value={feld} onChange={(e) => setFeld(e.target.value)} placeholder={'cybersecurity\nit sicherheit\nphishing'} spellCheck={false} />
      </label>
      <label className="field">
        <span>{t.linkLabel}</span>
        <textarea className="input" style={{ minHeight: 80 }} value={anker} onChange={(e) => setAnker(e.target.value)} placeholder={'verhalten\nnutzerstud\nbefragung'} spellCheck={false} />
      </label>
      {!parseList(anker).length && (
        <p className="hint" style={{ marginTop: -4 }}>
          {t.linkDefault(
            STANDARD_ANKER.slice(1, 9)
              .map((term) => term.replace(/^\*/, ''))
              .join(', '),
            STANDARD_ANKER.length - 9,
          )}
        </p>
      )}
      <label className="field">
        <span>{t.searchLabel}</span>
        <textarea className="input" style={{ minHeight: 64 }} value={suche} onChange={(e) => setSuche(e.target.value)} placeholder={'Usable Security\nSecurity Awareness'} />
      </label>
      <label className="field">
        <span>{t.whyLabel}</span>
        <textarea className="input" style={{ minHeight: 64 }} value={warum} onChange={(e) => setWarum(e.target.value)} placeholder={t.whyPlaceholder} maxLength={400} />
      </label>
      <label className="toggle">
        <span>{t.active}</span>
        <input type="checkbox" checked={aktiv} onChange={(e) => setAktiv(e.target.checked)} />
      </label>

      {test && (
        <div className="notice notice--info" style={{ marginTop: 14 }} aria-live="polite">
          <b>{t.tryLabel}</b> {t.tryResult(test.n, test.outside)}
          {test.examples.length > 0 && (
            <ul className="test-list">
              {test.examples.map((e) => (
                <li key={e.id}>
                  <button type="button" className="linkish" onClick={() => openJob(e.id)}>
                    {e.title}
                  </button>
                  <small>{t.via(e.terms)}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <p className="notice notice--warn" role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
        <button type="button" className="btn btn--primary" onClick={save}>
          {t.save}
        </button>
        <button type="button" className="btn" onClick={onClose}>
          {t.cancel}
        </button>
        {onDelete && (
          <button type="button" className="btn btn--quiet" onClick={onDelete}>
            <IconTrash width={18} height={18} /> {t.delete}
          </button>
        )}
      </div>
    </Sheet>
  );
}

export function HorizontPage() {
  const s = useAppState();
  const store = useStore();
  const views = useViews();
  const p = s.settings.profile;
  const h = horizontOf(p);
  const [editing, setEditing] = useState<{ bridge: Bruecke | null } | null>(() => {
    const id = takeIntent('editBridge');
    const b = id ? h.bruecken.find((x) => x.id === id) : undefined;
    return b ? { bridge: b } : null;
  });
  const [suggested, setSuggested] = useState<Bruecke[] | null>(null);
  const [asking, setAsking] = useState(false);
  // Fähigkeiten und Interessen sind eigene Einträge und bleiben, wie sie gespeichert sind
  const [skills, setSkills] = useState(h.faehigkeiten.join(', '));
  const [interests, setInterests] = useState(h.interessen.join(', '));

  const save = (next: Horizont, toast?: string) => {
    const prev = p;
    store.updateSettings('profile', {
      ...p,
      origin: p.origin === 'start' ? 'manuell' : p.origin,
      // gespeicherter Name, angezeigt über profileName()
      name: p.origin === 'start' ? 'Eigenes Profil' : p.name,
      horizont: next,
      updatedAt: new Date().toISOString(),
    });
    if (toast) store.toast(toast, { label: t.undo, run: () => store.updateSettings('profile', prev) });
  };

  const counts = useMemo(() => {
    const today = todayBerlin();
    let horizont = 0;
    let weite = 0;
    const perBridge = new Map<string, number>();
    for (const v of views.values()) {
      if (!isOpen(v.job, today)) continue;
      if (v.lane.promoted && v.lane.lane === 'horizont') horizont++;
      if (v.lane.promoted && v.lane.lane === 'weite') weite++;
      if (v.lane.lane !== 'kern' && v.lane.bridge) perBridge.set(v.lane.bridge.bridge.id, (perBridge.get(v.lane.bridge.bridge.id) ?? 0) + 1);
    }
    return { horizont, weite, perBridge };
  }, [views]);

  const ask = async () => {
    setAsking(true);
    try {
      const list = await store.api.suggestBridges(p);
      setSuggested(list);
      if (list.length === 0) store.toast(t.noneFound);
    } catch (e) {
      store.toast(e instanceof Error ? e.message : String(e));
    } finally {
      setAsking(false);
    }
  };

  return (
    <SubPage title={laneName('horizont')} sub={t.sub}>
      <Rings />
      <p className="notice">{t.intro}</p>

      <div className="group">
        <h2 className="section-title">{t.inStack}</h2>
        <div className="segmented segmented--wrap" role="group" aria-label={t.doseLabel}>
          {DOSEN.map((d) => (
            <button key={d} type="button" aria-pressed={h.dosis === d} onClick={() => save({ ...h, dosis: d })}>
              {t.dose[d]}
            </button>
          ))}
        </div>
        <p className="hint">
          {h.dosis === 'aus' ? t.doseOff : t.doseOn(h.dosis)} {t.openNow(counts.horizont, counts.weite)}
        </p>
      </div>

      <div className="group">
        <h2 className="section-title">{t.bridges}</h2>
        {h.bruecken.length === 0 && <p className="hint">{t.noBridges}</p>}
        <ul className="bridge-list">
          {h.bruecken.map((b) => {
            const name = profileLabel(b.name);
            const open = counts.perBridge.get(b.id) ?? 0;
            return (
              <li key={b.id} className={`bridge ${b.aktiv ? '' : 'bridge--off'}`}>
                <div className="bridge__head">
                  <button type="button" className="bridge__name linkish" onClick={() => setEditing({ bridge: b })}>
                    {name}
                  </button>
                  <label className="switch" title={b.aktiv ? t.activeTitle : t.pausedTitle}>
                    <span className="visually-hidden">{t.bridgeActive(name)}</span>
                    <input
                      type="checkbox"
                      checked={b.aktiv}
                      onChange={(e) => save({ ...h, bruecken: h.bruecken.map((x) => (x.id === b.id ? { ...x, aktiv: e.target.checked } : x)) })}
                    />
                  </label>
                  <button type="button" className="icon-btn" onClick={() => setEditing({ bridge: b })} aria-label={t.editNamed(name)}>
                    <IconPencil width={20} height={20} />
                  </button>
                </div>
                <p className="bridge__terms">
                  {t.fieldList(
                    b.feld
                      .slice(0, 6)
                      .map((term) => term.replace(/^\*|"/g, ''))
                      .join(', '),
                  )}
                  {b.feld.length > 6 ? t.andMore(b.feld.length - 6) : ''}
                  {b.anker.length ? t.linkList(`${b.anker.slice(0, 4).join(', ')}${b.anker.length > 4 ? ' …' : ''}`) : ''}
                </p>
                {b.warum && <p className="bridge__why">{b.warum}</p>}
                <p className="bridge__meta">
                  {t.origin[b.herkunft]}
                  {b.aktiv ? t.openInHorizon(open) : t.pausedSuffix}
                </p>
              </li>
            );
          })}
        </ul>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          <button type="button" className="btn btn--small" onClick={() => setEditing({ bridge: null })}>
            <IconPlus width={18} height={18} /> {t.addBridge}
          </button>
          <button type="button" className="btn btn--small" disabled={asking || !s.aiSuggest} onClick={() => void ask()}>
            {asking ? t.thinking : t.suggest}
          </button>
          {s.aiSuggest && !s.demo && (
            <button
              type="button"
              className="btn btn--small"
              onClick={() => {
                setIntent('kiThema', 'horizont');
                navigate('/ich/ki');
              }}
            >
              {t.discuss}
            </button>
          )}
        </div>
        {!s.aiSuggest && <p className="hint">{t.needKey}</p>}

        {suggested && suggested.length > 0 && (
          <div className="ai-note" style={{ marginTop: 14 }}>
            <b>{t.suggestions}</b>
            <p style={{ margin: '0 0 6px' }}>{t.suggestionsHint}</p>
            <ul className="bridge-list">
              {suggested.map((b) => (
                <li key={b.id} className="bridge bridge--suggested">
                  <p className="bridge__name">{b.name}</p>
                  <p className="bridge__terms">{t.fieldList(b.feld.slice(0, 6).join(', '))}</p>
                  {b.warum && <p className="bridge__why">{b.warum}</p>}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                    <button
                      type="button"
                      className="btn btn--small btn--primary"
                      onClick={() => {
                        save({ ...h, bruecken: [...h.bruecken, b] }, t.bridgeAdded(b.name));
                        setSuggested(suggested.filter((x) => x.id !== b.id));
                      }}
                    >
                      {t.apply}
                    </button>
                    <button type="button" className="btn btn--small btn--quiet" onClick={() => setSuggested(suggested.filter((x) => x.id !== b.id))}>
                      {t.noThanks}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="group">
        <h2 className="section-title">{laneName('weite')}</h2>
        <label className="toggle">
          <span>
            {t.weiteToggle}
            <br />
            <small className="hint">{t.weiteHint}</small>
          </span>
          <input type="checkbox" checked={h.weite} onChange={(e) => save({ ...h, weite: e.target.checked })} />
        </label>
        <label className="field">
          <span>{t.skills}</span>
          <textarea className="input" style={{ minHeight: 80 }} value={skills} onChange={(e) => setSkills(e.target.value)} onBlur={() => {
              const next = parseList(skills, 60);
              if (next.join('|') !== h.faehigkeiten.join('|')) save({ ...h, faehigkeiten: next });
            }} spellCheck={false} />
        </label>
        <p className="hint" style={{ marginTop: -4 }}>{t.skillsHint(categoryLabel('methoden'))}</p>
        <label className="field">
          <span>{t.interests}</span>
          <input className="input" value={interests} onChange={(e) => setInterests(e.target.value)} onBlur={() => {
              const next = parseList(interests, 30);
              if (next.join('|') !== h.interessen.join('|')) save({ ...h, interessen: next });
            }} placeholder={t.interestsPlaceholder} />
        </label>
        <p className="hint" style={{ marginTop: -4 }}>{t.interestsHint}</p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '20px 0 8px' }}>
        <button
          type="button"
          className="btn btn--small"
          onClick={() => {
            const start = starterHorizont();
            setSkills(start.faehigkeiten.join(', '));
            setInterests('');
            save(start, t.resetDone);
          }}
        >
          {t.reset}
        </button>
      </div>

      {editing && (
        <BridgeEditor
          bridge={editing.bridge}
          onClose={() => setEditing(null)}
          onSave={(b) => {
            const exists = h.bruecken.some((x) => x.id === b.id);
            save({ ...h, bruecken: exists ? h.bruecken.map((x) => (x.id === b.id ? b : x)) : [...h.bruecken, b] });
            setEditing(null);
          }}
          onDelete={
            editing.bridge
              ? () => {
                  const id = editing.bridge!.id;
                  save({ ...h, bruecken: h.bruecken.filter((x) => x.id !== id) }, t.bridgeDeleted(profileLabel(editing.bridge!.name)));
                  setEditing(null);
                }
              : undefined
          }
        />
      )}
    </SubPage>
  );
}
