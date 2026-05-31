import { ChevronLeftIcon, ChevronRightIcon, SquareIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useBroadcastStore } from "@/stores"

export function SlideTransport() {
  const liveItem = useBroadcastStore((s) => s.liveItem)
  const currentSlideIndex = useBroadcastStore((s) => s.currentSlideIndex)
  const isLive = useBroadcastStore((s) => s.isLive)
  const total = liveItem?.slides.length ?? 0
  const hasMulti = total > 1
  const isBlanked = !isLive && liveItem != null

  return (
    <div data-slot="slide-transport" className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        title="Previous slide"
        disabled={!hasMulti || currentSlideIndex === 0}
        onClick={() => useBroadcastStore.getState().prevSlide()}
      >
        <ChevronLeftIcon className="size-3.5" />
      </Button>

      <span
        className={cn(
          "min-w-[2.25rem] text-center font-mono text-[0.625rem] tabular-nums tracking-tight",
          liveItem ? "text-foreground" : "text-muted-foreground/40",
        )}
      >
        {liveItem ? (
          <>
            <span className="text-foreground">{currentSlideIndex + 1}</span>
            <span className="text-muted-foreground/60">/</span>
            <span className="text-muted-foreground/60">{total}</span>
          </>
        ) : (
          "–/–"
        )}
      </span>

      <Button
        variant="ghost"
        size="icon-sm"
        title="Next slide"
        disabled={!hasMulti || currentSlideIndex >= total - 1}
        onClick={() => useBroadcastStore.getState().nextSlide()}
      >
        <ChevronRightIcon className="size-3.5" />
      </Button>

      <div className="mx-0.5 h-3.5 w-px bg-border" />

      <Button
        variant="ghost"
        size="icon-sm"
        title={
          isBlanked
            ? "Output blanked — click to reveal"
            : isLive
              ? "Black (blank output)"
              : "No content"
        }
        disabled={!liveItem}
        className={cn(
          "transition-colors",
          isBlanked && "text-amber-400 hover:bg-amber-400/10 hover:text-amber-300",
        )}
        onClick={() => useBroadcastStore.getState().setLive(!isLive)}
      >
        <SquareIcon className={cn("size-3.5", isBlanked && "fill-amber-400/20")} />
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        title="Clear live output"
        disabled={!liveItem}
        onClick={() => useBroadcastStore.getState().clearLive()}
      >
        <XIcon className="size-3.5" />
      </Button>
    </div>
  )
}
