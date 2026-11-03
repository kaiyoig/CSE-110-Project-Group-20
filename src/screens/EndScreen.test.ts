import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("konva", () => import("./testing/fakeKonva"));
vi.mock("../text-input/text-input", () => import("./testing/fakeTextInput"));

import type Konva from "konva";
import { EndScreen } from "./EndScreen";
import { Difficulty, type LeaderboardEntry, type ScoreSnapshot } from "../score";
import type { HeistResult } from "../game/Game";
import { visibleTexts } from "./testing/fakeKonva";
import { created, type FakeTextInput } from "./testing/fakeTextInput";

// Cases carried over from #28's GameResults tests (Asad).

function snapshot(overrides: Partial<ScoreSnapshot> = {}): ScoreSnapshot {
  return {
    difficulty: Difficulty.Medium,
    money: 1200,
    roomsSolved: 2,
    bonusRoomsSolved: 1,
    weightedCorrect: 4,
    incorrectAnswers: 0,
    timeLimitMs: 3_600_000,
    timeRemainingMs: 3_535_000,
    timeSpentMs: 65_000,
    caught: false,
    flawless: true,
    score: 50_904,
    ...overrides,
  };
}

function escaped(overrides: Partial<ScoreSnapshot> = {}): HeistResult {
  return { outcome: "escaped", snapshot: snapshot(overrides), history: [] };
}

function caught(overrides: Partial<ScoreSnapshot> = {}): HeistResult {
  return {
    outcome: "caught",
    snapshot: snapshot({ caught: true, flawless: false, score: 0, timeRemainingMs: 0, ...overrides }),
    history: [],
  };
}

function entry(playerName: string, score: number): LeaderboardEntry {
  return { playerName, difficulty: Difficulty.Medium, score, timeSpentMs: 65_000, date: "2026-11-02T00:00:00.000Z" };
}

describe("EndScreen", () => {
  let screen: EndScreen;
  let input: FakeTextInput;

  function find(name: string): Konva.Node {
    const node = screen.layer.findOne(`.${name}`);
    if (!node) throw new Error(`no .${name}`);
    return node;
  }

  function stat(key: string): string {
    return (find(`stat-${key}`) as Konva.Text).text();
  }

  function nameBoxShown(): boolean {
    return find("name-box").visible() && input.visible();
  }

  beforeEach(() => {
    created.length = 0;
    screen = new EndScreen(1440, 900);
    input = created[0];
    screen.show();
  });

  it("shows Escaped! and the name box for an Escaped Heist", () => {
    screen.setResult(escaped(), []);

    expect((find("outcome") as Konva.Text).text()).toBe("Escaped!");
    expect(nameBoxShown()).toBe(true);
  });

  it("shows Caught!, score 0 and no name box for a Caught Heist", () => {
    screen.setResult(caught(), []);

    expect((find("outcome") as Konva.Text).text()).toBe("Caught!");
    expect(stat("score")).toBe("0");
    expect(nameBoxShown()).toBe(false);
  });

  it("takes the outcome from result.outcome, not snapshot.caught", () => {
    screen.setResult({ ...escaped(), outcome: "caught" }, []);

    expect((find("outcome") as Konva.Text).text()).toBe("Caught!");
  });

  it("shows the Flawless badge only for an Escaped Heist with no incorrect Answers", () => {
    screen.setResult(escaped(), []);
    expect(find("flawless").visible()).toBe(true);

    screen.setResult(escaped({ incorrectAnswers: 1, flawless: false }), []);
    expect(find("flawless").visible()).toBe(false);

    screen.setResult(caught({ incorrectAnswers: 0 }), []);
    expect(find("flawless").visible()).toBe(false);
  });

  it("formats the stats, with Bonus Rooms counted inside Rooms solved", () => {
    screen.setResult(escaped({ score: 1234 }), []);

    expect(stat("score")).toBe("1,234");
    expect(stat("money")).toBe("$1,200.00");
    expect(stat("time")).toBe("00:01:05");
    expect(stat("difficulty")).toBe("Medium");
    expect(stat("rooms")).toBe("2");
    expect(stat("bonus")).toBe("1");
    expect(stat("incorrect")).toBe("0");
  });

  it.each([
    [Difficulty.Easy, "Easy"],
    [Difficulty.Medium, "Medium"],
    [Difficulty.Hard, "Hard"],
  ])("labels Difficulty %s as %s", (difficulty, label) => {
    screen.setResult(escaped({ difficulty }), []);

    expect(stat("difficulty")).toBe(label);
  });

  it("keeps zero stats visible", () => {
    screen.setResult(escaped({ score: 0, money: 0, roomsSolved: 0, bonusRoomsSolved: 0, timeSpentMs: 0 }), []);

    expect(stat("score")).toBe("0");
    expect(stat("money")).toBe("$0.00");
    expect(stat("time")).toBe("00:00:00");
    expect(stat("rooms")).toBe("0");
    expect(stat("bonus")).toBe("0");
  });

  it("lists the leaderboard entries it is given, or says there are none", () => {
    screen.setResult(escaped(), []);
    expect(visibleTexts(screen.layer)).toContain("No saved scores yet.");

    screen.setResult(escaped(), [entry("Ana", 900), entry("Bo", 500)]);
    const texts = visibleTexts(screen.layer);
    expect(texts).toEqual(expect.arrayContaining(["Leaderboard: Medium", "1.", "Ana", "900", "2.", "Bo", "500"]));
    expect(texts).not.toContain("No saved scores yet.");
  });

  it("entering a name calls onSaveScore; after the next setResult the box is gone and the entry is listed", () => {
    const result = escaped();
    const onSaveScore = vi.fn();
    screen.onSaveScore(onSaveScore);
    screen.setResult(result, []);

    input.enter("  Ana  ");
    expect(onSaveScore).toHaveBeenCalledExactlyOnceWith("Ana");

    screen.setResult(result, [entry("Ana", result.snapshot.score)]);
    expect(nameBoxShown()).toBe(false);
    expect(visibleTexts(screen.layer)).toContain("Ana");

    input.enter("Ana again");
    expect(onSaveScore).toHaveBeenCalledOnce();
  });

  it("the Save button saves the typed name", () => {
    const onSaveScore = vi.fn();
    screen.onSaveScore(onSaveScore);
    screen.setResult(escaped(), []);

    input.value = "Bo";
    find("save").fire("click");

    expect(onSaveScore).toHaveBeenCalledExactlyOnceWith("Bo");
  });

  it("ignores an empty name", () => {
    const onSaveScore = vi.fn();
    screen.onSaveScore(onSaveScore);
    screen.setResult(escaped(), []);

    input.enter("   ");

    expect(onSaveScore).not.toHaveBeenCalled();
    expect(nameBoxShown()).toBe(true);
  });

  it("offers the name box again for a new result", () => {
    screen.onSaveScore(() => {});
    screen.setResult(escaped(), []);
    input.enter("Ana");

    screen.setResult(escaped(), []);

    expect(nameBoxShown()).toBe(true);
  });

  it("hides the name box's input while the screen is hidden", () => {
    screen.setResult(escaped(), []);

    screen.hide();
    expect(input.visible()).toBe(false);

    screen.show();
    expect(input.visible()).toBe(true);
  });

  it("Play Again and Back to Start fire their own callbacks", () => {
    const onPlayAgain = vi.fn();
    const onBackToStart = vi.fn();
    screen.onPlayAgain(onPlayAgain);
    screen.onBackToStart(onBackToStart);

    find("play-again").fire("click");
    expect(onPlayAgain).toHaveBeenCalledOnce();
    expect(onBackToStart).not.toHaveBeenCalled();

    find("back-to-start").fire("click");
    expect(onBackToStart).toHaveBeenCalledOnce();
    expect(onPlayAgain).toHaveBeenCalledOnce();
  });

  it("stops calling callbacks once unsubscribed", () => {
    const onPlayAgain = vi.fn();
    screen.onPlayAgain(onPlayAgain)();

    find("play-again").fire("click");

    expect(onPlayAgain).not.toHaveBeenCalled();
  });
});
