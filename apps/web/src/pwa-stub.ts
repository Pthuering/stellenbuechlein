// Ersatz für 'virtual:pwa-register' in der Demo (dort gibt es keinen Service Worker).
export function registerSW(): (reload?: boolean) => Promise<void> {
  return async () => undefined;
}
