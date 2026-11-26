import { describe, it, expect } from "vitest";
import { ScoreModel, Difficulty, DIFFICULTY_LABEL, DEFAULT_TIME_LIMIT_MINUTES, TIME_LIMIT_MINUTES, isDifficultyType } from "./ScoreModel";

const MINUTE = 60 * 1000;
const EASY = 10 * MINUTE;

describe("ScoreModel", () => {
  it("starts with Easy's 10 minutes, no money, nothing solved", () => {
    const m = new ScoreModel();
    expect(m.getTimeRemainingMs()).toBe(EASY);
    expect(m.getMoney()).toBe(0);
    expect(m.getRoomsSolved()).toBe(0);
    expect(m.getDifficulty()).toBe(Difficulty.Easy);
  });

  it("rejects an invalid time limit or difficulty", () => {
    expect(() => new ScoreModel({ timeLimitMs: 0 })).toThrow(RangeError);
    expect(() => new ScoreModel({ timeLimitMs: NaN })).toThrow(RangeError);
    expect(() => new ScoreModel({ difficulty: 3 as Difficulty })).toThrow(RangeError);
    expect(() => new ScoreModel({ difficulty: -1 as Difficulty })).toThrow(RangeError);
  });

  it("difficulty numbers match getQuestion: 0 easy, 1 medium, 2 hard", () => {
    expect(Difficulty.Easy).toBe(0);
    expect(Difficulty.Medium).toBe(1);
    expect(Difficulty.Hard).toBe(2);
  });

  it("gives each Difficulty its own clock: Easy 10, Medium 30, Hard 50 minutes", () => {
    expect(TIME_LIMIT_MINUTES).toEqual({
      [Difficulty.Easy]: 10,
      [Difficulty.Medium]: 30,
      [Difficulty.Hard]: 50,
    });
    expect(DEFAULT_TIME_LIMIT_MINUTES).toBe(10);
    expect(new ScoreModel().getTimeLimitMs()).toBe(EASY);
    expect(new ScoreModel({ difficulty: Difficulty.Medium }).getTimeLimitMs()).toBe(30 * MINUTE);
    expect(new ScoreModel({ difficulty: Difficulty.Hard }).getTimeRemainingMs()).toBe(50 * MINUTE);
  });

  it("still takes an explicit time limit over the Difficulty's", () => {
    expect(new ScoreModel({ difficulty: Difficulty.Hard, timeLimitMs: 5000 }).getTimeLimitMs()).toBe(5000);
  });

  it("isDifficultyType accepts only 0, 1 and 2", () => {
    expect([0, 1, 2].every(isDifficultyType)).toBe(true);
    for (const bad of [3, -1, 1.5, "easy", "1", null, undefined, {}]) {
      expect(isDifficultyType(bad)).toBe(false);
    }
  });

  it("labels each difficulty for display", () => {
    expect(DIFFICULTY_LABEL[Difficulty.Easy]).toBe("Easy");
    expect(DIFFICULTY_LABEL[Difficulty.Medium]).toBe("Medium");
    expect(DIFFICULTY_LABEL[Difficulty.Hard]).toBe("Hard");
  });

  it("uses multipliers 1 / 3 / 6", () => {
    expect(new ScoreModel({ difficulty: Difficulty.Easy }).getMultiplier()).toBe(1);
    expect(new ScoreModel({ difficulty: Difficulty.Medium }).getMultiplier()).toBe(3);
    expect(new ScoreModel({ difficulty: Difficulty.Hard }).getMultiplier()).toBe(6);
  });

  it("main room gives $100 × multiplier, bonus room $300 × multiplier", () => {
    const m = new ScoreModel({ difficulty: Difficulty.Medium });
    expect(m.recordRoomSolved("main", "main_room")).toBe(300);
    expect(m.recordRoomSolved("bonus", "bonus_room")).toBe(900);
    expect(m.getMoney()).toBe(1200);
  });

  it("bonus rooms count as 3 correct answers", () => {
    const m = new ScoreModel();
    for (let i = 0; i < 12; i++) m.recordRoomSolved("main", "main_room");
    m.recordRoomSolved("bonus", "bonus_room");
    m.recordRoomSolved("bonus", "bonus_room");
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

  it.each([-1, NaN, Infinity])("rejects invalid time amount %s", (bad: number) => {
    const m = new ScoreModel();
    expect(() => m.removeTime(bad)).toThrow(RangeError);
    expect(m.getTimeRemainingMs()).toBe(EASY);
  });

  it("rejects solving a room after time is up", () => {
    const m = new ScoreModel({ timeLimitMs: 5000 });
    m.removeTime(5000);
    expect(m.recordRoomSolved("main", "main_room")).toBe(0);
    expect(m.recordRoomSolved("bonus", "bonus_room")).toBe(0);
    expect(m.getRoomsSolved()).toBe(0);
    expect(m.getMoney()).toBe(0);
  });

  it("never goes below zero time; running out means caught", () => {
    const m = new ScoreModel({ timeLimitMs: 5000 });
    m.removeTime(9000);
    expect(m.getTimeRemainingMs()).toBe(0);
    expect(m.isCaught()).toBe(true);
  });

  describe("calculateScore", () => {
    it("= multiplier × weighted correct × seconds left (with a wrong answer)", () => {
      const m = new ScoreModel({ difficulty: Difficulty.Hard });
      for (let i = 0; i < 12; i++) m.recordRoomSolved("main", "main_room");
      m.recordRoomSolved("bonus", "bonus_room");
      m.recordIncorrect(0);
      m.removeTime(m.getTimeRemainingMs() - 100 * 1000); // 100 s left
      expect(m.calculateScore()).toBe(6 * 15 * 100);
    });

    it("gives ×1.2 for a flawless run", () => {
      const m = new ScoreModel();
      for (let i = 0; i < 12; i++) m.recordRoomSolved("main", "main_room");
      m.removeTime(m.getTimeRemainingMs() - 100 * 1000);
      expect(m.isFlawless()).toBe(true);
      expect(m.calculateScore()).toBe(Math.round(1 * 12 * 100 * 1.2));
    });

    it("loses the flawless bonus after one wrong answer", () => {
      const m = new ScoreModel();
      m.recordRoomSolved("main", "main_room");
      m.recordIncorrect(60_000);
      expect(m.isFlawless()).toBe(false);
      expect(m.getIncorrectAnswers()).toBe(1);
      expect(m.getTimeRemainingMs()).toBe(EASY - 60_000);
    });

    it("is not flawless when caught, even with no wrong answers", () => {
      const m = new ScoreModel({ timeLimitMs: 5000 });
      m.recordRoomSolved("main", "main_room");
      m.removeTime(5000);
      expect(m.getIncorrectAnswers()).toBe(0);
      expect(m.isFlawless()).toBe(false);
      expect(m.snapshot().flawless).toBe(false);
    });

    it("is not flawless with nothing solved", () => {
      expect(new ScoreModel().isFlawless()).toBe(false);
    });

    it("is 0 when caught", () => {
      const m = new ScoreModel({ difficulty: Difficulty.Hard });
      for (let i = 0; i < 11; i++) m.recordRoomSolved("main", "main_room");
      m.removeTime(m.getTimeLimitMs());
      expect(m.calculateScore()).toBe(0);
    });

    it("ignores partial seconds", () => {
      const m = new ScoreModel({ timeLimitMs: 10_500 });
      m.recordRoomSolved("main", "main_room");
      m.recordIncorrect(0);
      expect(m.calculateScore()).toBe(10);
    });
  });

  it("snapshot includes everything the end screen needs", () => {
    const m = new ScoreModel({ difficulty: Difficulty.Medium });
    m.recordRoomSolved("bonus", "bonus_room");
    const s = m.snapshot();
    expect(s.money).toBe(900);
    expect(s.weightedCorrect).toBe(3);
    expect(s.flawless).toBe(true);
    expect(s.caught).toBe(false);
    expect(s.score).toBe(m.calculateScore());
  });
});
