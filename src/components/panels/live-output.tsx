import { PanelHeader } from "@/components/ui/panel-header"
import { CanvasVerse } from "@/components/ui/canvas-verse"
import { LogoSlateCanvas } from "@/components/ui/logo-slate-canvas"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useBroadcastStore } from "@/stores"
import { isLogoItem, RHEMA_LOGO_ITEM } from "@/lib/rhema-logo-slide"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

export function LiveOutput() {
  const isLive = useBroadcastStore((s) => s.isLive)
  const liveItem = useBroadcastStore((s) => s.liveItem)
  const currentSlideIndex = useBroadcastStore((s) => s.currentSlideIndex)
  const themes = useBroadcastStore((s) => s.themes)
  const activeThemeId = useBroadcastStore((s) => s.activeThemeId)

  const activeTheme = themes.find((t) => t.id === activeThemeId) ?? themes[0]
  const total = liveItem?.slides.length ?? 0
  const showTransport = total > 1
  const liveSlide = liveItem?.slides?.[currentSlideIndex] ?? null

  return (
    <div
      data-slot="live-output"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-md bg-card",
        isLive
          ? "border border-emerald-500/60 shadow-[0_0_0_1px_rgba(16,185,129,0.15),inset_0_0_0_1px_rgba(16,185,129,0.06)]"
          : "border border-border",
      )}
    >
      <PanelHeader title="Live Output">
        <div className="flex items-center gap-2">
          {/* On-air indicator dot */}
          {isLive && (
            <span className="flex items-center gap-1 text-[0.625rem] font-semibold uppercase tracking-widest text-emerald-400">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(16,185,129,0.9)]" />
              LIVE
            </span>
          )}

          {/* Inline slide transport — hidden when single slide */}
          {showTransport && (
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                title="Previous slide"
                disabled={currentSlideIndex === 0}
                onClick={() => useBroadcastStore.getState().prevSlide()}
                className="size-6"
              >
                <ChevronLeftIcon className="size-3" />
              </Button>
              <span className="min-w-[2.5rem] text-center font-mono text-[0.625rem] tabular-nums text-muted-foreground">
                {currentSlideIndex + 1}/{total}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Next slide"
                disabled={currentSlideIndex >= total - 1}
                onClick={() => useBroadcastStore.getState().nextSlide()}
                className="size-6"
              >
                <ChevronRightIcon className="size-3" />
              </Button>
            </div>
          )}
        </div>
      </PanelHeader>

      {/* Live state accent line — green on-air, dim off-air */}
      <div
        className={cn(
          "h-px transition-colors duration-300",
          isLive
            ? "bg-gradient-to-r from-emerald-500/50 via-emerald-400/15 to-transparent"
            : "bg-border/20",
        )}
      />

      {/* Canvas area — dimmed when off-air (R3: keeps liveItem retained) */}
      <div
        className={cn(
          "relative flex min-h-0 flex-1 items-center justify-center p-2 transition-opacity duration-300",
          !isLive && "opacity-40",
        )}
      >
        {/* Live-state framing ring: green when on-air, red tint when off-air.
            No inner rounding — panel container is already rounded-md. */}
        <div
          className={cn(
            "pointer-events-none absolute inset-2 ring-1 transition-colors duration-300",
            isLive ? "ring-emerald-500/30" : "ring-white/5",
          )}
        />

        {/* R8: isolate logo slate — do not inline special-case in CanvasVerse */}
        {isLogoItem(liveItem) ? (
          <LogoSlateCanvas />
        ) : (
          <CanvasVerse theme={activeTheme} verse={liveSlide} fit="contain" />
        )}
      </div>

      {/* Action bar — 40px */}
      <div className="flex h-10 shrink-0 items-center gap-1.5 border-t border-border/60 bg-card/80 px-2">
        {/* Black Screen: setLive(false) — keeps liveItem for instant restore (R3) */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-[0.6875rem]"
          onClick={() => useBroadcastStore.getState().setLive(false)}
        >
          Black Screen
        </Button>

        {/* Rhema Logo: presentItem(RHEMA_LOGO_ITEM) — sets logo live + on-air (R3) */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-[0.6875rem]"
          onClick={() => useBroadcastStore.getState().presentItem(RHEMA_LOGO_ITEM)}
        >
          Rhema Logo
        </Button>

        <div className="flex-1" />

        {/* Clear: clearLive() — destructive, drops liveItem (R3) */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 px-2.5 text-[0.6875rem]",
            "text-red-400/70 hover:bg-red-500/10 hover:text-red-300",
          )}
          onClick={() => useBroadcastStore.getState().clearLive()}
        >
          Clear
        </Button>
      </div>
    </div>
  )
}
