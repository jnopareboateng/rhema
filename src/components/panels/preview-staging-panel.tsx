import type { ContentItem } from "@/types/content"
import { PanelHeader } from "@/components/ui/panel-header"
import { CanvasVerse } from "@/components/ui/canvas-verse"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useBroadcastStore, useQueueStore } from "@/stores"

interface PreviewStagingPanelProps {
  /** The item currently staged for preview. Set by Content Browser or Verse Detail. */
  stagedItem: ContentItem | null
}

export function PreviewStagingPanel({ stagedItem }: PreviewStagingPanelProps) {
  const themes = useBroadcastStore((s) => s.themes)
  const activeThemeId = useBroadcastStore((s) => s.activeThemeId)
  const activeTheme = themes.find((t) => t.id === activeThemeId) ?? themes[0]

  // Fallback: queue active item → queue[0], displayed but NOT used for queue/live actions
  const queueItems = useQueueStore((s) => s.items)
  const activeIndex = useQueueStore((s) => s.activeIndex)
  const fallbackItem =
    activeIndex !== null ? (queueItems[activeIndex] ?? null) : (queueItems[0] ?? null)
  const displayItem = stagedItem ?? fallbackItem

  const stagedSlide = displayItem?.slides?.[0] ?? null

  return (
    <div
      data-slot="preview-staging-panel"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-md bg-card",
        "border border-blue-500/20",
        "shadow-[inset_0_0_0_1px_rgba(59,130,246,0.05)]",
      )}
    >
      <PanelHeader title="Preview / Staging">
        {displayItem && (
          <span className="max-w-[12rem] truncate font-mono text-[0.6rem] text-blue-400/60">
            {displayItem.title}
          </span>
        )}
      </PanelHeader>

      {/* Blue accent line — visual separator that marks this as preview, not live */}
      <div className="h-px bg-gradient-to-r from-blue-500/40 via-blue-400/10 to-transparent" />

      {/* Canvas area — inner ring uses no rounding (panel is already rounded-md) */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-2">
        <div className="pointer-events-none absolute inset-2 ring-1 ring-blue-500/12" />
        <CanvasVerse theme={activeTheme} verse={stagedSlide} fit="contain" />
      </div>

      {/* Action bar — 44px */}
      <div className="flex h-11 shrink-0 items-center gap-1.5 border-t border-border/60 bg-card/80 px-2">
        <div className="flex-1" />

        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-[0.6875rem]"
          disabled={!stagedItem}
          onClick={() => {
            if (!stagedItem) return
            useQueueStore.getState().addItem(stagedItem)
          }}
        >
          Add to Queue
        </Button>

        <Button
          size="sm"
          className={cn(
            "h-8 px-4 text-sm font-semibold tracking-wide",
            "bg-blue-600 text-white hover:bg-blue-500",
            "border border-blue-500/40",
            "shadow-[0_0_0_1px_rgba(59,130,246,0.2),0_1px_4px_rgba(59,130,246,0.15)]",
            "disabled:bg-blue-900/30 disabled:text-blue-400/40",
          )}
          disabled={!stagedItem}
          onClick={() => {
            if (!stagedItem) return
            useBroadcastStore.getState().presentItem(stagedItem)
          }}
        >
          SEND LIVE
        </Button>
      </div>
    </div>
  )
}
