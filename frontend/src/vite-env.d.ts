/// <reference types="vite/client" />

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.ico' {
  const src: string;
  export default src;
}

interface ImportMeta {
  readonly env: {
    readonly PACKAGE_VERSION: string;
    // Add other custom env variables here if needed
    [key: string]: any;
  };
}
