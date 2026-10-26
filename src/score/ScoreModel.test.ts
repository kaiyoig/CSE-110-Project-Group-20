import { describe, it, expect } from "vitest";
import { ScoreModel } from "./ScoreModel";

const HOUR = 60 * 60 * 1000;

describe("ScoreModel", () => {
  it("starts with 1 hour, no money, nothing solved", () => {
    const m = new ScoreModel();
    expect(m.getTimeRemainingMs()).toBe(HOUR);
    expect(m.getMoney()).toBe(0);
    expect(m.getRoomsSolved()).toBe(0);
    expect(m.getDifficulty()).toBe("easy");
  });

  it("rejects an invalid time limit or difficulty", () => {
    expect(() => new ScoreModel({ timeLimitMs: 0 })).toThrow(RangeError);
    expect(() => new ScoreModel({ timeLimitMs: NaN })).toThrow(RangeError);
    // @ts-expect-error testing a bad value on purpose
    expect(() => new ScoreModel({ difficulty: "insane" })).toThrow(RangeError);
  });

  it("uses multipliers 1 / 3 / 6", () => {
    expect(new ScoreModel({ difficulty: "easy" }).getMultiplier()).toBe(1);
    expect(new ScoreModel({ difficulty: "medium" }).getMultiplier()).toBe(3);
    expect(new ScoreModel({ difficulty: "hard" }).getMultiplier()).toBe(6);
  });

  it("main room gives $100 × multiplier, bonus room $300 × multiplier", () => {
    const m = new ScoreModel({ difficulty: "medium" });
    expect(m.recordRoomSolved("main")).toBe(300);
    expect(m.recordRoomSolved("bonus")).toBe(900);
    expect(m.getMoney()).toBe(1200);
  });

  it("bonus rooms count as 3 correct answers", () => {
    const m = new ScoreModel();
    for (let i = 0; i < 12; i++) m.recordRoomSolved("main");
    m.recordRoomSolved("bonus");
    m.recordRoomSolved("bonus");
    expect(m.getRoomsSolved()).toBe(14);
    expect(m.getWeightedCorrect()).toBe(12 + 3 + 3);
  });

  it("subtracting one second leaves exactly one second less", () => {
    const m = new ScoreModel();
    const before = m.getTimeRemainingMs();
    m.removeTime(1000);
    expect(m.getTimeRemainingMs()).toBe(before - 1000);
    expect(m.getTimeSpentMs()).toBe(1000);
  });

  it.each([-1, NaN, Infinity])("rejects invalid time amount %s", (bad) => {
    const m = new ScoreModel();
    expect(() => m.removeTime(bad)).toThrow(RangeError);
    expect(m.getTimeRemainingMs()).toBe(HOUR);
  });

  it("never goes below zero time; running out means caught", () => {
    const m = new ScoreModel({ timeLimitMs: 5000 });
    m.removeTime(9000);
    expect(m.getTimeRemainingMs()).toBe(0);
    expect(m.isCaught()).toBe(true);
  });

  describe("calculateScore", () => {
    it("= multiplier × weighted correct × seconds left (with a wrong answer)", () => {
      const m = new ScoreModel({ difficulty: "hard" });
      for (let i = 0; i < 12; i++) m.recordRoomSolved("main");
      m.recordRoomSolved("bonus");
      m.recordIncorrect(0);
      m.removeTime(HOUR - 1000 * 1000); // 1000 s left
      expect(m.calculateScore()).toBe(6 * 15 * 1000);
    });

    it("gives ×1.2 for a flawless run", () => {
      const m = new ScoreModel();
      for (let i = 0; i < 12; i++) m.recordRoomSolved("main");
      m.removeTime(HOUR - 1000 * 1000);
      expect(m.isFlawless()).toBe(true);
      expect(m.calculateScore()).toBe(Math.round(1 * 12 * 1000 * 1.2));
    });

    it("loses the flawless bonus after one wrong answer", () => {
      const m = new ScoreModel();
      m.recordRoomSolved("main");
      m.recordIncorrect(60_000);
      expect(m.isFlawless()).toBe(false);
      expect(m.getIncorrectAnswers()).toBe(1);
      expect(m.getTimeRemainingMs()).toBe(HOUR - 60_000);
    });

    it("is not flawless with nothing solved", () => {
      expect(new ScoreModel().isFlawless()).toBe(false);
    });

    it("is 0 when caught", () => {
      const m = new ScoreModel({ difficulty: "hard" });
      for (let i = 0; i < 11; i++) m.recordRoomSolved("main");
      m.removeTime(HOUR);
      expect(m.calculateScore()).toBe(0);
    });

    it("ignores partial seconds", () => {
      const m = new ScoreModel({ timeLimitMs: 10_500 });
      m.recordRoomSolved("main");
      m.recordIncorrect(0);
      expect(m.calculateScore()).toBe(10);
    });
  });

  it("snapshot includes everything the end screen needs", () => {
    const m = new ScoreModel({ difficulty: "medium" });
    m.recordRoomSolved("bonus");
    const s = m.snapshot();
    expect(s.money).toBe(900);
    expect(s.weightedCorrect).toBe(3);
    expect(s.flawless).toBe(true);
    expect(s.caught).toBe(false);
    expect(s.score).toBe(m.calculateScore());
  });
});
