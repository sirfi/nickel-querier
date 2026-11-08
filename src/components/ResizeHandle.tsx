import { useRef } from "react";

interface Props {
  orientation: "horizontal" | "vertical";
  /** Called with the pointer position (clientY for horizontal, clientX for vertical). */
  onDrag: (position: number) => void;
  /** Keyboard nudge: -1 / +1 */
  onStep: (direction: -1 | 1) => void;
  onReset: () => void;
  className?: string;
  label: string;
}

/** A draggable separator (pointer + keyboard accessible). */
export default function ResizeHandle({ orientation, onDrag, onStep, onReset, className, label }: Props) {
  const dragging = useRef(false);
  const horizontal = orientation === "horizontal";

  return (
    <div
      className={className}
      role="separator"
      aria-orientation={horizontal ? "horizontal" : "vertical"}
      aria-label={label}
      tabIndex={0}
      title={`${label} — drag to resize, double-click to reset`}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        document.body.classList.add(horizontal ? "is-resizing-row" : "is-resizing-col");
        e.preventDefault();
      }}
      onPointerMove={(e) => {
        if (dragging.current) onDrag(horizontal ? e.clientY : e.clientX);
      }}
      onPointerUp={(e) => {
        dragging.current = false;
        e.currentTarget.releasePointerCapture?.(e.pointerId);
        document.body.classList.remove("is-resizing-row", "is-resizing-col");
      }}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        const back = horizontal ? "ArrowUp" : "ArrowLeft";
        const fwd = horizontal ? "ArrowDown" : "ArrowRight";
        if (e.key === back) { onStep(-1); e.preventDefault(); }
        if (e.key === fwd) { onStep(1); e.preventDefault(); }
      }}
    />
  );
}
