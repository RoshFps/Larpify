import { signOut } from '../auth/session';
import { LogoMark } from '../components/Icons';
import { AccessRequestForm } from './AccessRequestForm';

/** Shown when Spotify says this account isn't on the app's user list yet. */
export function NotAllowedScreen() {
  return (
    <main className="login">
      <div className="login__card">
        <LogoMark size={56} className="login__logo" />
        <h1 className="login__title">Almost in</h1>
        <p className="login__tagline">
          Your Spotify account isn’t on this Larpify’s guest list yet. Ask to be added and try again once you are.
        </p>
        <AccessRequestForm />
        <button className="link-btn" onClick={signOut}>
          Log out
        </button>
      </div>
    </main>
  );
}
