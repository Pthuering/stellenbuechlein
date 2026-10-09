// Seitenkopf: große handschriftliche Überschrift, kleine Zeile darunter, Knöpfe rechts.

import type { ReactNode } from 'react';

export function PageHead({ title, sub, id, children }: { title: ReactNode; sub?: ReactNode; id?: string; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div style={{ minWidth: 0 }}>
        <h1 className="page-title" id={id}>
          {title}
        </h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {children && <div className="page-head__actions">{children}</div>}
    </div>
  );
}
