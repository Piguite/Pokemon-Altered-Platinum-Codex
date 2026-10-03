import { useState } from 'react'
import { cls } from "../../lib/format"
import { spriteUrl } from "../../lib/data"
import { Icon } from './Icon'

export interface SpriteProps {
  /** National dex number. Omit when the species cannot be resolved — a Pokéball monogram is shown. */
  dex?: number
  name: string
  /** Renders the mandatory "S" marker for Sinnohan forms. */
  sinnohan?: boolean
  size?: number
  className?: string
  /** Decorative when the name is already rendered next to it. */
  decorative?: boolean
}

/**
 * 96×96 PokeAPI sprite, degrading to a Pokédex-styled monogram when the file is
 * absent (the sprite pipeline may not have run yet).
 */
export function Sprite({ dex, name, sinnohan = false, size = 56, className, decorative = true }: SpriteProps) {
  const [failed, setFailed] = useState(false)
  const hasDex = typeof dex === 'number' && dex > 0
  const showMonogram = failed || !hasDex

  return (
    <span
      className={cls('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-xl bg-surface-3/70 ring-1 ring-line ring-inset"
        style={{ backgroundImage: 'radial-gradient(circle at 50% 22%, rgba(255,255,255,0.07), transparent 62%)' }}
      />
      {showMonogram ? (
        <span
          aria-hidden="true"
          className="relative flex flex-col items-center justify-center text-ink-faint"
          style={{ fontSize: Math.max(9, size * 0.2) }}
        >
          <Icon name="pokeball" size={Math.max(14, size * 0.42)} strokeWidth={1.5} />
          {hasDex ? (
            <span className="nums mt-0.5 font-mono font-semibold leading-none">
              #{String(dex).padStart(3, '0')}
            </span>
          ) : null}
        </span>
      ) : (
        <img
          src={spriteUrl(dex)}
          alt={decorative ? '' : name}
          loading="lazy"
          decoding="async"
          width={size}
          height={size}
          onError={() => setFailed(true)}
          className="relative object-contain"
          style={{ width: size * 0.94, height: size * 0.94, imageRendering: 'pixelated' }}
        />
      )}
      {sinnohan ? (
        <span
          className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-accent-solid text-[10px] font-bold text-accent-ink ring-2 ring-surface"
          title="Sinnohan form"
        >
          S
        </span>
      ) : null}
    </span>
  )
}
