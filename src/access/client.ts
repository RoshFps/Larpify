// Access requests go to the owner's inbox through Web3Forms. The page only
// holds a Web3Forms access key, which maps to the owner's address on their
// side, so the email itself never appears in the code or the browser.

const FORM_ENDPOINT = 'https://api.web3forms.com/submit';
const ACCESS_KEY = import.meta.env.VITE_ACCESS_FORM_KEY;

/** False when the site has no form key, which hides the request form. */
export const accessFormEnabled = Boolean(ACCESS_KEY);

/** `website` is the hidden bot trap; a filled one is dropped without sending. */
export async function requestAccess(name: string, email: string, website: string): Promise<void> {
  if (website) return;
  if (!ACCESS_KEY) throw new Error('Requests aren’t set up on this site.');
  let res: Response;
  try {
    res = await fetch(FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: ACCESS_KEY,
        subject: `Larpify access request from ${name}`,
        from_name: 'Larpify',
        name,
        // Shown in the email body, so the owner can copy it into the Spotify dashboard.
        spotify_email: email,
        botcheck: '',
      }),
    });
  } catch {
    throw new Error('Couldn’t send. Check your connection and try again.');
  }
  if (!res.ok) throw new Error('Couldn’t send right now. Try again in a bit.');
}
