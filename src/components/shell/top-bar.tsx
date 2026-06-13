import { useState, useEffect, useRef } from "react"
import { invoke } from "@tauri-apps/api/core"
import { useBroadcastStore } from "@/stores"
import { SettingsDialog } from "@/components/settings-dialog"
import { ThemeDesigner } from "@/components/broadcast/theme-designer"
import { BroadcastSettings } from "@/components/broadcast/broadcast-settings"
import { UserIcon, MonitorIcon, TvIcon, PaletteIcon, CastIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function TopBar() {
  const isLive = useBroadcastStore((s) => s.isLive)
  const [serviceName, setServiceName] = useState("Sunday Service")
  const [isEditingName, setIsEditingName] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [mainOpened, setMainOpened] = useState(false)
  const [stageOpened, setStageOpened] = useState(false)
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (isEditingName) inputRef.current?.focus()
  }, [isEditingName])

  const clockTime = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const sessionDate = now.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  function handleOpenMain() {
    invoke("open_broadcast_window", { outputId: "main", monitorIndex: 0 })
      .then(() => setMainOpened(true))
      .catch(() => {})
  }

  function handleOpenStage() {
    invoke("open_stage_window", { monitorIndex: 0 })
      .then(() => setStageOpened(true))
      .catch(() => {})
  }

  return (
    <div
      data-slot="top-bar"
      className="flex h-14 items-center border-b border-border bg-card px-4 gap-3 shrink-0"
    >
      {/* Zone: Left — Branding */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-foreground shrink-0">
          <span className="text-xs font-black text-background leading-none select-none">R</span>
        </div>
        <div className="flex flex-col leading-none gap-0.5">
          <span className="text-sm font-bold tracking-tight text-foreground leading-none">
            Rhema
          </span>
          <span className="text-[0.5625rem] uppercase tracking-widest text-muted-foreground leading-none">
            Presentation
          </span>
        </div>
      </div>

      <div className="h-5 w-px bg-border shrink-0" />

      {/* Zone: Center-left — Service name + live clock */}
      <div className="flex flex-col gap-0.5 shrink-0">
        {isEditingName ? (
          <input
            ref={inputRef}
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            onBlur={() => setIsEditingName(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") {
                e.preventDefault()
                setIsEditingName(false)
              }
            }}
            className="text-sm font-semibold bg-transparent border-b border-primary/60 outline-none text-foreground leading-none w-40"
          />
        ) : (
          <button
            onClick={() => setIsEditingName(true)}
            className="text-sm font-semibold text-foreground hover:text-primary text-left leading-none cursor-text"
            title="Click to rename service"
          >
            {serviceName}
          </button>
        )}
        <div className="flex items-center gap-1.5 text-[0.6rem] text-muted-foreground leading-none">
          <span className="font-mono tabular-nums">{clockTime}</span>
          <span className="opacity-30">·</span>
          <span>{sessionDate}</span>
        </div>
      </div>

      {/* Zone: Center — Output status pills */}
      <div className="flex items-center gap-2 mx-auto">
        <button
          onClick={handleOpenMain}
          className={cn(
            "flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-3 py-1.5 text-[0.6875rem]",
            "transition-colors hover:bg-muted hover:border-border/80",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors shrink-0",
              mainOpened
                ? "bg-emerald-500 shadow-[0_0_4px_rgba(52,211,153,0.6)]"
                : "bg-muted-foreground/30",
            )}
          />
          <MonitorIcon className="size-3 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Main Screen</span>
        </button>
        <button
          onClick={handleOpenStage}
          className={cn(
            "flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-3 py-1.5 text-[0.6875rem]",
            "transition-colors hover:bg-muted hover:border-border/80",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors shrink-0",
              stageOpened
                ? "bg-emerald-500 shadow-[0_0_4px_rgba(52,211,153,0.6)]"
                : "bg-muted-foreground/30",
            )}
          />
          <TvIcon className="size-3 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Stage Display</span>
        </button>
      </div>

      {/* Zone: Right — Global dialogs + User + ON AIR */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon-sm"
          title="Broadcast Settings"
          onClick={() => setBroadcastOpen(true)}
        >
          <CastIcon className="size-3.5" />
        </Button>
        {/* BroadcastSettings portal — preserved from TransportBar */}
        <BroadcastSettings open={broadcastOpen} onOpenChange={setBroadcastOpen} />

        <Button
          variant="ghost"
          size="icon-sm"
          title="Theme Designer"
          onClick={() => useBroadcastStore.getState().setDesignerOpen(true)}
        >
          <PaletteIcon className="size-3.5" />
        </Button>
        {/* ThemeDesigner portal — preserved from TransportBar */}
        <ThemeDesigner />

        {/* SettingsDialog — preserved from TransportBar */}
        <SettingsDialog />

        <Button
          variant="ghost"
          size="icon-sm"
          title="User account"
          aria-label="User account"
        >
          <UserIcon className="size-3.5" />
        </Button>

        <div className="h-5 w-px bg-border mx-1 shrink-0" />

        {/* ON AIR toggle */}
        <button
          onClick={() => useBroadcastStore.getState().setLive(!isLive)}
          className={cn(
            "flex h-7 min-w-[72px] items-center justify-center gap-1.5 rounded px-3",
            "text-[0.6875rem] font-bold uppercase tracking-wider transition-all",
            isLive
              ? "bg-red-600 text-white shadow-[0_0_12px_rgba(220,38,38,0.35)] hover:bg-red-700"
              : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
          aria-label={isLive ? "On air — click to go off air" : "Off air — click to go live"}
        >
          {isLive ? (
            <>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              ON AIR
            </>
          ) : (
            "GO LIVE"
          )}
        </button>
      </div>
    </div>
  )
}
