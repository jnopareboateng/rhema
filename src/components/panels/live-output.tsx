import { PanelHeader } from "@/components/ui/panel-header"
import { cn } from "@/lib/utils"

export function LiveOutput() {
  return (
    <div
      data-slot="live-output"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card",
      )}
    >
      <PanelHeader title="Live Output" />
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-[0.6875rem] text-muted-foreground">Live output — Wave 3</p>
      </div>
    </div>
  )
}
