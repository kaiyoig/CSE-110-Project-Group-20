import { describe, expect, it } from "vitest";
import { calculateTimeDisplay, isGameResults, prepareResults, type GameResults } from "./GameResults";

function successfulResults(): GameResults {
  return {
    difficulty: "medium", money: 1200, roomsSolved: 2, bonusRoomsSolved: 1,
    incorrectAnswers: 0, timeSpentMs: 65000, caught: false, flawless: true, score: 50904,
  };
}

describe("results summaries", () => {
  it("displays supplied values without recalculating the score or double-counting rooms", () => {
    const results = successfulResults();
    results.score = 1234;

    const summary = prepareResults(results);

    expect(summary).toEqual({
      heading: "Heist complete!", score: "1,234", money: "$1,200.00",
      time: "00:01:05", difficulty: "Medium", rooms: "2", bonusRooms: "1",
      incorrectAnswers: "0", showFlawless: true,
    });
  });

  it("displays a caught run with zero score and no flawless escape badge", () => {
    const results = successfulResults();
    results.caught = true;
    results.score = 0;

    const summary = prepareResults(results);

    expect(summary.heading).toBe("You were caught!");
    expect(summary.score).toBe("0");
    expect(summary.showFlawless).toBe(false);
  });

  it("keeps zero statistics visible and does not treat zero score as caught", () => {
    const results = successfulResults();
    results.score = 0;
    results.money = 0;
    results.roomsSolved = 0;
    results.bonusRoomsSolved = 0;
    results.timeSpentMs = 0;
    results.flawless = false;

    const summary = prepareResults(results);

    expect(summary.heading).toBe("Heist complete!");
    expect(summary.score).toBe("0");
    expect(summary.money).toBe("$0.00");
    expect(summary.rooms).toBe("0");
    expect(summary.bonusRooms).toBe("0");
    expect(summary.incorrectAnswers).toBe("0");
    expect(summary.time).toBe("00:00:00");
    expect(summary.showFlawless).toBe(false);
  });

  it.each([
    { flawless: false },
    { incorrectAnswers: 1 },
    { roomsSolved: 0, bonusRoomsSolved: 0 },
  ])("does not award a flawless badge for %j", (changes) => {
    expect(prepareResults({ ...successfulResults(), ...changes }).showFlawless).toBe(false);
  });

  it.each(["easy", "medium", "hard"] as const)("labels %s difficulty", (difficulty) => {
    const labels = { easy: "Easy", medium: "Medium", hard: "Hard" };
    expect(prepareResults({ ...successfulResults(), difficulty }).difficulty).toBe(labels[difficulty]);
  });

  it("preserves the input snapshot", () => {
    const results = Object.freeze(successfulResults());
    expect(() => prepareResults(results)).not.toThrow();
    expect(results.score).toBe(50904);
  });
});

describe("snapshot validation", () => {
  it("accepts additional fields supplied by ScoreModel.snapshot", () => {
    const snapshot = {
      ...successfulResults(), weightedCorrect: 4, timeLimitMs: 3600000, timeRemainingMs: 3535000,
    };
    expect(isGameResults(snapshot)).toBe(true);
  });

  it.each([null, undefined, {}, "results"])("rejects incomplete input: %j", (value) => {
    expect(isGameResults(value)).toBe(false);
  });

  it.each([
    { difficulty: "expert" }, { money: -1 }, { score: NaN }, { score: Infinity },
    { score: "0" }, { timeSpentMs: -1 }, { timeSpentMs: Infinity },
    { roomsSolved: 1.5 }, { roomsSolved: Number.MAX_SAFE_INTEGER + 1 },
    { bonusRoomsSolved: 3 }, { incorrectAnswers: -1 }, { incorrectAnswers: 0.5 },
    { caught: "false" }, { flawless: undefined },
  ])("rejects invalid fields: %j", (changes) => {
    expect(isGameResults({ ...successfulResults(), ...changes })).toBe(false);
  });

  it("does not silently replace missing statistics with zero", () => {
    const results = successfulResults();
    // Simulate malformed input from JavaScript at the application boundary.
    const incomplete = { ...results, money: undefined } as unknown as GameResults;
    expect(() => prepareResults(incomplete)).toThrow("Results are incomplete");
  });
});

describe("time display", () => {
  it.each([
    [0, "00:00:00"], [1, "00:00:01"], [59000, "00:00:59"],
    [59999, "00:01:00"], [60000, "00:01:00"], [3725000, "01:02:05"],
  ])("formats %i milliseconds as %s", (milliseconds, display) => {
    expect(calculateTimeDisplay(milliseconds)).toBe(display);
  });

  it.each([-1, NaN, Infinity])("rejects invalid time %s", (value) => {
    expect(() => calculateTimeDisplay(value)).toThrow();
  });
});
