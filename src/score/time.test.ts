import { describe, it, expect } from "vitest";
import { secondsToMs, minutesToMs, hoursToMs, msToWholeSeconds } from "./time";

describe("time helpers", () => {
  it("convert seconds, minutes and hours to milliseconds", () => {
    expect(secondsToMs(60)).toBe(60_000);
    expect(minutesToMs(60)).toBe(3_600_000);
    expect(hoursToMs(1)).toBe(minutesToMs(60));
  });

  it("msToWholeSeconds rounds down", () => {
    expect(msToWholeSeconds(10_500)).toBe(10);
    expect(msToWholeSeconds(999)).toBe(0);
    expect(msToWholeSeconds(1000)).toBe(1);
  });
});
