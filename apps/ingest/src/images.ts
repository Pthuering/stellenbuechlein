// Bilder für Einrichtungen und Städte aus Wikipedia/Wikimedia Commons (frei lizenziert, mit Quellenangabe).
// Logos, Wappen und Karten werden übersprungen – gesucht ist ein Foto.

import type { Http } from './http';

const NOT_A_PHOTO = /logo|siegel|seal|wappen|coat[_ ]of[_ ]arms|karte|map|locator|lage|signatur|signature|flag|flagge|icon|\.svg|diagram|grundriss|plan_|schema/i;

interface Summary {
  title?: string;
  thumbnail?: { source: string; width: number; height: number };
  originalimage?: { source: string; width: number; height: number };
  content_urls?: { desktop?: { page?: string } };
}

interface MediaList {
  items?: { type?: string; title?: string; srcset?: { src: string; scale: string }[]; showInGallery?: boolean }[];
}

function sized(url: string, width = 960): string {
  // https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Datei.jpg/320px-Datei.jpg → 960px
  return url.replace(/\/(\d+)px-([^/]+)$/, `/${width}px-$2`);
}

export interface WikiImage {
  url: string;
  credit: string;
}

export async function wikipediaImage(http: Http, title: string): Promise<WikiImage | null> {
  const enc = encodeURIComponent(title.replace(/ /g, '_'));
  const headers = { accept: 'application/json' };
  const s = await http.get(`https://de.wikipedia.org/api/rest_v1/page/summary/${enc}`, { headers, accept: 'application/json', ignoreRobots: true });
  if (!s.ok) return null;
  let summary: Summary;
  try {
    summary = JSON.parse(s.text) as Summary;
  } catch {
    return null;
  }
  const page = summary.content_urls?.desktop?.page ?? `https://de.wikipedia.org/wiki/${enc}`;
  const credit = `Foto: Wikipedia/Wikimedia Commons (${summary.title ?? title}) – ${page}`;
  const thumb = summary.thumbnail?.source;
  if (thumb && !NOT_A_PHOTO.test(thumb) && (summary.originalimage?.width ?? 1000) >= 500) {
    return { url: sized(thumb), credit };
  }
  // Sonst das erste Foto aus der Medienliste des Artikels.
  const m = await http.get(`https://de.wikipedia.org/api/rest_v1/page/media-list/${enc}`, { headers, accept: 'application/json', ignoreRobots: true });
  if (!m.ok) return null;
  try {
    const list = JSON.parse(m.text) as MediaList;
    for (const it of list.items ?? []) {
      if (it.type !== 'image' || !it.srcset?.length) continue;
      if (NOT_A_PHOTO.test(it.title ?? '') || !/\.(?:jpe?g|png|webp)$/i.test(it.title ?? '')) continue;
      let src = it.srcset[it.srcset.length - 1].src;
      if (src.startsWith('//')) src = `https:${src}`;
      return { url: sized(src), credit };
    }
  } catch {
    return null;
  }
  return null;
}
