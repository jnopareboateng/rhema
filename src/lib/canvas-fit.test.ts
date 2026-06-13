import { describe, expect, it } from "vitest"
import { computeFitSize } from "./canvas-fit"

describe("computeFitSize", () => {
  const aspect = 16 / 9
  it("contain mode is bounded by height when the row is short", () => {
    const { width, height } = computeFitSize({ containerWidth: 800, containerHeight: 200, aspect, mode: "contain" })
    expect(height).toBeCloseTo(200, 0)
    expect(width).toBeCloseTo(200 * aspect, 0)
  })
  it("contain mode is bounded by width when the row is tall", () => {
    const { width, height } = computeFitSize({ containerWidth: 400, containerHeight: 999, aspect, mode: "contain" })
    expect(width).toBeCloseTo(400, 0)
    expect(height).toBeCloseTo(400 / aspect, 0)
  })
  it("width mode always fills width", () => {
    const { width, height } = computeFitSize({ containerWidth: 400, containerHeight: 50, aspect, mode: "width" })
    expect(width).toBeCloseTo(400, 0)
    expect(height).toBeCloseTo(400 / aspect, 0)
  })
  it("returns {0,0} for aspect=0 (degenerate guard)", () => {
    const result = computeFitSize({ containerWidth: 400, containerHeight: 200, aspect: 0, mode: "contain" })
    expect(result).toEqual({ width: 0, height: 0 })
  })
})
