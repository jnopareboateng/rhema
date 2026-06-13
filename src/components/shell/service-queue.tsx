import type { ContentItem } from "@/types/content"
import { PanelHeader } from "@/components/ui/panel-header"
import { cn } from "@/lib/utils"

interface ServiceQueueProps {
  /** Called when a queue item's play button is clicked. Wave 3 wires this. */
  onPresent: (item: ContentItem) => void
}

export function ServiceQueue({ onPresent }: ServiceQueueProps) {
  // onPresent is wired to queue item play buttons in Wave 3
  void onPresent

  return (
    <div
      data-slot="service-queue"
      className={cn(
        "flex min-h-0 h-full flex-col overflow-hidden rounded-lg border border-border bg-card",
      )}
    >
      <PanelHeader title="Service Queue" />
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-[0.6875rem] text-muted-foreground">Queue — Wave 3</p>
      </div>
    </div>
  )
}
