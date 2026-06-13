import type { ContentItem } from "@/types/content"
import { PanelHeader } from "@/components/ui/panel-header"
import { cn } from "@/lib/utils"

interface ContentBrowserProps {
  /** Called when the user selects a result. Stages the item in Preview/Staging. */
  setStagedItem: (i: ContentItem | null) => void
}

export function ContentBrowser({ setStagedItem }: ContentBrowserProps) {
  // setStagedItem is called on result selection in Wave 3
  void setStagedItem

  return (
    <div
      data-slot="content-browser"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card",
      )}
    >
      <PanelHeader title="Content Browser" />
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-[0.6875rem] text-muted-foreground">Bible · Songs · Media · Text — Wave 3</p>
      </div>
    </div>
  )
}
