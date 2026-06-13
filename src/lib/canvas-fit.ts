export type CanvasFitMode = "width" | "contain"

export interface FitInput {
  containerWidth: number
  containerHeight: number
  aspect: number // width / height
  mode: CanvasFitMode
}

export interface FitSize {
  width: number
  height: number
}

/** Compute display size (CSS px) for a fixed-aspect canvas inside a container. */
export function computeFitSize({ containerWidth, containerHeight, aspect, mode }: FitInput): FitSize {
  if (mode === "width" || containerHeight <= 0) {
    return { width: containerWidth, height: containerWidth / aspect }
  }
  const widthIfHeightBound = containerHeight * aspect
  if (widthIfHeightBound <= containerWidth) {
    return { width: widthIfHeightBound, height: containerHeight }
  }
  return { width: containerWidth, height: containerWidth / aspect }
}
