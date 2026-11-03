import { describe, it, expect, vi } from "vitest";

vi.mock("konva", () => import("./testing/fakeKonva"));

import { StartScreen } from "./StartScreen";
import { Difficulty } from "../score";
import { visibleTexts } from "./testing/fakeKonva";

function click(screen: StartScreen, name: string): void {
  screen.layer.findOne(`.${name}`)!.fire("click");
}

describe("StartScreen", () => {
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

  it("labels the buttons Easy, Medium and Hard, with no name box", () => {
    const screen = new StartScreen(1440, 900);

    expect(visibleTexts(screen.layer)).toEqual(
      expect.arrayContaining(["Easy", "Medium", "Hard"]),
    );
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
