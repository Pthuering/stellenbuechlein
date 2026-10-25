// Blatt, das von unten hereingleitet (Details, Filter, Verlauf). Schließen: X, Esc, Hintergrund, nach unten ziehen.

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from './icons';
import { texts } from '../i18n';

const t = texts({
  de: { close: 'Schließen' },
  en: { close: 'Close' },
  sr: { close: 'Zatvori' },
});

/** Blätter liegen immer über der ganzen App – nicht im scrollenden Bildschirm, aus dem sie geöffnet werden. */
const openSheets: symbol[] = [];

function sheetRoot(): HTMLElement {
  return document.querySelector<HTMLElement>('.app') ?? document.body;
}

export function Sheet({
  title,
  onClose,
  children,
  full = false,
  actions,
  labelledBy,
}: {
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  full?: boolean;
  actions?: ReactNode;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);

  // onClose kann bei jedem Rendern neu sein – der Effekt soll trotzdem nur beim Öffnen laufen
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const id = Symbol('sheet');
    openSheets.push(id);
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // Nur das oberste Blatt reagiert auf Escape
      if (e.key === 'Escape' && openSheets[openSheets.length - 1] === id) {
        e.stopPropagation();
        closeRef.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      openSheets.splice(openSheets.indexOf(id), 1);
      prev?.focus?.();
    };
  }, []);

  const onGripDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, dy: 0 };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onGripMove = (e: React.PointerEvent) => {
    if (!drag.current || !ref.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    ref.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onGripUp = () => {
    if (!drag.current || !ref.current) return;
    const close = drag.current.dy > 110;
    ref.current.style.transition = 'transform 0.2s ease';
    ref.current.style.transform = close ? 'translateY(100%)' : '';
    const el = ref.current;
    window.setTimeout(() => {
      el.style.transition = '';
      if (close) onClose();
    }, 200);
    drag.current = null;
  };

  return createPortal(
    <div className="sheet-layer">
      <div className="sheet-backdrop" onClick={onClose} />
      <div
        ref={ref}
        className={`sheet paper ${full ? 'sheet--full' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={typeof title === 'string' && !labelledBy ? title : undefined}
        tabIndex={-1}
      >
        <div className="sheet__grip" onPointerDown={onGripDown} onPointerMove={onGripMove} onPointerUp={onGripUp} onPointerCancel={onGripUp} aria-hidden="true" />
        <div className={`sheet__head ${title ? '' : 'sheet__head--floating'}`}>
          {title ? <h2 className="sheet__title">{title}</h2> : <span />}
          <div style={{ display: 'flex', gap: 4 }}>
            {actions}
            <button type="button" className="icon-btn" onClick={onClose} aria-label={t.close}>
              <IconX width={24} height={24} />
            </button>
          </div>
        </div>
        <div className="sheet__body">{children}</div>
      </div>
    </div>,
    sheetRoot(),
  );
}
