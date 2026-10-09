// Handgezeichnete Symbole (leicht unregelmäßige Striche, runde Enden).
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

const Svg = ({ children, ...p }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...p}>
    {children}
  </svg>
);

export const IconStack = (p: P) => (
  <Svg {...p}>
    <path d="M8.3 6.2 17.5 4.4c.8-.1 1.4.3 1.6 1.1l1.7 9.3" />
    <path d="M4.4 8.7c0-.9.6-1.5 1.5-1.5h9.6c.9 0 1.6.7 1.6 1.5v10c0 .9-.7 1.5-1.6 1.5H5.9c-.9 0-1.5-.6-1.5-1.5Z" />
    <path d="M7.4 12.3h6.6M7.5 15.5h4.2" />
  </Svg>
);

export const IconMap = (p: P) => (
  <Svg {...p}>
    <path d="M3.6 6.5 8.8 4.3l6.3 2.3 5.3-2.2v13.4l-5.3 2.1-6.3-2.2-5.2 2.2Z" />
    <path d="M8.8 4.5v13.3M15.1 6.6v13.2" />
  </Svg>
);

export const IconHeart = ({ filled, ...p }: P & { filled?: boolean }) => (
  <Svg {...p}>
    <path
      d="M12 20.1s-7.6-4.4-8.4-9.6C3 7.2 5.2 4.8 7.9 4.9c1.7 0 3.1 1 4.1 2.6 1-1.6 2.4-2.6 4.1-2.6 2.7-.1 4.9 2.3 4.3 5.6-.8 5.2-8.4 9.6-8.4 9.6Z"
      fill={filled ? 'currentColor' : 'none'}
    />
  </Svg>
);

export const IconList = (p: P) => (
  <Svg {...p}>
    <path d="M8.7 6.4h11M8.9 12.1h10.4M8.7 17.8h10.8" />
    <path d="M4.3 6.3h.6M4.4 12.1h.6M4.3 17.9h.6" strokeWidth={2.6} />
  </Svg>
);

export const IconMe = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="8.3" r="3.7" />
    <path d="M4.7 20.1c.9-3.9 3.6-6 7.3-6s6.4 2.1 7.3 6" />
  </Svg>
);

export const IconX = (p: P) => (
  <Svg {...p}>
    <path d="M6.3 6.1 17.8 17.9M17.6 6.2 6.4 17.7" />
  </Svg>
);

export const IconStar = ({ filled, ...p }: P & { filled?: boolean }) => (
  <Svg {...p}>
    <path d="m12 3.6 2.5 5.3 5.7.7-4.2 3.9 1.1 5.7L12 16.4l-5.1 2.8 1.1-5.7-4.2-3.9 5.7-.7Z" fill={filled ? 'currentColor' : 'none'} />
  </Svg>
);

export const IconUndo = (p: P) => (
  <Svg {...p}>
    <path d="M9.2 7.4 4.9 11.5l4.3 4.1" />
    <path d="M5.3 11.5h8.9c2.9 0 5 2 5 4.6" />
  </Svg>
);

export const IconFilter = (p: P) => (
  <Svg {...p}>
    <path d="M4.1 5.3h15.8l-6 7.4v5.1l-3.7 1.9v-7Z" />
  </Svg>
);

export const IconHistory = (p: P) => (
  <Svg {...p}>
    <path d="M4.6 12.1a7.5 7.5 0 1 0 2.2-5.3" />
    <path d="M4.3 4.5v3.3h3.3" />
    <path d="M12 8.1v4.3l2.9 1.8" />
  </Svg>
);

export const IconSearch = (p: P) => (
  <Svg {...p}>
    <circle cx="10.6" cy="10.4" r="6.1" />
    <path d="m15.2 15.1 5.1 5" />
  </Svg>
);

export const IconChevron = (p: P) => (
  <Svg {...p}>
    <path d="m9.5 5.6 6.2 6.4-6.2 6.3" />
  </Svg>
);

export const IconPin = (p: P) => (
  <Svg {...p}>
    <path d="M12 21s-6.1-6.4-6.1-11a6.1 6.1 0 1 1 12.2 0c0 4.6-6.1 11-6.1 11Z" />
    <circle cx="12" cy="10" r="2.2" />
  </Svg>
);

export const IconHome = (p: P) => (
  <Svg {...p}>
    <path d="M4.2 11.2 12 4.4l7.8 6.8" />
    <path d="M6.4 9.7v9.6h11.2V9.7" />
    <path d="M10.4 19.2v-4.6h3.2v4.6" />
  </Svg>
);

export const IconExternal = (p: P) => (
  <Svg {...p}>
    <path d="M14 4.6h5.4V10" />
    <path d="M19.2 4.8 11 13" />
    <path d="M17.6 13.9v4.3c0 .8-.6 1.4-1.4 1.4H5.8c-.8 0-1.4-.6-1.4-1.4V7.8c0-.8.6-1.4 1.4-1.4h4.3" />
  </Svg>
);

export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="m4.8 12.6 4.3 4.2 10-10" />
  </Svg>
);

export const IconBell = (p: P) => (
  <Svg {...p}>
    <path d="M6.1 16.4V11a5.9 5.9 0 1 1 11.8 0v5.4l1.6 1.8H4.5Z" />
    <path d="M10 20.4c.5.7 1.2 1 2 1s1.5-.3 2-1" />
  </Svg>
);

export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5.2v13.6M5.2 12h13.6" />
  </Svg>
);

export const IconArrowUp = (p: P) => (
  <Svg {...p}>
    <path d="M12 19.4V5.3M6.5 10.7 12 5.1l5.5 5.6" />
  </Svg>
);

export const IconDoc = (p: P) => (
  <Svg {...p}>
    <path d="M6.2 3.9h8.2l3.6 3.7v12.5H6.2Z" />
    <path d="M14.2 4v3.8h3.7M9 12.1h6M9 15.4h4.5" />
  </Svg>
);

export const IconRefresh = (p: P) => (
  <Svg {...p}>
    <path d="M19.4 8.3A7.6 7.6 0 0 0 5.6 7.4M4.6 15.7a7.6 7.6 0 0 0 13.8.9" />
    <path d="M19.6 4.2v4.3h-4.3M4.4 19.8v-4.3h4.3" />
  </Svg>
);

export const IconPencil = (p: P) => (
  <Svg {...p}>
    <path d="m15.4 5.3 3.3 3.3L8.9 18.4l-4.2.9.9-4.2Z" />
    <path d="m13.6 7.1 3.3 3.3" />
  </Svg>
);

export const IconTrash = (p: P) => (
  <Svg {...p}>
    <path d="M5 7h14M9.6 7V4.8h4.8V7M7 7l.9 12.4h8.2L17 7" />
  </Svg>
);

export const IconMail = (p: P) => (
  <Svg {...p}>
    <path d="M3.9 6.3h16.2v11.5H3.9Z" />
    <path d="m4.2 6.6 7.8 6.3 7.8-6.3" />
  </Svg>
);

/** Unsichtbare SVG-Filter für Stempel (raue Kanten). */
export function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <filter id="rau" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="2.4" />
        </filter>
      </defs>
    </svg>
  );
}
