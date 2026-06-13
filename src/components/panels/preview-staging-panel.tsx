import type { ContentItem } from "@/types/content"
import { PanelHeader } from "@/components/ui/panel-header"
import { cn } from "@/lib/utils"

interface PreviewStagingPanelProps {
  /** The item currently staged for preview. Set by Content Browser or Verse Detail. */
  stagedItem: ContentItem | null
  /** Replaces or clears the staged item. Wave 3 wires Browser/Detail selections here. */
  setStagedItem: (i: ContentItem | null) => void
}

export function PreviewStagingPanel({ stagedItem, setStagedItem }: PreviewStagingPanelProps) {
  // setStagedItem is wired from Browser/Detail selection events in Wave 3
  void setStagedItem

  return (
    <div
      data-slot="preview-staging-panel"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card",
      )}
    >
      <PanelHeader title="Preview / Staging" />
      <div className="flex flex-1 items-center justify-center p-4">
        {stagedItem ? (
          <p className="text-[0.6875rem] text-muted-foreground truncate">
            {stagedItem.title}
          </p>
        ) : (
          <p className="text-[0.6875rem] text-muted-foreground">Preview — Wave 3</p>
        )}
      </div>
    </div>
  )
}
