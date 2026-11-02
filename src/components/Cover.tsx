import { MicIcon, MusicNoteIcon } from './Icons';

interface CoverProps {
  src: string | null;
  alt?: string;
  size: number;
  round?: boolean;
  className?: string;
}

export function Cover({ src, alt = '', size, round = false, className = '' }: CoverProps) {
  const classes = `cover ${round ? 'cover--round' : ''} ${className}`.trim();
  if (!src) {
    return (
      <div className={`${classes} cover--empty`} role="img" aria-label={alt}>
        {round ? <MicIcon size={size / 2.5} /> : <MusicNoteIcon size={size / 2.5} />}
      </div>
    );
  }
  return (
    <img className={classes} src={src} alt={alt} width={size} height={size} loading="lazy" decoding="async" />
  );
}
