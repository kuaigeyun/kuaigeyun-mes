/// <reference types="vite/client" />

declare module '*.svg' {
  const src: string;
  export default src;
}

declare const __BUILD_TIME__: string;
declare const __MODE__: string;
declare const __IS_MONOLITHIC__: boolean;
declare const __IS_SAAS__: boolean;
