/* eslint-disable react-refresh/only-export-components */
import "@/index.css"
import { useState, useEffect } from "react"
import { createRoot } from "react-dom/client"
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow"
import { BookOpen, Music2, Video } from "lucide-react"
import { CanvasVerse } from "@/components/ui/canvas-verse"
import type { StagePayload } from "@/lib/stage-payload"
import type { ContentKind } from "@/types/content"

// ── Helpers ───────────────────────────────────────────────────────────────────

const KIND_ICONS: Record<ContentKind, React.ReactNode> = {
  verse: <BookOpen size={20} aria-hidden />,
  lyrics: <Music2 size={20} aria-hidden />,
  media: <Video size={20} aria-hidden />,
}

function formatTime(d: Date): string {
  return (
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0") +
    ":" +
    String(d.getSeconds()).padStart(2, "0")
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "8px 18px 4px",
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: "0.22em",
        textTransform: "uppercase" as const,
        color: "rgba(251,191,36,0.4)",
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {children}
    </div>
  )
}

function EmptySlate({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        color: "rgba(255,255,255,0.12)",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.18em",
        textTransform: "uppercase" as const,
      }}
    >
      {text}
    </div>
  )
}

// ── Root component ────────────────────────────────────────────────────────────

function StageOutput() {
  const [payload, setPayload] = useState<StagePayload | null>(null)
  const [time, setTime] = useState(() => formatTime(new Date()))

  // Stage-update listener + initial handshake
  useEffect(() => {
    const win = getCurrentWebviewWindow()
    const unlistenPromise = win.listen<StagePayload>("broadcast:stage-update", (e) => {
      setPayload(e.payload)
    })
    void win.emitTo("main", "broadcast:stage-ready").catch(() => {})
    return () => {
      unlistenPromise.then((fn) => fn())
    }
  }, [])

  // Live clock — 1 s tick
  useEffect(() => {
    const id = setInterval(() => setTime(formatTime(new Date())), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      data-slot="stage-output"
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#000",
        overflow: "hidden",
        fontFamily:
          '"Geist Variable", "Inter Variable", "SF Pro Display", "Segoe UI Variable", system-ui, -apple-system, sans-serif',
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {/* ── CURRENT SLIDE (60 %) ─────────────────────────────────────── */}
      <div
        style={{
          height: "60%",
          display: "flex",
          flexDirection: "column",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <SectionLabel>Live</SectionLabel>

        {/* Canvas area: flex:1 + minHeight:0 so h-full resolves correctly */}
        <div style={{ flex: 1, minHeight: 0, padding: "4px 16px 12px" }}>
          {payload ? (
            <CanvasVerse
              theme={payload.theme}
              verse={payload.currentSlide}
              fit="contain"
            />
          ) : (
            <EmptySlate text="No content" />
          )}
        </div>
      </div>

      {/* ── NEXT UP (30 %) ───────────────────────────────────────────── */}
      <div
        style={{
          height: "30%",
          display: "flex",
          flexDirection: "column",
          /* amber left-border — the one warm mark in an otherwise monochrome layout */
          borderLeft: "3px solid rgba(251,191,36,0.3)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(255,255,255,0.016)",
        }}
      >
        <SectionLabel>Next Up</SectionLabel>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "0 20px 12px 17px",
            overflow: "hidden",
          }}
        >
          {payload?.nextItem ? (
            <>
              <span
                style={{
                  color: "rgba(255,255,255,0.3)",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {KIND_ICONS[payload.nextItem.kind]}
              </span>
              <span
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontSize: "clamp(18px, 2.8vh, 28px)",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  letterSpacing: "0.01em",
                  lineHeight: 1.2,
                }}
              >
                {payload.nextItem.title}
              </span>
            </>
          ) : (
            <EmptySlate text="Nothing queued" />
          )}
        </div>
      </div>

      {/* ── CLOCK (10 %) ─────────────────────────────────────────────── */}
      <div
        style={{
          height: "10%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
        }}
      >
        <span
          style={{
            fontFamily:
              '"Geist Mono", "Cascadia Code", "SF Mono", "Fira Mono", "Menlo", "Consolas", monospace',
            fontSize: "clamp(20px, 4.2vh, 48px)",
            fontWeight: 400,
            color: "rgba(226,232,240,0.88)",
            letterSpacing: "0.08em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {time}
        </span>
      </div>
    </div>
  )
}

createRoot(document.getElementById("stage-root")!).render(<StageOutput />)
