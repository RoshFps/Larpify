/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SPOTIFY_CLIENT_ID?: string;
  readonly VITE_SPOTIFY_REDIRECT_URI?: string;
  readonly VITE_BASE_PATH?: string;
  readonly VITE_ACCESS_FORM_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
