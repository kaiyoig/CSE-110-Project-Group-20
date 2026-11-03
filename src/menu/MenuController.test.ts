import { beforeEach, describe, expect, it, vi } from "vitest";
import { MenuController } from "./MenuController";
import { type Difficulty, type GameResults } from "./GameResults";

function successfulResults(): GameResults {
  return {
    difficulty: "medium", money: 1200, roomsSolved: 2, bonusRoomsSolved: 1,
    incorrectAnswers: 0, timeSpentMs: 65000, caught: false, flawless: true, score: 50904,
  };
}

describe("menu workflow", () => {
  let onStart = vi.fn((_difficulty: Difficulty): void => {});
  let onLeave = vi.fn((): void => {});
  let onChange = vi.fn((): void => {});
  let controller: MenuController;

  beforeEach(() => {
    onStart = vi.fn();
    onLeave = vi.fn();
    onChange = vi.fn();
    controller = new MenuController(onStart, onLeave);
    controller.onScreenChange = onChange;
  });

  it("starts at the menu with easy selected and no results", () => {
    expect(controller.currentScreen).toBe("start");
    expect(controller.difficulty).toBe("easy");
    expect(controller.getResults()).toBeNull();
    expect(onStart).not.toHaveBeenCalled();
  });

  it.each(["easy", "medium", "hard"] as const)("starts a %s game and notifies the application", (difficulty) => {
    expect(controller.startGame(difficulty)).toBe(true);
    expect(controller.currentScreen).toBe("playing");
    expect(controller.difficulty).toBe(difficulty);
    expect(onStart).toHaveBeenCalledExactlyOnceWith(difficulty);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("sets state before the start callback runs", () => {
    onStart.mockImplementation(() => {
      expect(controller.currentScreen).toBe("playing");
      expect(controller.difficulty).toBe("medium");
    });
    controller.startGame("medium");
  });

  it("ignores repeated starts during gameplay", () => {
    controller.startGame("medium");
    expect(controller.startGame("hard")).toBe(false);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(controller.difficulty).toBe("medium");
  });

  it("rejects an unsupported difficulty without starting", () => {
    expect(() => controller.startGame("expert" as Difficulty)).toThrow();
    expect(controller.currentScreen).toBe("start");
    expect(onStart).not.toHaveBeenCalled();
  });

  it("restores the menu when game setup throws", () => {
    onStart.mockImplementation(() => { throw new Error("Setup failed"); });
    expect(() => controller.startGame("medium")).toThrow("Setup failed");
    expect(controller.currentScreen).toBe("start");
    expect(controller.difficulty).toBe("easy");
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each([false, true])("shows supplied results with caught=%s and stops gameplay", (caught) => {
    controller.startGame("medium");
    const results = { ...successfulResults(), caught };
    if (caught) results.score = 0;

    expect(controller.showResults(results)).toBe(true);

    expect(controller.currentScreen).toBe("results");
    expect(controller.getResults()).toEqual(results);
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("rejects malformed results without leaving the active game", () => {
    controller.startGame("medium");
    expect(() => controller.showResults({ score: 0 } as GameResults)).toThrow();
    expect(controller.currentScreen).toBe("playing");
    expect(controller.getResults()).toBeNull();
    expect(onLeave).not.toHaveBeenCalled();
  });

  it("rejects results from a different difficulty", () => {
    controller.startGame("hard");
    expect(() => controller.showResults(successfulResults())).toThrow();
    expect(controller.currentScreen).toBe("playing");
    expect(controller.getResults()).toBeNull();
    expect(onLeave).not.toHaveBeenCalled();
  });

  it("does not show results before a game or overwrite an ending", () => {
    expect(controller.showResults(successfulResults())).toBe(false);
    controller.startGame("medium");
    controller.showResults(successfulResults());
    expect(controller.showResults({ ...successfulResults(), caught: true })).toBe(false);
    expect(controller.getResults()?.caught).toBe(false);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("protects stored results from later changes to input or returned objects", () => {
    const results = successfulResults();
    controller.startGame("medium");
    controller.showResults(results);
    results.score = 99;
    const returned = controller.getResults()!;
    returned.money = 0;
    expect(controller.getResults()?.score).toBe(50904);
    expect(controller.getResults()?.money).toBe(1200);
  });

  it("restarts with the same difficulty and clears old results", () => {
    controller.startGame("medium");
    controller.showResults(successfulResults());

    expect(controller.restartGame()).toBe(true);

    expect(controller.currentScreen).toBe("playing");
    expect(controller.getResults()).toBeNull();
    expect(onStart).toHaveBeenCalledTimes(2);
    expect(onStart).toHaveBeenLastCalledWith("medium");
  });

  it("only allows restart from results", () => {
    expect(controller.restartGame()).toBe(false);
    controller.startGame("medium");
    expect(controller.restartGame()).toBe(false);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("preserves results if starting the next game fails", () => {
    controller.startGame("medium");
    controller.showResults(successfulResults());
    onStart.mockImplementation(() => { throw new Error("Setup failed"); });
    expect(() => controller.restartGame()).toThrow("Setup failed");
    expect(controller.currentScreen).toBe("results");
    expect(controller.getResults()).toEqual(successfulResults());
  });

  it("returns from results to the menu without starting another game", () => {
    controller.startGame("medium");
    controller.showResults(successfulResults());
    controller.backToMenu();
    expect(controller.currentScreen).toBe("start");
    expect(controller.getResults()).toBeNull();
    expect(controller.difficulty).toBe("medium");
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(controller.showResults(successfulResults())).toBe(false);
  });

  it("stops an active game when returning to the menu, only once", () => {
    controller.startGame("hard");
    controller.backToMenu();
    controller.backToMenu();
    expect(controller.currentScreen).toBe("start");
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});
