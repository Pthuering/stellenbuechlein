// Gezeichnetes App-Symbol: rosa Notizbuch mit Ringbindung und Herz.
// Eine Quelle für alle Größen: scripts/build-icons.ts rendert daraus die PNGs.

const INK = '#3B2741';

function art(): string {
  return `
  <g transform="rotate(-7 256 262)">
    <path d="M170 104 382 98c15 0 25 10 25 25l3 266c0 15-10 25-25 26l-213 6Z" fill="#FFFDFB" stroke="${INK}" stroke-width="13" stroke-linejoin="round"/>
    <path d="M384 140v236" stroke="#E4E2F6" stroke-width="8" stroke-linecap="round"/>
    <path d="M138 96c70-3 142-4 214-2 15 1 24 11 24 26 1 90 1 180-1 270 0 15-10 25-25 26-71 3-142 4-213 3-13 0-21-9-21-22-2-92-2-185 0-279 0-13 9-22 22-22Z" fill="#F28DB2" stroke="${INK}" stroke-width="13" stroke-linejoin="round"/>
    <path d="M150 112c4 98 3 196 0 294" stroke="#D9578A" stroke-width="7" stroke-linecap="round" opacity="0.55"/>
    <g fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round">
      <path d="M96 150c-14 1-16 25 0 26h34"/>
      <path d="M96 236c-14 1-16 25 0 26h34"/>
      <path d="M96 322c-14 1-16 25 0 26h34"/>
    </g>
    <path d="M262 352s-74-41-83-92c-6-31 15-54 41-53 17 0 31 9 41 25 10-16 24-25 41-25 26-1 47 22 41 53-9 51-81 92-81 92Z" fill="#FFF3C4" stroke="${INK}" stroke-width="13" stroke-linejoin="round"/>
    <path d="M214 246c4-11 13-17 24-17" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round" opacity="0.8"/>
  </g>`;
}

/** Normales Symbol mit abgerundetem Papierquadrat. */
export function iconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <clipPath id="r"><rect width="512" height="512" rx="116"/></clipPath>
  <rect width="512" height="512" rx="116" fill="#FFF6F7"/>
  <g clip-path="url(#r)" stroke="#E4E2F6" stroke-width="6"><path d="M0 418h512"/><path d="M0 462h512"/></g>
  ${art()}
</svg>`;
}

/** Maskierbares Symbol: Fläche randlos, Motiv in der sicheren Zone (80 %). */
export function maskableSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#FBD3E2"/>
  <g transform="translate(256 256) scale(0.74) translate(-256 -256)">${art()}</g>
</svg>`;
}

/** Einfarbiges Symbol für die Statusleiste (Android nutzt nur den Alphakanal). */
export function badgeSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <path d="M48 82S14 63 10 40c-3-14 7-25 19-24 8 0 14 4 19 12 5-8 11-12 19-12 12-1 22 10 19 24-4 23-38 42-38 42Z" fill="#fff"/>
</svg>`;
}
