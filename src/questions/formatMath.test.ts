import { describe, it, expect } from "vitest";
import { formatMath, MULTIPLY_SYMBOL } from "./formatMath";

describe("formatMath", () => {
  it("shows multiplication as a dot", () => {
    expect(MULTIPLY_SYMBOL).toBe("·");
    expect(formatMath("x * -17 - 20 = 302")).toBe("x · -17 - 20 = 302");
    expect(formatMath("*")).toBe("·");
  });

  it("leaves division, minus and plus as they are", () => {
    expect(formatMath("x / 4 + 3 = 5")).toBe("x / 4 + 3 = 5");
    expect(formatMath("-8")).toBe("-8");
  });
});
