import { useEffect, useState } from "react"
import type { ContentItem } from "@/types/content"
import { TopBar } from "@/components/shell/top-bar"
import { ServiceQueue } from "@/components/shell/service-queue"
import { PreviewStagingPanel } from "@/components/panels/preview-staging-panel"
import { LiveOutput } from "@/components/panels/live-output"
import { ContentBrowser } from "@/components/browser/content-browser"
import { VerseDetailPanel } from "@/components/panels/verse-detail-panel"

/**
 * Dashboard — Rhema presentation shell.
 *
 * Grid (1440×900 target, min 1280×800):
 *   Row 1: TopBar (56px, full width)
 *   Row 2: ServiceQueue (280px fixed) | [PreviewStaging / LiveOutput] over [ContentBrowser / VerseDetail]
 *
 * Staged-item state is owned here and threaded to all four content panels (R4).
 * Old AI-era panels (TransportBar, TranscriptPanel, DetectionsPanel, SearchPanel,
 * PreviewPanel, LiveOutputPanel, QueuePanel) are no longer mounted.
 */
export function Dashboard() {
  const [stagedItem, setStagedItem] = useState<ContentItem | null>(null)
  // R1: below 1280px the dense 2×2 right grid would clip; reflow to a single
  // scrollable column (Verse Detail drops under the Content Browser).
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 1280)
    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  return (
    <div
      style={{
        position: "fixed",
        inset: "0px",
        display: "grid",
        // Col 1: Service Queue (fixed). Col 2: right content area (fills remaining).
        gridTemplateColumns: "280px minmax(0, 1fr)",
        // Row 1: Top Bar. Row 2: main content (fills remaining height).
        gridTemplateRows: "56px minmax(0, 1fr)",
        overflow: "hidden",
      }}
      className="bg-background"
    >
      {/* ── Row 1: Top Bar (spans both columns) ─────────────────────────────── */}
      <div style={{ gridColumn: "1 / -1" }}>
        <TopBar />
      </div>

      {/* ── Row 2, Col 1: Service Queue ──────────────────────────────────────── */}
      <div
        className="min-h-0 overflow-hidden"
        style={{ padding: "8px 4px 8px 8px" }}
      >
        <ServiceQueue onPresent={setStagedItem} />
      </div>

      {/* ── Row 2, Col 2: Four content panels in a 2×2 sub-grid ─────────────── */}
      {/*   Top row:    PreviewStaging (55%) | LiveOutput (45%)                  */}
      {/*   Bottom row: ContentBrowser (55%) | VerseDetail (45%)                 */}
      <div
        className="min-h-0"
        style={{
          display: "grid",
          gridTemplateColumns: narrow ? "minmax(0, 1fr)" : "55fr 45fr",
          gridTemplateRows: narrow ? "auto" : "240px minmax(0, 1fr)",
          gridAutoRows: narrow ? "minmax(220px, auto)" : undefined,
          gap: "8px",
          padding: "8px 8px 8px 4px",
          overflowX: "hidden",
          overflowY: narrow ? "auto" : "hidden",
        }}
      >
        <PreviewStagingPanel
          stagedItem={stagedItem}
          setStagedItem={setStagedItem}
        />
        <LiveOutput />
        <ContentBrowser setStagedItem={setStagedItem} />
        <VerseDetailPanel
          stagedItem={stagedItem}
          setStagedItem={setStagedItem}
        />
      </div>
    </div>
  )
}
