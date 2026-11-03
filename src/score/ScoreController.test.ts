import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ScoreModel } from "./ScoreModel";
import { ScoreController, WRONG_ANSWER_PENALTY_SECONDS } from "./ScoreController";

describe("ScoreController", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const make = (timeLimitMs = 10_000) => new ScoreController(new ScoreModel({ timeLimitMs }));
  const remaining = (c: ScoreController) => c.getModel().getTimeRemainingMs();

  it("does not count down on the map", () => {
    const c = make();
    vi.advanceTimersByTime(5000);
    expect(remaining(c)).toBe(10_000);
    expect(c.isRunning()).toBe(false);
  });

  it("counts down inside a room", () => {
    const c = make();
    c.enterRoom();
    vi.advanceTimersByTime(3000);
    expect(remaining(c)).toBe(7000);
  });

  it("pauses when returning to the map and resumes in the next room", () => {
    const c = make();
    c.enterRoom();
    vi.advanceTimersByTime(2000);
    c.returnToMap();
    vi.advanceTimersByTime(5000);
    expect(remaining(c)).toBe(8000);

    c.enterRoom();
    vi.advanceTimersByTime(1000);
    expect(remaining(c)).toBe(7000);
  });

  it("counts partial seconds when leaving a room mid-tick", () => {
    const c = make();
    c.enterRoom();
    vi.advanceTimersByTime(1500);
    c.returnToMap();
    expect(remaining(c)).toBe(8500);
  });

  it("entering a room twice does not double the speed", () => {
    const c = make();
    c.enterRoom();
    c.enterRoom();
    vi.advanceTimersByTime(2000);
    expect(remaining(c)).toBe(8000);
  });

  it("wrong answer takes off the default penalty", () => {
    const c = make(600_000);
    c.answerIncorrect();
    expect(remaining(c)).toBe(600_000 - WRONG_ANSWER_PENALTY_SECONDS * 1000);
    expect(c.getModel().getIncorrectAnswers()).toBe(1);
  });

  it("solving a room adds money and notifies listeners", () => {
    const c = new ScoreController(new ScoreModel({ difficulty: "hard" }));
    const listener = vi.fn();
    c.onChange(listener);
    expect(c.roomSolved("main")).toBe(600);
    expect(c.roomSolved("bonus")).toBe(1800);
    expect(c.getModel().getMoney()).toBe(2400);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("fires onTimeUp once and stops the clock", () => {
    const c = make(3000);
    const timeUp = vi.fn();
    c.onTimeUp(timeUp);
    c.enterRoom();
    vi.advanceTimersByTime(5000);
    expect(timeUp).toHaveBeenCalledTimes(1);
    expect(c.isRunning()).toBe(false);
    expect(remaining(c)).toBe(0);
  });

  it("fires onTimeUp when a penalty uses up the last of the time", () => {
    const c = make(2000);
    const timeUp = vi.fn();
    c.onTimeUp(timeUp);
    c.answerIncorrect(5);
    expect(timeUp).toHaveBeenCalledTimes(1);
  });

  describe("pauseWhenHidden", () => {
    const fakeDoc = () => {
      let hidden = false;
      const target = new EventTarget();
      Object.defineProperty(target, "hidden", { get: () => hidden });
      const doc = target as unknown as Document;
      const setHidden = (value: boolean) => {
        hidden = value;
        doc.dispatchEvent(new Event("visibilitychange"));
      };
      return { doc, setHidden };
    };

    it("pauses in a room while the tab is hidden", () => {
      const c = make();
      const { doc, setHidden } = fakeDoc();
      c.pauseWhenHidden(doc);
      c.enterRoom();
      vi.advanceTimersByTime(1000);

      setHidden(true);
      vi.advanceTimersByTime(5000);
      expect(remaining(c)).toBe(9000);

      setHidden(false);
      vi.advanceTimersByTime(1000);
      expect(remaining(c)).toBe(8000);
    });

    it("does not start the clock when the tab comes back on the map", () => {
      const c = make();
      const { doc, setHidden } = fakeDoc();
      c.pauseWhenHidden(doc);
      setHidden(true);
      setHidden(false);
      vi.advanceTimersByTime(3000);
      expect(remaining(c)).toBe(10_000);
    });

    it("entering a room while the tab is hidden waits until it is visible", () => {
      const c = make();
      const { doc, setHidden } = fakeDoc();
      c.pauseWhenHidden(doc);
      setHidden(true);
      c.enterRoom();
      vi.advanceTimersByTime(3000);
      expect(remaining(c)).toBe(10_000);
    });
  });
});
