import type { ContentItem } from "@/types/content"
import { PanelHeader } from "@/components/ui/panel-header"
import { cn } from "@/lib/utils"

interface VerseDetailPanelProps {
  /** The item currently staged (drives the chapter context display). */
  stagedItem: ContentItem | null
  /** Called on verse selection or double-click → present. Wave 3 wires this. */
  setStagedItem: (i: ContentItem | null) => void
}

export function VerseDetailPanel({ stagedItem, setStagedItem }: VerseDetailPanelProps) {
  // setStagedItem is wired from verse row selection and arrow-key nav in Wave 3
  void setStagedItem

  return (
    <div
      data-slot="verse-detail-panel"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card",
      )}
    >
      <PanelHeader title="Verse Detail" />
      <div className="flex flex-1 items-center justify-center p-4">
        {stagedItem?.kind === "verse" ? (
          <p className="text-[0.6875rem] text-muted-foreground truncate">
            {stagedItem.title}
          </p>
        ) : (
          <p className="text-[0.6875rem] text-muted-foreground">Verse context — Wave 3</p>
        )}
      </div>
    </div>
  )
}
