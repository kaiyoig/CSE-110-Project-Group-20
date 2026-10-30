import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NotificationManager } from "./NotificationManager";
import { EventType, GameEvent } from "./GameEvent";

describe("NotificationManager", () => {
  let manager: NotificationManager;

  beforeEach(() => {
    manager = new NotificationManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("subscribe / send", () => {
    it("delivers an event to a subscribed handler", () => {
      const handler = vi.fn();
      manager.subscribe(EventType.Correct, handler);

      const event: GameEvent = { eventType: EventType.Correct, additionalInfo: "+10" };
      manager.send(event);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event);
    });

    it("only delivers events to handlers of the matching type", () => {
      const correctHandler = vi.fn();
      const incorrectHandler = vi.fn();
      manager.subscribe(EventType.Correct, correctHandler);
      manager.subscribe(EventType.Incorrect, incorrectHandler);

      manager.send({ eventType: EventType.Correct });

      expect(correctHandler).toHaveBeenCalledTimes(1);
      expect(incorrectHandler).not.toHaveBeenCalled();
    });

    it("delivers to all handlers of a type in subscription order", () => {
      const calls: string[] = [];
      manager.subscribe(EventType.GameStart, () => calls.push("first"));
      manager.subscribe(EventType.GameStart, () => calls.push("second"));
      manager.subscribe(EventType.GameStart, () => calls.push("third"));

      manager.send({ eventType: EventType.GameStart });

      expect(calls).toEqual(["first", "second", "third"]);
    });

    it("does not throw when sending an event with no subscribers", () => {
      expect(() => manager.send({ eventType: EventType.GameOver })).not.toThrow();
    });

    it("calls a handler only once if it is subscribed twice to the same type", () => {
      const handler = vi.fn();
      manager.subscribe(EventType.Correct, handler);
      manager.subscribe(EventType.Correct, handler);

      manager.send({ eventType: EventType.Correct });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("allows the same handler to subscribe to multiple types", () => {
      const handler = vi.fn();
      manager.subscribe(EventType.Correct, handler);
      manager.subscribe(EventType.Incorrect, handler);

      manager.send({ eventType: EventType.Correct });
      manager.send({ eventType: EventType.Incorrect });

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenNthCalledWith(1, { eventType: EventType.Correct });
      expect(handler).toHaveBeenNthCalledWith(2, { eventType: EventType.Incorrect });
    });

    it("keeps separate state between manager instances", () => {
      const other = new NotificationManager();
      const handler = vi.fn();
      manager.subscribe(EventType.Correct, handler);

      other.send({ eventType: EventType.Correct });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("unsubscribe", () => {
    it("stops delivering events after unsubscribing", () => {
      const handler = vi.fn();
      const unsubscribe = manager.subscribe(EventType.Correct, handler);

      unsubscribe();
      manager.send({ eventType: EventType.Correct });

      expect(handler).not.toHaveBeenCalled();
    });

    it("only removes the handler it was returned for", () => {
      const removed = vi.fn();
      const kept = vi.fn();
      const unsubscribe = manager.subscribe(EventType.Correct, removed);
      manager.subscribe(EventType.Correct, kept);

      unsubscribe();
      manager.send({ eventType: EventType.Correct });

      expect(removed).not.toHaveBeenCalled();
      expect(kept).toHaveBeenCalledTimes(1);
    });

    it("only removes the handler from the type it was subscribed to", () => {
      const handler = vi.fn();
      const unsubscribeCorrect = manager.subscribe(EventType.Correct, handler);
      manager.subscribe(EventType.Incorrect, handler);

      unsubscribeCorrect();
      manager.send({ eventType: EventType.Correct });
      manager.send({ eventType: EventType.Incorrect });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ eventType: EventType.Incorrect });
    });

    it("is safe to call more than once", () => {
      const handler = vi.fn();
      const unsubscribe = manager.subscribe(EventType.Correct, handler);

      unsubscribe();
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe("error handling", () => {
    it("logs a throwing handler's error and still runs the remaining handlers", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const error = new Error("boom");
      const after = vi.fn();
      manager.subscribe(EventType.Incorrect, () => { throw error; });
      manager.subscribe(EventType.Incorrect, after);

      expect(() => manager.send({ eventType: EventType.Incorrect })).not.toThrow();

      expect(after).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("incorrect"), error);
    });

    it("continues to deliver later events after a handler throws", () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const handler = vi.fn()
        .mockImplementationOnce(() => { throw new Error("first call fails"); });
      manager.subscribe(EventType.Correct, handler);

      manager.send({ eventType: EventType.Correct });
      manager.send({ eventType: EventType.Correct });

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe("re-entrant dispatch", () => {
    it("queues events sent from inside a handler until the current event finishes", () => {
      const calls: string[] = [];
      manager.subscribe(EventType.Correct, () => {
        calls.push("correct:1");
        manager.send({ eventType: EventType.GameOver });
        calls.push("correct:1 done");
      });
      manager.subscribe(EventType.Correct, () => calls.push("correct:2"));
      manager.subscribe(EventType.GameOver, () => calls.push("gameOver"));

      manager.send({ eventType: EventType.Correct });

      expect(calls).toEqual(["correct:1", "correct:1 done", "correct:2", "gameOver"]);
    });

    it("delivers nested events in the order they were sent", () => {
      const calls: EventType[] = [];
      manager.subscribe(EventType.GameStart, (e) => {
        calls.push(e.eventType);
        manager.send({ eventType: EventType.Correct });
        manager.send({ eventType: EventType.Incorrect });
      });
      manager.subscribe(EventType.Correct, (e) => {
        calls.push(e.eventType);
        manager.send({ eventType: EventType.GameOver });
      });
      manager.subscribe(EventType.Incorrect, (e) => calls.push(e.eventType));
      manager.subscribe(EventType.GameOver, (e) => calls.push(e.eventType));

      manager.send({ eventType: EventType.GameStart });

      expect(calls).toEqual([
        EventType.GameStart,
        EventType.Correct,
        EventType.Incorrect,
        EventType.GameOver,
      ]);
    });

    it("does not deliver the current event to a handler subscribed during dispatch", () => {
      const late = vi.fn();
      manager.subscribe(EventType.Correct, () => {
        manager.subscribe(EventType.Correct, late);
      });

      manager.send({ eventType: EventType.Correct });
      expect(late).not.toHaveBeenCalled();

      manager.send({ eventType: EventType.Correct });
      expect(late).toHaveBeenCalledTimes(1);
    });

    it("still delivers the current event to a handler unsubscribed during dispatch", () => {
      const second = vi.fn();
      let unsubscribeSecond: () => void = () => {};
      manager.subscribe(EventType.Correct, () => unsubscribeSecond());
      unsubscribeSecond = manager.subscribe(EventType.Correct, second);

      manager.send({ eventType: EventType.Correct });
      expect(second).toHaveBeenCalledTimes(1);

      manager.send({ eventType: EventType.Correct });
      expect(second).toHaveBeenCalledTimes(1);
    });
  });
});
