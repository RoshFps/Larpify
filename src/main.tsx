import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/figtree/wght.css';
import './styles/global.css';
import App from './App';
import { REDIRECT_URI } from './config';
import { canonicalRedirect } from './lib/canonical';

const elsewhere = import.meta.env.VITE_SPOTIFY_REDIRECT_URI
  ? canonicalRedirect(new URL(window.location.href), REDIRECT_URI)
  : null;

if (elsewhere) {
  window.location.replace(elsewhere);
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
