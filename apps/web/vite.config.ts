import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

// Zwei Ausgaben:
//   npm run build        → PWA für den Worker (dist/), mit Service Worker und Push
//   npm run build:demo   → eine einzelne HTML-Datei mit echten Beispielanzeigen (dist-demo/), ohne Server
/** Die Demo ist eine einzelne Datei ohne /icons – Verweise darauf entfernen. */
const demoHtml = (): Plugin => ({
  name: 'demo-html',
  transformIndexHtml: (html) => html.replace(/\s*<link rel="(?:icon|apple-touch-icon)"[^>]*>/g, ''),
});

export default defineConfig(({ mode }) => {
  const demo = mode === 'demo';
  return {
    plugins: [
      react(),
      demo
        ? [viteSingleFile({ removeViteModuleLoader: true }), demoHtml()]
        : VitePWA({
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.ts',
            registerType: 'autoUpdate',
            injectRegister: false,
            manifest: {
              name: 'Stellenbüchlein',
              short_name: 'Stellenbüchlein',
              description: 'Forschungsstellen mit Psychologie-Bezug – gesammelt, sortiert, gemerkt.',
              lang: 'de',
              start_url: '/#/stapel',
              scope: '/',
              display: 'standalone',
              orientation: 'portrait',
              background_color: '#FFF6F7',
              theme_color: '#F28DB2',
              icons: [
                { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
            injectManifest: {
              globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
              maximumFileSizeToCacheInBytes: 4_000_000,
            },
          }),
    ],
    define: {
      __DEMO__: JSON.stringify(demo),
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.1.0'),
    },
    resolve: {
      alias: demo ? { 'virtual:pwa-register': fileURLToPath(new URL('./src/pwa-stub.ts', import.meta.url)) } : {},
    },
    build: {
      outDir: demo ? 'dist-demo' : 'dist',
      emptyOutDir: true,
      copyPublicDir: !demo,
      assetsInlineLimit: demo ? 100_000_000 : 4096,
      chunkSizeWarningLimit: 1200,
      target: 'es2022',
    },
    server: {
      port: 5173,
      proxy: { '/api': 'http://localhost:8787' },
    },
  };
});
