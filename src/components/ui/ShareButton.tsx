import { useCallback, useState } from 'react'
import { Icon } from './Icon'

/** Copies the current deep link — every entity page is shareable. */
export function ShareButton({ label = 'Copy link', className }: { label?: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Clipboard API unavailable (file://, insecure context): fall back to a prompt.
      window.prompt('Copy the link to this page:', url)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }, [])

  return (
    <button
      type="button"
      onClick={copy}
      className={
        className ??
        'inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink'
      }
    >
      <Icon name={copied ? 'check' : 'layers'} size={14} />
      {copied ? 'Link copied' : label}
      <span aria-live="polite" className="sr-only">
        {copied ? 'Link copied to clipboard' : ''}
      </span>
    </button>
  )
}
