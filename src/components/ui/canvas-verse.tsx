import { useRef, useEffect, useState, useCallback, memo } from "react"
import { renderSlide } from "@/lib/verse-renderer"
import type { BroadcastTheme, Slide } from "@/types"
import { cn } from "@/lib/utils"
import { computeFitSize, type CanvasFitMode } from "@/lib/canvas-fit"

interface CanvasVerseProps {
  theme: BroadcastTheme
  verse: Slide | null
  className?: string
  fit?: CanvasFitMode
}

export const CanvasVerse = memo(function CanvasVerse({
  theme,
  verse,
  className,
  fit = "width",
}: CanvasVerseProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const [containerWidth, setContainerWidth] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)

  // Measure container width and height with ResizeObserver
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      if (rect.width > 0) setContainerWidth(rect.width)
      setContainerHeight(rect.height)
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || containerWidth === 0) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const aspectRatio = theme.resolution.width / theme.resolution.height
    const { width: displayW, height: displayH } = computeFitSize({
      containerWidth,
      containerHeight,
      aspect: aspectRatio,
      mode: fit,
    })
    if (displayW <= 0) return

    canvas.width = displayW * dpr
    canvas.height = displayH * dpr
    canvas.style.width = `${displayW}px`
    canvas.style.height = `${displayH}px`

    ctx.scale(dpr, dpr)
    const scale = displayW / theme.resolution.width
    renderSlide(ctx, theme, verse, {
      scale,
      imageCache: imageCacheRef.current,
    })
  }, [theme, verse, containerWidth, containerHeight, fit])

  // Preload background image so the renderer can find it in the cache.
  useEffect(() => {
    const bg = theme.background
    if (bg.type !== "image" || !bg.image?.url) return
    const url = bg.image.url
    const cache = imageCacheRef.current
    if (cache.has(url)) return

    const img = new Image()
    img.onload = () => {
      cache.set(url, img)
      draw()
    }
    img.onerror = () => {
      console.warn("[canvas-verse] failed to load background image", {
        url: url.slice(0, 100),
      })
    }
    img.src = url
  }, [theme.background, draw])

  // Redraw whenever theme, verse, or container size changes.
  useEffect(() => {
    draw()
  }, [draw])

  return (
    <div ref={containerRef} className={cn("flex h-full w-full items-center justify-center", className)}>
      <canvas ref={canvasRef} className="rounded-md" />
    </div>
  )
})
