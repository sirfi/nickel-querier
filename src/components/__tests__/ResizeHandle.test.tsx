import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import ResizeHandle from "../ResizeHandle";

afterEach(cleanup);

describe("ResizeHandle", () => {
  it("ends the drag on pointercancel", () => {
    const onDrag = vi.fn();
    render(
      <ResizeHandle orientation="horizontal" label="split" onDrag={onDrag} onStep={() => {}} onReset={() => {}} />
    );
    const h = screen.getByRole("separator");
    fireEvent.pointerDown(h, { pointerId: 1 });
    expect(document.body.classList.contains("is-resizing-row")).toBe(true);
    fireEvent.pointerCancel(h, { pointerId: 1 });
    expect(document.body.classList.contains("is-resizing-row")).toBe(false);
    fireEvent.pointerMove(h, { clientY: 100 });
    expect(onDrag).not.toHaveBeenCalled();
  });
});
