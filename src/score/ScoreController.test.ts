import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ScoreModel, Difficulty } from "./ScoreModel";
import { ScoreController, WRONG_ANSWER_PENALTY_SECONDS } from "./ScoreController";
import { NotificationManager } from "../notification-manager/NotificationManager";
import { EventType } from "../notification-manager/GameEvent";

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
    const c = new ScoreController(new ScoreModel({ difficulty: Difficulty.Hard }));
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

  it("dispose() stops the clock and leaves the room", () => {
    const c = make();
    c.enterRoom();
    c.dispose();
    expect(c.isRunning()).toBe(false);
    expect(c.isInRoom()).toBe(false);
    vi.advanceTimersByTime(3000);
    expect(remaining(c)).toBe(10_000);
  });

  it("a listener that throws doesn't stop the game from ending", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const c = make(3000);
    const timeUp = vi.fn();
    const goodListener = vi.fn();
    c.onChange(() => {
      throw new Error("broken HUD");
    });
    c.onChange(goodListener);
    c.onTimeUp(() => {
      throw new Error("broken end screen");
    });
    c.onTimeUp(timeUp);

    c.enterRoom();
    vi.advanceTimersByTime(5000);

    expect(goodListener).toHaveBeenCalled();
    expect(timeUp).toHaveBeenCalledTimes(1);
    expect(c.isRunning()).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  describe("listenTo (events from the NotificationManager)", () => {
    let notifications: NotificationManager;
    let c: ScoreController;

    beforeEach(() => {
      notifications = new NotificationManager();
      c = new ScoreController(new ScoreModel({ timeLimitMs: 600_000, difficulty: Difficulty.Medium }));
      c.listenTo(notifications);
    });

    it("RoomEntered starts the clock and ReturnedToMap pauses it", () => {
      notifications.send({ eventType: EventType.RoomEntered });
      vi.advanceTimersByTime(2000);
      notifications.send({ eventType: EventType.ReturnedToMap });
      vi.advanceTimersByTime(5000);

      expect(remaining(c)).toBe(598_000);
      expect(c.isInRoom()).toBe(false);
    });

    it("Incorrect takes the time penalty", () => {
      notifications.send({ eventType: EventType.Incorrect });

      expect(remaining(c)).toBe(600_000 - WRONG_ANSWER_PENALTY_SECONDS * 1000);
      expect(c.getModel().getIncorrectAnswers()).toBe(1);
    });

    it("RoomSolved adds money for its room kind", () => {
      notifications.send({ eventType: EventType.RoomSolved, roomKind: "main" });
      notifications.send({ eventType: EventType.RoomSolved, roomKind: "bonus" });

      expect(c.getModel().getMoney()).toBe(300 + 900);
      expect(c.getModel().getWeightedCorrect()).toBe(1 + 3);
    });

    it("Correct alone does not change the score (an earlier Step)", () => {
      const listener = vi.fn();
      c.onChange(listener);
      notifications.send({ eventType: EventType.Correct });

      expect(c.getModel().getMoney()).toBe(0);
      expect(listener).not.toHaveBeenCalled();
    });

    it("the returned function stops listening", () => {
      const other = new ScoreController(new ScoreModel());
      const stop = other.listenTo(notifications);
      stop();
      notifications.send({ eventType: EventType.RoomSolved, roomKind: "main" });

      expect(other.getModel().getMoney()).toBe(0);
    });

    it("dispose() stops listening", () => {
      c.dispose();
      notifications.send({ eventType: EventType.RoomEntered });
      notifications.send({ eventType: EventType.Incorrect });
      vi.advanceTimersByTime(3000);

      expect(remaining(c)).toBe(600_000);
      expect(c.isRunning()).toBe(false);
    });

    it("an event that runs the clock out fires onTimeUp", () => {
      const short = new ScoreController(new ScoreModel({ timeLimitMs: 30_000 }));
      short.listenTo(notifications);
      const timeUp = vi.fn();
      short.onTimeUp(timeUp);

      notifications.send({ eventType: EventType.Incorrect });

      expect(timeUp).toHaveBeenCalledOnce();
      short.dispose();
    });
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
