import type { SVGProps } from 'react';

// Hand-drawn 24px icons; pulling in an icon library for a dozen glyphs isn't worth the bundle.

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 24, children, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const LogoMark = (p: IconProps) => (
  <Icon {...p} viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="16" />
    <path d="M11 9.5v13M16 7v18M21 11.5v9" stroke="#000" strokeWidth="3" strokeLinecap="round" />
  </Icon>
);

export const HomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.2 2.5 10.6V21h7v-6h5v6h7V10.6L12 3.2Zm7.5 15.8h-3v-6h-9v6h-3v-7.4L12 5.7l7.5 5.9V19Z" />
  </Icon>
);

export const LibraryIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 21V3h2v18H3Zm5 0V3h2v18H8Zm5.3-.1-.1-17.6 1.9-.6 6.4 17.1-1.9.7-5.3-14.3v14.7h-1Z" />
  </Icon>
);

export const MicIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 2a4 4 0 0 0-4 4v5a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4Zm2 9a2 2 0 0 1-4 0V6a2 2 0 0 1 4 0v5Zm4.9 0a6.9 6.9 0 0 1-5.9 6.8V21h-2v-3.2A6.9 6.9 0 0 1 5.1 11h2a4.9 4.9 0 0 0 9.8 0h2Z" />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10.5 3a7.5 7.5 0 0 1 5.9 12.1l4.8 4.8-1.4 1.4-4.8-4.8A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z" />
  </Icon>
);

export const PlayIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4.5v15a.5.5 0 0 0 .8.4l11.6-7.5a.5.5 0 0 0 0-.8L7.8 4.1a.5.5 0 0 0-.8.4Z" />
  </Icon>
);

export const PauseIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </Icon>
);

export const NextIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 5.2v13.6a.5.5 0 0 0 .8.4l9.7-6.8a.5.5 0 0 0 0-.8L5.8 4.8a.5.5 0 0 0-.8.4ZM17 5h2v14h-2z" />
  </Icon>
);

export const PrevIcon = (p: IconProps) => (
  <Icon {...p} className="icon-flip">
    <path d="M5 5.2v13.6a.5.5 0 0 0 .8.4l9.7-6.8a.5.5 0 0 0 0-.8L5.8 4.8a.5.5 0 0 0-.8.4ZM17 5h2v14h-2z" />
  </Icon>
);

export const VolumeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 9v6h4l5 4V5L7 9H3Zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4ZM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6Z" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9.5 16.6-4.1-4.1L4 13.9l5.5 5.5L20 8.9l-1.4-1.4-9.1 9.1Z" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" />
  </Icon>
);

export const DeviceIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5h16v10H4V5Zm-2-2v14h8v2H7v2h10v-2h-3v-2h8V3H2Zm4 4v6h12V7H6Z" />
  </Icon>
);

export const MusicNoteIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 4v10.3A3.5 3.5 0 1 0 11 17.5V8h8V4H9Z" />
  </Icon>
);

export const ChartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20V10h3v10H4Zm6.5 0V4h3v16h-3ZM17 20v-7h3v7h-3Z" />
  </Icon>
);
