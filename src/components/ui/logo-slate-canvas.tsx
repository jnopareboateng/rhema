import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * LogoSlateCanvas — holds the Rhema branding slate.
 *
 * Renders a solid-black 16:9 surface with the /rhema.svg logo centered at
 * ~40% of the surface width. Fills its container; no store coupling, no
 * canvas/renderer — a plain <img> on black, suitable for the live-output
 * panel's "Logo" holding state (design resolution R8).
 */
function LogoSlateCanvas({ className }: { className?: string }) {
  return (
    <div
      data-slot="logo-slate"
      className={cn("flex h-full w-full items-center justify-center", className)}
    >
      <div
        className={cn(
          // 16:9 surface, constrained to its flex parent
          "aspect-video w-full",
          // Visual treatment — glassy dark aesthetic matching bg-card panels
          "overflow-hidden rounded-md bg-black",
          "border border-border/40",
          "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]",
          // Center the logo
          "flex items-center justify-center",
        )}
      >
        <img
          src="/rhema.svg"
          alt="Rhema"
          className="w-[40%] object-contain select-none"
          draggable={false}
        />
      </div>
    </div>
  )
}

export { LogoSlateCanvas }
