/**
 * DEV-ONLY: Browser-side shim that intercepts Tauri `invoke()` calls and
 * routes Bible commands to the local HTTP bridge (localhost:8765).
 *
 * All other Tauri commands (window management, NDI, transcription, event
 * plugin) return safe no-ops so the app renders without throwing.
 *
 * Activation guard (applied in src/main.tsx before the first invoke):
 *   import.meta.env.DEV          — Vite dev mode only; statically false in prod
 *   typeof window !== "undefined" — browser context, not SSR/Node
 *   !("__TAURI_INTERNALS__" in window) — NOT inside a real Tauri webview
 *
 * In production builds Vite replaces import.meta.env.DEV with `false`,
 * dead-code-eliminates the dynamic import of this file, and it is never
 * included in the bundle.
 */
import { mockIPC } from "@tauri-apps/api/mocks"

const BRIDGE_URL = "http://localhost:8765/invoke"

const BIBLE_COMMANDS = new Set([
  "list_translations",
  "list_books",
  "get_chapter",
  "get_verse",
  "search_verses",
  "semantic_search",
  "get_cross_references",
  "set_active_translation",
])

export function installDevTauriBridge(): void {
  mockIPC(async (cmd, payload) => {
    // ── Bible commands → HTTP bridge ─────────────────────────────────────
    if (BIBLE_COMMANDS.has(cmd)) {
      const res = await fetch(BRIDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd, args: payload ?? {} }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`[dev-bridge] ${cmd} failed (${res.status}): ${text}`)
      }
      return res.json() as Promise<unknown>
    }

    // ── Tauri event plugin — fake a numeric listener id ──────────────────
    // listen() and once() both resolve to an unlisten function keyed by id.
    if (cmd.startsWith("plugin:event")) {
      return 1
    }

    // ── Window management + NDI + transcription — silent no-ops ─────────
    switch (cmd) {
      case "open_stage_window":
      case "open_broadcast_window":
      case "ensure_broadcast_window":
      case "close_broadcast_window":
      case "start_ndi":
      case "stop_ndi":
      case "push_ndi_frame":
      case "stop_transcription":
      case "start_transcription":
        return null

      case "get_ndi_status":
        return null

      case "list_monitors":
        return []

      default:
        console.warn(`[dev-bridge] Unhandled Tauri command: ${cmd}`)
        return null
    }
  })
}
