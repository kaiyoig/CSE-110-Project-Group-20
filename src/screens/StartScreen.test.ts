import { describe, it, expect, vi } from "vitest";

vi.mock("konva", () => import("./testing/fakeKonva"));

import { StartScreen } from "./StartScreen";
import { Difficulty } from "../score";
import { visibleTexts } from "./testing/fakeKonva";

function click(screen: StartScreen, name: string): void {
  screen.layer.findOne(`.${name}`)!.fire("click");
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

  it("show() and hide() toggle its layer", () => {
    const screen = new StartScreen(1440, 900);

    screen.hide();
    expect(screen.layer.visible()).toBe(false);
    screen.show();
    expect(screen.layer.visible()).toBe(true);
  });

  it("stops calling a callback once unsubscribed", () => {
    const screen = new StartScreen(1440, 900);
    const onStart = vi.fn();
    const unsubscribe = screen.onStart(onStart);

    unsubscribe();
    click(screen, "difficulty-easy");

    expect(onStart).not.toHaveBeenCalled();
  });

  it("adds its layer to no Stage itself", () => {
    const screen = new StartScreen(1440, 900);

    expect(screen.layer.getStage()).toBeNull();
  });
});
