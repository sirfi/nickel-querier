import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { placeTooltip } from "../lib/tooltip-position";

const SHOW_DELAY_MS = 350;

function isKeyboardFocus(el: Element): boolean {
  try {
    return el.matches(":focus-visible");
  } catch {
    return false; // selector unsupported (older engines, test DOMs)
  }
}
const TOOLTIP_ID = "nq-tooltip";

/**
 * One tooltip for every element with a `data-tooltip` attribute.
 *
 * Rendered in a fixed-position layer on <body>, so it is never clipped by a
 * panel and never leaves the window: it flips below the target when there is
 * no room above (top bar) and is clamped to the viewport edges (issue #16).
 * Shown on hover and on keyboard focus; Escape, scrolling or clicking hide it.
 */
export default function TooltipLayer() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [text, setText] = useState("");
  const [pos, setPos] = useState<{ left: number; top: number; side: string } | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const tooltipTarget = (node: EventTarget | null) =>
      node instanceof Element ? (node.closest("[data-tooltip]") as HTMLElement | null) : null;

    const show = (el: HTMLElement, delay: number) => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        const t = el.getAttribute("data-tooltip");
        if (!t || !el.isConnected) return;
        setText(t);
        setPos(null);
        setTarget(el);
      }, delay);
    };
    const hide = () => {
      window.clearTimeout(timer.current);
      setTarget(null);
    };

    const onOver = (e: PointerEvent) => {
      const el = tooltipTarget(e.target);
      if (el) show(el, SHOW_DELAY_MS);
    };
    const onOut = (e: PointerEvent) => {
      const from = tooltipTarget(e.target);
      const to = tooltipTarget(e.relatedTarget);
      if (from && from !== to) hide();
    };
    const onFocusIn = (e: FocusEvent) => {
      const el = tooltipTarget(e.target);
      // Only for keyboard focus, not for the focus a mouse click gives
      if (el && isKeyboardFocus(el)) show(el, 0);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", hide);
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    window.addEventListener("blur", hide);
    return () => {
      window.clearTimeout(timer.current);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("pointerdown", hide, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
      window.removeEventListener("blur", hide);
    };
  }, []);

  // Measure the rendered tooltip, then place it.
  useLayoutEffect(() => {
    if (!target || !tipRef.current) return;
    const r = target.getBoundingClientRect();
    const t = tipRef.current.getBoundingClientRect();
    setPos(
      placeTooltip(
        { left: r.left, top: r.top, width: r.width, height: r.height },
        { width: t.width, height: t.height },
        { width: window.innerWidth, height: window.innerHeight }
      )
    );
  }, [target, text]);

  // Let assistive technology read the tooltip as the target's description.
  useEffect(() => {
    if (!target) return;
    const previous = target.getAttribute("aria-describedby");
    target.setAttribute("aria-describedby", previous ? `${previous} ${TOOLTIP_ID}` : TOOLTIP_ID);
    return () => {
      if (previous) target.setAttribute("aria-describedby", previous);
      else target.removeAttribute("aria-describedby");
    };
  }, [target]);

  if (!target) return null;
  return createPortal(
    <div
      ref={tipRef}
      id={TOOLTIP_ID}
      role="tooltip"
      className={`nq-tooltip${pos ? ` nq-tooltip-${pos.side}` : ""}`}
      style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: "hidden" }}
    >
      {text}
    </div>,
    document.body
  );
}
