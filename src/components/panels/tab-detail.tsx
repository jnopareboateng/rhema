import type React from "react"
import type { ContentItem } from "@/types/content"
import { VerseDetailPanel } from "@/components/panels/verse-detail-panel"
import { PanelHeader } from "@/components/ui/panel-header"
import { Music2Icon, VideoIcon, FileTextIcon } from "lucide-react"

interface TabDetailProps {
  /** Active Content Browser tab ("bible" | "songs" | "media" | "text"). */
  tab: string
  stagedItem: ContentItem | null
  setStagedItem: (i: ContentItem | null) => void
}

interface Placeholder {
  title: string
  icon: React.ReactNode
  message: string
}

const PLACEHOLDERS: Record<string, Placeholder> = {
  songs: { title: "Song Detail", icon: <Music2Icon className="size-5" />, message: "Song sections will appear here" },
  media: { title: "Media Detail", icon: <VideoIcon className="size-5" />, message: "Media details will appear here" },
  text: { title: "Text Detail", icon: <FileTextIcon className="size-5" />, message: "Text details will appear here" },
}

/**
 * Contextual inspector for the bottom-right slot. Mirrors the active Content
 * Browser tab: the Bible tab gets the full Verse Detail (chapter context +
 * present actions); other tabs get a matching placeholder until those content
 * types are implemented — so the Bible-specific Verse Detail no longer bleeds
 * onto Songs / Media / Text.
 */
export function TabDetail({ tab, stagedItem, setStagedItem }: TabDetailProps) {
  if (tab === "bible") {
    return <VerseDetailPanel stagedItem={stagedItem} setStagedItem={setStagedItem} />
  }

  const p = PLACEHOLDERS[tab] ?? PLACEHOLDERS.text
  return (
    <div
      data-slot="tab-detail"
      className="flex min-h-0 flex-col overflow-hidden rounded-md border border-border bg-card"
    >
      <PanelHeader title={p.title} icon={p.icon} />
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-10 items-center justify-center rounded-xl border border-border/60 bg-muted/30 text-muted-foreground/40">
          {p.icon}
        </div>
        <p className="max-w-[20ch] text-[0.6875rem] leading-relaxed text-muted-foreground/50">
          {p.message}
        </p>
      </div>
    </div>
  )
}
