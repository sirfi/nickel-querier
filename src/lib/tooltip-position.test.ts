import { describe, it, expect } from "vitest";
import { placeTooltip, VIEWPORT_MARGIN } from "./tooltip-position";

const viewport = { width: 1280, height: 800 };
const tip = { width: 120, height: 22 };

describe("placeTooltip", () => {
  it("centres above the target when there is room", () => {
    const p = placeTooltip({ left: 300, top: 100, width: 60, height: 24 }, tip, viewport);
    expect(p).toEqual({ side: "top", left: 270, top: 100 - 6 - 22 });
  });

  it("flips below a target in the top bar (issue #16)", () => {
    const p = placeTooltip({ left: 600, top: 8, width: 60, height: 28 }, tip, viewport);
    expect(p.side).toBe("bottom");
    expect(p.top).toBe(8 + 28 + 6);
  });

  it("clamps at the right and left edges", () => {
    const right = placeTooltip({ left: 1250, top: 8, width: 24, height: 24 }, tip, viewport);
    expect(right.left + tip.width).toBeLessThanOrEqual(1280 - VIEWPORT_MARGIN);
    const left = placeTooltip({ left: 0, top: 300, width: 20, height: 20 }, tip, viewport);
    expect(left.left).toBe(VIEWPORT_MARGIN);
  });

  it("stays inside a tiny viewport", () => {
    const p = placeTooltip({ left: 10, top: 10, width: 20, height: 20 }, { width: 100, height: 60 }, { width: 200, height: 70 });
    expect(p.top).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);
    expect(p.left).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);
  });
});
