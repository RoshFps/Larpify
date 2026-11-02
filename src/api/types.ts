// Only the fields the app reads. Spotify returns much more.

export interface SpotifyImage {
  url: string;
  width: number | null;
  height: number | null;
}

export interface UserProfile {
  id: string;
  display_name: string | null;
  product?: string;
  images?: SpotifyImage[];
}

export interface Playlist {
  id: string;
  uri: string;
  name: string;
  images: SpotifyImage[] | null;
  owner: { display_name: string | null };
}

export interface Artist {
  id: string;
  uri: string;
  name: string;
  images?: SpotifyImage[];
  followers?: { total: number };
}

export interface Track {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  is_playable?: boolean;
  artists: Pick<Artist, 'id' | 'name'>[];
  album: { name: string; images: SpotifyImage[] };
}

export interface Paging<T> {
  items: T[];
  next: string | null;
  total: number;
}

export interface PlaybackState {
  is_playing: boolean;
  progress_ms: number | null;
  device: { id: string | null; name: string; type: string; volume_percent: number | null } | null;
  item: Track | null;
}
