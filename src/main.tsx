import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { invoke } from "@tauri-apps/api/core"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { TooltipProvider } from "@/components/ui/tooltip.tsx"
import { hydrateSettings } from "@/stores/settings-store"
import { hydrateBibleStore, initBiblePersistence } from "@/stores/bible-store"
import { hydrateBroadcastThemes } from "@/stores/broadcast-store"

// Install the dev Bible bridge BEFORE the first invoke() so every IPC call is
// intercepted. Guard: DEV build + browser context + NOT inside a real Tauri
// webview. In production Vite replaces import.meta.env.DEV with false and
// dead-code-eliminates this block entirely — tauri-bridge.ts is never bundled.
if (
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  !("__TAURI_INTERNALS__" in window)
) {
  const { installDevTauriBridge } = await import("./dev/tauri-bridge.ts")
  installDevTauriBridge()
}

// Webview reloads do NOT restart the Rust backend, so any STT pipeline
// left running from the previous webview session still has
// `stt_active = true`. That makes the next `start_transcription` call
// fail silently with "Transcription is already running". Reset the
// backend to a clean state on boot, then hydrate persisted settings and
// bible store so the UI reflects the user's choices immediately.
invoke("stop_transcription")
  .catch(() => {})
  .then(() => Promise.all([hydrateSettings(), hydrateBibleStore(), hydrateBroadcastThemes()]))
  .then(() => initBiblePersistence())
  .finally(() => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <ThemeProvider defaultTheme="dark">
          <TooltipProvider>
            <App />
          </TooltipProvider>
        </ThemeProvider>
      </StrictMode>
    )
  })
