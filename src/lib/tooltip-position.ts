// ============================================================
// Nickel Querier — Tooltip placement (pure, unit tested)
// ============================================================

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Placement {
  left: number;
  top: number;
  side: "top" | "bottom";
}

/** Gap between target and tooltip, and minimum distance to the window edge. */
export const TOOLTIP_GAP = 6;
export const VIEWPORT_MARGIN = 8;

/**
 * Place a tooltip above the target, or below it when there is not enough room
 * above (e.g. the top bar). Horizontally centred on the target but clamped so
 * the whole tooltip stays inside the viewport.
 */
export function placeTooltip(target: Rect, tip: Size, viewport: Size): Placement {
  const above = target.top - TOOLTIP_GAP - tip.height;
  const below = target.top + target.height + TOOLTIP_GAP;
  const fitsAbove = above >= VIEWPORT_MARGIN;
  const fitsBelow = below + tip.height <= viewport.height - VIEWPORT_MARGIN;
  // Prefer above; fall back to below; if neither fits use the side with more room.
  const side: Placement["side"] =
    fitsAbove || (!fitsBelow && target.top > viewport.height - (target.top + target.height))
      ? "top"
      : "bottom";
  const rawTop = side === "top" ? above : below;
  const top = Math.max(VIEWPORT_MARGIN, Math.min(rawTop, viewport.height - VIEWPORT_MARGIN - tip.height));

  const centred = target.left + target.width / 2 - tip.width / 2;
  const maxLeft = viewport.width - VIEWPORT_MARGIN - tip.width;
  const left = Math.max(VIEWPORT_MARGIN, Math.min(centred, maxLeft));
  return { left, top, side };
}
