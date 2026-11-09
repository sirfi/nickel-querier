import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import TooltipLayer from "../TooltipLayer";

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(window, "innerWidth", { value: 1280, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function setup() {
  render(
    <>
      <button data-tooltip="Switch to light theme">☀</button>
      <TooltipLayer />
    </>
  );
  const btn = screen.getByRole("button");
  // A button in the top-right corner of the window, like the theme toggle
  btn.getBoundingClientRect = () => ({ left: 1240, top: 8, width: 28, height: 28, right: 1268, bottom: 36, x: 1240, y: 8, toJSON: () => ({}) });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this === btn) return btn.getBoundingClientRect();
    return { left: 0, top: 0, width: 150, height: 22, right: 150, bottom: 22, x: 0, y: 0, toJSON: () => ({}) };
  });
  return btn;
}

describe("TooltipLayer (issue #16)", () => {
  it("keeps a top-right tooltip inside the window", () => {
    const btn = setup();
    fireEvent.pointerOver(btn);
    act(() => void vi.advanceTimersByTime(400));
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toBe("Switch to light theme");
    const left = parseFloat(tip.style.left);
    const top = parseFloat(tip.style.top);
    expect(top).toBeGreaterThan(36); // below the button, not above the window
    expect(left + 150).toBeLessThanOrEqual(1280 - 8);
    expect(btn.getAttribute("aria-describedby")).toBe("nq-tooltip");
  });

  it("hides on pointer out and on Escape", () => {
    const btn = setup();
    fireEvent.pointerOver(btn);
    act(() => void vi.advanceTimersByTime(400));
    fireEvent.pointerOut(btn, { relatedTarget: document.body });
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(btn.hasAttribute("aria-describedby")).toBe(false);

    fireEvent.pointerOver(btn);
    act(() => void vi.advanceTimersByTime(400));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("does not show when the pointer leaves before the delay", () => {
    const btn = setup();
    fireEvent.pointerOver(btn);
    fireEvent.pointerOut(btn, { relatedTarget: document.body });
    act(() => void vi.advanceTimersByTime(400));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
