import { describe, it, expect, vi } from "vitest";
import type Konva from "konva";

vi.mock("konva", () => import("./testing/fakeKonva"));

import { TutorialScreen } from "./TutorialScreen";
import { FakeStage, visibleTexts, type FakeNode } from "./testing/fakeKonva";
import { ScreenController } from "./ScreenController";

function setup() {
  const stage = new FakeStage();
  const screens = new ScreenController(stage as unknown as Konva.Stage);
  const screen = new TutorialScreen(1440, 900);
  screens.register("tutorial", screen);
  screens.show("tutorial");
  const find = (name: string): FakeNode => {
    const node = screen.layer.findOne("." + name);
    if (!node) throw new Error("Missing " + name);
    return node as unknown as FakeNode;
  };
  const click = (name: string) => find(name).fire("click");
  return { screen, click, find };
}

describe("TutorialScreen", () => {
  it("shows the map, worked example, real practice and rules in order", () => {
    const { screen, click, find } = setup();
    expect(find("tutorial-heading").text()).toBe("PLAN THE HEIST");
    click("tutorial-next");
    expect(find("tutorial-heading").text()).toBe("CRACK THE EQUATION");
    click("tutorial-next");
    expect(find("tutorial-heading").text()).toBe("TRY THE KEYPAD");
    expect(find("step-message").text()).toContain("Drag a term");
    expect(find("tutorial-progress").text()).toContain("NO TIMER OR SCORE");
    click("tutorial-next");
    expect(find("tutorial-heading").text()).toBe("HINTS & TIME");
    expect(screen.layer.findOne(".multistep-console")).toBeFalsy();
    click("tutorial-replay");
    expect(find("tutorial-heading").text()).toBe("PLAN THE HEIST");
    screen.hide();
  });

  it("replays the practice and removes it when going back or leaving the screen", () => {
    const { screen, click } = setup();
    click("tutorial-next");
    click("tutorial-next");
    const initial = screen.layer.findOne(".multistep-console");
    expect(initial).toBeTruthy();
    click("tutorial-retry");
    expect(screen.layer.findOne(".multistep-console")).not.toBe(initial);
    expect(screen.layer.find(".multistep-console")).toHaveLength(1);
    click("tutorial-back");
    expect(screen.layer.findOne(".multistep-console")).toBeFalsy();
    click("tutorial-next");
    screen.hide();
    expect(screen.layer.findOne(".multistep-console")).toBeFalsy();
    screen.show();
    expect(visibleTexts(screen.layer)).toContain("PLAN THE HEIST");
    screen.hide();
  });

  it("uses the actual solver with no game dependencies and completes a practice equation", () => {
    vi.useFakeTimers();
    const { screen, click, find } = setup();
    try {
      click("tutorial-next");
      click("tutorial-next");
      const practice = (screen as unknown as { practice: { controller: {
        operation(index: number, isLeftSide: boolean): void;
      } } }).practice;
      practice.controller.operation(3, true);
      click("operation-+");
      click("key-2");
      click("key-1");
      click("key-Enter");
      practice.controller.operation(2, true);
      click("operation-/");
      click("key-7");
      click("key-Enter");
      expect(find("tutorial-progress").text()).toContain("PRACTICE COMPLETE");
      vi.runAllTimers();
      expect(find("tutorial-heading").text()).toBe("HINTS & TIME");
      expect(screen.layer.findOne(".multistep-console")).toBeFalsy();
    } finally {
      screen.hide();
      vi.useRealTimers();
    }
  });

  it("emits menu and start events for skip and finish", () => {
    const { screen, click } = setup();
    const menu = vi.fn();
    const start = vi.fn();
    screen.onMenu(menu);
    screen.onStartHeist(start);
    click("tutorial-menu");
    expect(menu).toHaveBeenCalledOnce();
    click("tutorial-skip");
    expect(start).toHaveBeenCalledOnce();
    click("tutorial-next");
    click("tutorial-next");
    click("tutorial-next");
    click("tutorial-start");
    expect(start).toHaveBeenCalledTimes(2);
    screen.hide();
  });
});
