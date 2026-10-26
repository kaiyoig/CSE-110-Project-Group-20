import { describe, it, expect } from "vitest";
import { formatTime, formatMoney } from "./format";

describe("formatTime", () => {
  it("formats as hh:mm:ss", () => {
    expect(formatTime(3_725_000)).toBe("01:02:05");
    expect(formatTime(59_000)).toBe("00:00:59");
  });
  it("rounds partial seconds up so 0 only shows when time is really up", () => {
    expect(formatTime(500)).toBe("00:00:01");
    expect(formatTime(0)).toBe("00:00:00");
  });
  it("handles invalid input", () => {
    expect(formatTime(-1000)).toBe("00:00:00");
    expect(formatTime(NaN)).toBe("00:00:00");
  });
});

describe("formatMoney", () => {
  it("formats as $ amount", () => {
    expect(formatMoney(1234.5)).toBe("$1,234.50");
    expect(formatMoney(0)).toBe("$0.00");
  });
  it.each([-50, NaN, Infinity])("shows $0.00 for invalid input %s", (bad) => {
    expect(formatMoney(bad)).toBe("$0.00");
  });
});
