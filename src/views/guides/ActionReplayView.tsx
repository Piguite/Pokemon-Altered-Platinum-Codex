import { useState } from 'react'
import { loadMisc, useData } from "../../lib/data"
import { plural } from "../../lib/format"
import { Card } from "../../components/ui/Card"
import { EmptyState } from "../../components/ui/EmptyState"
import { Icon } from "../../components/ui/Icon"
import { BulletList, Callout } from "../../components/ui/Prose"
import { PageHeader } from "../../components/ui/SectionHeader"
import { SkeletonText } from "../../components/ui/Skeleton"

function CodeBlock({ lines }: { lines: string[] }) {
  const [copied, setCopied] = useState(false)
  const code = lines.join('\n')

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      window.prompt('Copy the code:', code)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="relative">
      <pre className="scroll-thin overflow-x-auto rounded-lg border border-line bg-canvas-2 px-3.5 py-3 font-mono text-[11.5px] leading-relaxed text-ink">
        {code}
      </pre>
      <button
        type="button"
        onClick={copy}
        className="absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
      >
        <Icon name={copied ? 'check' : 'layers'} size={12} />
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

/** Lines that look like AR codes (hex words) are rendered as code, prose as bullets. */
function looksLikeCode(lines: string[]): boolean {
  const codeLines = lines.filter((line) => /^[0-9A-F]{8}\s+[0-9A-F]{8}$/i.test(line.trim()))
  return codeLines.length >= Math.max(2, Math.ceil(lines.length * 0.5))
}

export function ActionReplayView() {
  const { data: misc, loading } = useData(loadMisc)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Action Replay codes"
        subtitle="The codes shipped with the documentation. Use them sparingly: the hack is meant to be beaten without cheating."
        meta={<span className="text-xs text-ink-muted">{plural(misc?.actionReplay.length ?? 0, 'code')}</span>}
      />

      <Callout tone="warn" title="Before you start">
        These codes are given as-is by the author. Back up your save before enabling them: editing a DS
        game's memory can corrupt a save file.
      </Callout>

      {loading ? (
        <SkeletonText lines={10} />
      ) : (misc?.actionReplay.length ?? 0) === 0 ? (
        <EmptyState icon="keyboard" title="No code documented" />
      ) : (
        <ul className="space-y-3">
          {(misc?.actionReplay ?? []).map((section) => (
            <li key={section.title}>
              <Card className="space-y-3">
                <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-ink">
                  <Icon name="keyboard" size={15} className="text-ink-faint" />
                  {section.title}
                </h2>
                {looksLikeCode(section.lines) ? (
                  <CodeBlock lines={section.lines} />
                ) : (
                  <BulletList lines={section.lines} />
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
