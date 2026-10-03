import type { SVGProps } from 'react'

export type IconName =
  | 'search'
  | 'close'
  | 'menu'
  | 'sun'
  | 'moon'
  | 'chevronDown'
  | 'chevronRight'
  | 'chevronLeft'
  | 'arrowRight'
  | 'sort'
  | 'pokeball'
  | 'book'
  | 'sparkles'
  | 'filter'
  | 'zap'
  | 'shield'
  | 'users'
  | 'gift'
  | 'shuffle'
  | 'tag'
  | 'grid'
  | 'mapPin'
  | 'scale'
  | 'check'
  | 'minus'
  | 'alert'
  | 'info'
  | 'external'
  | 'list'
  | 'home'
  | 'snowflake'
  | 'star'
  | 'swap'
  | 'trending'
  | 'keyboard'
  | 'clipboard'
  | 'layers'
  | 'hash'

const PATHS: Record<IconName, JSX.Element> = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20.5 20.5-4-4" />
    </>
  ),
  close: <path d="M18 6 6 18M6 6l12 12" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.8A8.6 8.6 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  arrowRight: <path d="M4 12h15M13 6l6 6-6 6" />,
  sort: <path d="M8 4v16M8 4 4 8M8 4l4 4M16 20V4M16 20l4-4M16 20l-4-4" />,
  pokeball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h6M15 12h6" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M19 18v3H6.5A2.5 2.5 0 0 1 4 18.5" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" />
      <path d="m18.5 15.5.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
    </>
  ),
  filter: <path d="M3 5h18l-7 8v6l-4-2v-4z" />,
  zap: <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12z" />,
  shield: <path d="M12 3 5 6v6c0 4.5 3 7.7 7 9 4-1.3 7-4.5 7-9V6z" />,
  users: (
    <>
      <circle cx="9.5" cy="8" r="3.2" />
      <path d="M3.5 20a6 6 0 0 1 12 0" />
      <path d="M16.5 5.2a3.2 3.2 0 0 1 0 5.6M18 20a6 6 0 0 0-2.2-4.6" />
    </>
  ),
  gift: (
    <>
      <path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13" />
      <path d="M12 7S10.6 3 8.6 3a2 2 0 0 0 0 4zM12 7s1.4-4 3.4-4a2 2 0 0 1 0 4z" />
    </>
  ),
  shuffle: <path d="M16 4h4v4M20 4l-5.5 5.5M8 20H4v-4M4 20l5.5-5.5M16 20h4v-4M20 20l-5-5M4 4h4l5 5" />,
  tag: (
    <>
      <path d="M12.6 3H21v8.4L11.4 21 3 12.6z" />
      <circle cx="17" cy="7" r="1.3" />
    </>
  ),
  grid: <path d="M4 4h16v16H4zM4 10h16M4 15.5h16M10 4v16M15.5 4v16" />,
  mapPin: (
    <>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </>
  ),
  scale: <path d="M12 3v18M7.5 21h9M5 7h14M5 7 2.5 14h5zM19 7l-2.5 7h5z" />,
  check: <path d="m5 13 4 4 10-10" />,
  minus: <path d="M5 12h14" />,
  alert: (
    <>
      <path d="M12 3 2 20h20z" />
      <path d="M12 9.5v4.5M12 17.4v.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.6v.01" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6M20 4l-8 8" />
      <path d="M18 14v6H4V6h6" />
    </>
  ),
  list: <path d="M8 6h13M8 12h13M8 18h13M3.6 6h.01M3.6 12h.01M3.6 18h.01" />,
  home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  snowflake: <path d="M12 2v20M4.2 6.5l15.6 11M19.8 6.5 4.2 17.5M12 6l-2.4-2.4M12 6l2.4-2.4M12 18l-2.4 2.4M12 18l2.4 2.4" />,
  star: <path d="m12 3.5 2.6 5.6 6.1.7-4.6 4.2 1.2 6.1L12 17.2l-5.3 2.9 1.2-6.1L3.3 9.8l6.1-.7z" />,
  swap: <path d="M7 7h13M20 7l-3-3M20 7l-3 3M17 17H4M4 17l3-3M4 17l3 3" />,
  trending: (
    <>
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  keyboard: (
    <>
      <path d="M3 6h18v12H3z" />
      <path d="M7 10h.01M10.5 10h.01M14 10h.01M17.5 10h.01M8 14h8" />
    </>
  ),
  clipboard: (
    <>
      <path d="M9 4h6v3H9z" />
      <path d="M9 5.5H6v15h12v-15h-3" />
    </>
  ),
  layers: <path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5" />,
  hash: <path d="M9 4 7 20M17 4l-2 16M4 9h16M3 15h16" />,
}

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: number
  strokeWidth?: number
}

export function Icon({ name, size = 18, strokeWidth = 1.7, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  )
}
