import { describe, it, expect, vi } from "vitest";

vi.mock("konva", () => import("./testing/fakeKonva"));

import { StartScreen } from "./StartScreen";
import { Difficulty, Leaderboard, type StorageLike } from "../score";
import { visibleTexts } from "./testing/fakeKonva";

function click(screen: StartScreen, name: string): void {
  screen.layer.findOne(`.${name}`)!.fire("click");
}

function memoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
    removeItem: (k) => { data.delete(k); },
  };
}

describe("StartScreen", () => {
  it("shows the primary menu buttons initially and reveals difficulties when PLAY is clicked", () => {
    const screen = new StartScreen(1440, 900);

    expect(visibleTexts(screen.layer)).toEqual(
      expect.arrayContaining(["PLAY", "TUTORIAL", "SETTINGS", "Credits  >"]),
    );
    expect(visibleTexts(screen.layer)).not.toEqual(
      expect.arrayContaining(["EASY", "MEDIUM", "HARD"]),
    );

    click(screen, "play-button");

    expect(visibleTexts(screen.layer)).toEqual(
      expect.arrayContaining(["EASY", "MEDIUM", "HARD"]),
    );
    expect(visibleTexts(screen.layer)).not.toEqual(
      expect.arrayContaining(["PLAY", "TUTORIAL", "SETTINGS"]),
    );
  });

  it.each([
    ["difficulty-easy", Difficulty.Easy],
    ["difficulty-medium", Difficulty.Medium],
    ["difficulty-hard", Difficulty.Hard],
  ])("clicking %s starts the Heist at that Difficulty", (name, difficulty) => {
    const screen = new StartScreen(1440, 900);
    const onStart = vi.fn();
    screen.onStart(onStart);

    click(screen, name);

    expect(onStart).toHaveBeenCalledExactlyOnceWith(difficulty);
  });

  it("returns to the primary menu when clicking Back from difficulty selection", () => {
    const screen = new StartScreen(1440, 900);

    click(screen, "play-button");
    expect(visibleTexts(screen.layer)).toEqual(
      expect.arrayContaining(["EASY", "MEDIUM", "HARD"]),
    );

    click(screen, "difficulty-back");
    expect(visibleTexts(screen.layer)).toEqual(
      expect.arrayContaining(["PLAY", "TUTORIAL", "SETTINGS"]),
    );
    expect(visibleTexts(screen.layer)).not.toEqual(
      expect.arrayContaining(["EASY", "MEDIUM", "HARD"]),
    );
  });

  it("emits events for secondary menu buttons (Tutorial, Settings, Leaderboard, Credits)", () => {
    const screen = new StartScreen(1440, 900);
    const onTutorial = vi.fn();
    const onSettings = vi.fn();
    const onLeaderboard = vi.fn();
    const onCredits = vi.fn();

    screen.onTutorial(onTutorial);
    screen.onSettings(onSettings);
    screen.onLeaderboard(onLeaderboard);
    screen.onCredits(onCredits);

    click(screen, "tutorial-button");
    click(screen, "settings-button");
    click(screen, "trophy-button");
    click(screen, "credits-button");

    expect(onTutorial).toHaveBeenCalledOnce();
    expect(onSettings).toHaveBeenCalledOnce();
    expect(onLeaderboard).toHaveBeenCalledOnce();
    expect(onCredits).toHaveBeenCalledOnce();
  });

  it("opens the High Scores modal on trophy click, switches difficulty tabs, and closes cleanly", () => {
    const board = new Leaderboard(memoryStorage());
    board.addEntry({
      playerName: "Alice",
      difficulty: Difficulty.Easy,
      score: 14000,
      timeSpentMs: 95_000,
    });
    board.addEntry({
      playerName: "Bob",
      difficulty: Difficulty.Hard,
      score: 21500,
      timeSpentMs: 185_000,
    });

    const screen = new StartScreen(1440, 900, board);

    // Modal is hidden initially
    expect(visibleTexts(screen.layer)).not.toContain("🏆 HIGH SCORES");

    // Open modal -> defaults to Easy tab
    click(screen, "trophy-button");
    expect(visibleTexts(screen.layer)).toEqual(
      expect.arrayContaining(["🏆 HIGH SCORES", "#1  Alice", "$14,000  (1:35)"]),
    );

    // Switch to Medium tab (empty state)
    click(screen, "leaderboard-tab-medium");
    expect(visibleTexts(screen.layer)).toContain(
      "No Medium scores recorded yet.\nComplete a heist to claim #1!",
    );

    // Switch to Hard tab
    click(screen, "leaderboard-tab-hard");
    expect(visibleTexts(screen.layer)).toEqual(
      expect.arrayContaining(["#1  Bob", "$21,500  (3:05)"]),
    );

    // Close modal
    click(screen, "close-leaderboard");
    expect(visibleTexts(screen.layer)).not.toContain("🏆 HIGH SCORES");
  });

  it("show() and hide() toggle its layer and reset both the difficulty sub-menu and modal", () => {
    const board = new Leaderboard(memoryStorage());
    const screen = new StartScreen(1440, 900, board);

    click(screen, "trophy-button");
    expect(visibleTexts(screen.layer)).toContain("🏆 HIGH SCORES");

    screen.hide();
    expect(screen.layer.visible()).toBe(false);
    screen.show();
    expect(screen.layer.visible()).toBe(true);
    expect(visibleTexts(screen.layer)).not.toContain("🏆 HIGH SCORES");
    expect(visibleTexts(screen.layer)).toEqual(
      expect.arrayContaining(["PLAY", "TUTORIAL", "SETTINGS"]),
    );
  });

  it("stops calling a callback once unsubscribed", () => {
    const screen = new StartScreen(1440, 900);
    const onStart = vi.fn();
    const unsubscribe = screen.onStart(onStart);

    unsubscribe();
    click(screen, "play-button");
    click(screen, "difficulty-easy");

    expect(onStart).not.toHaveBeenCalled();
  });

  it("adds its layer to no Stage itself", () => {
    const screen = new StartScreen(1440, 900);

    expect(screen.layer.getStage()).toBeNull();
  });
});
