/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Applied to production builds only: Vite's dev server injects inline scripts
// for hot reload, which a strict policy would block.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' https://sdk.scdn.co",
  "connect-src 'self' https://api.spotify.com https://accounts.spotify.com https://*.spotify.com https://*.scdn.co",
  "img-src 'self' data: https://*.scdn.co https://*.spotifycdn.com",
  "style-src 'self'",
  "font-src 'self'",
  'frame-src https://sdk.scdn.co',
  "media-src 'self' blob: https://*.scdn.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'larpify-csp',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
    ],
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react(), contentSecurityPolicy()],
    // Spotify only accepts loopback redirect URIs written as 127.0.0.1, not localhost.
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true },
    build: { sourcemap: false, target: 'es2022' },
    test: { include: ['src/**/*.test.ts', 'tests/api/**/*.test.ts'] },
  };
});
