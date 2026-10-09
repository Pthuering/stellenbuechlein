/// <reference types="vite/client" />

declare const __DEMO__: boolean;
declare const __APP_VERSION__: string;

declare module '*.woff2' {
  const src: string;
  export default src;
}
