// Entfernungen und Kartenprojektion.

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Rahmen Deutschlands für die Kartenprojektion (mit etwas Rand). */
export const DE_BOUNDS = { minLon: 5.6, maxLon: 15.3, minLat: 47.1, maxLat: 55.2 };

/** Einfache Rechteckprojektion mit Breitenkorrektur – reicht für eine stilisierte Karte. */
export const MAP_WIDTH = 1000;
const LAT0 = 51.2;
const KX = Math.cos((LAT0 * Math.PI) / 180);
export const MAP_HEIGHT = Math.round(
  (MAP_WIDTH * (DE_BOUNDS.maxLat - DE_BOUNDS.minLat)) / ((DE_BOUNDS.maxLon - DE_BOUNDS.minLon) * KX),
);

export function project(lon: number, lat: number): [number, number] {
  const x = ((lon - DE_BOUNDS.minLon) / (DE_BOUNDS.maxLon - DE_BOUNDS.minLon)) * MAP_WIDTH;
  const y = ((DE_BOUNDS.maxLat - lat) / (DE_BOUNDS.maxLat - DE_BOUNDS.minLat)) * MAP_HEIGHT;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

export function formatKm(km: number | null | undefined): string {
  if (km == null) return '';
  if (km < 1) return 'unter 1 km';
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(km)} km`;
}
