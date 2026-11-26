import { describe, it, expect } from "vitest";
import { formatMath, MULTIPLY_SYMBOL } from "./formatMath";

describe("formatMath", () => {
  it("writes a number times x number first, like in class", () => {
    expect(formatMath("x * 3 + 4 = 25")).toBe("3x + 4 = 25");
    expect(formatMath("x * -17 - 20 = 302")).toBe("-17x - 20 = 302");
    expect(formatMath("x * 5 + 4 = 25 + x * 2")).toBe("5x + 4 = 25 + 2x");
    expect(formatMath("x * 3/4 = 6")).toBe("3/4x = 6");
  });

  it("shows any other multiplication as a dot", () => {
    expect(MULTIPLY_SYMBOL).toBe("·");
    expect(formatMath("-3 * 4")).toBe("-3 · 4");
    expect(formatMath("*")).toBe("·");
  });

  it("leaves division, minus and plus as they are", () => {
    expect(formatMath("x / 4 + 3 = 5")).toBe("x / 4 + 3 = 5");
    expect(formatMath("-8")).toBe("-8");
  });
});
