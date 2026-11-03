import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Game, ROOM_LAYOUT, VAULT_ID } from "./Game";
import { NotificationManager } from "../notification-manager/NotificationManager";
import { EventType } from "../notification-manager/GameEvent";
import { DEFAULT_TIME_LIMIT_MS, ROOM_MONEY, WRONG_ANSWER_PENALTY_SECONDS } from "../score";
import type { Room } from "../map/Room";
import type { AccessDeniedPayload } from "../map/MapController";
import type { Question } from "../questions/Question";
import type { ScreenController } from "../screens/ScreenController";
import type { MapScreen, RoomScreen } from "../screens/contracts";
import type Konva from "konva";

/** MapScreen fake: records what Game gives it and lets tests click Rooms. */
class FakeMapScreen implements MapScreen {
  readonly layer = {} as Konva.Layer;
  rooms: readonly Room[] = [];
  setRoomsCalls = 0;
  denied: AccessDeniedPayload[] = [];
  private roomClick: ((id: string) => void) | null = null;

  show(): void {}
  hide(): void {}
  setRooms(rooms: readonly Room[]): void {
    this.rooms = rooms;
    this.setRoomsCalls += 1;
  }
  showAccessDenied(payload: AccessDeniedPayload): void {
    this.denied.push(payload);
  }
  onRoomClick(cb: (id: string) => void): () => void {
    this.roomClick = cb;
    return () => { this.roomClick = null; };
  }
  click(id: string): void {
    this.roomClick?.(id);
  }
  isListening(): boolean {
    return this.roomClick !== null;
  }
  room(id: string): Room {
    const room = this.rooms.find((r) => r.id === id);
    if (!room) throw new Error(`no room ${id}`);
    return room;
  }
}

/** RoomScreen fake without unsubscribe support, to exercise the `ended` guard. */
class FakeRoomScreen implements RoomScreen {
  readonly layer = {} as Konva.Layer;
  question: Question | null = null;
  roomName = "";
  hud: { timeRemainingMs: number; money: number } | null = null;
  private answer: ((answer: string) => void) | null = null;
  private exit: (() => void) | null = null;

  show(): void {}
  hide(): void {}
  setQuestion(question: Question, roomName: string): void {
    this.question = question;
    this.roomName = roomName;
  }
  setHud(timeRemainingMs: number, money: number): void {
    this.hud = { timeRemainingMs, money };
  }
  onAnswer(cb: (answer: string) => void): void {
    this.answer = cb;
  }
  onExit(cb: () => void): void {
    this.exit = cb;
  }
  submit(answer: string): void {
    this.answer?.(answer);
  }
  leave(): void {
    this.exit?.();
  }
}

function fakeScreens() {
  const shown: string[] = [];
  const screens = {
    show: vi.fn((id: string) => { shown.push(id); }),
    current: () => shown[shown.length - 1] ?? null,
  } as unknown as ScreenController;
  return { screens, shown };
}

function wrongAnswer(question: Question): string {
  return String(Number(question.answer) + 1);
}

describe("Game", () => {
  let notifications: NotificationManager;
  let mapScreen: FakeMapScreen;
  let roomScreen: FakeRoomScreen;
  let screens: ScreenController;
  let shown: string[];
  let events: EventType[];
  let game: Game;

  function newGame(difficulty = 0): Game {
    return new Game(difficulty, { notifications, screens, mapScreen, roomScreen });
  }

  function enterAndSolve(id: string): void {
    mapScreen.click(id);
    roomScreen.submit(mapScreen.room(id).question.answer);
  }

  function count(type: EventType): number {
    return events.filter((e) => e === type).length;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    notifications = new NotificationManager();
    mapScreen = new FakeMapScreen();
    roomScreen = new FakeRoomScreen();
    ({ screens, shown } = fakeScreens());
    events = [];
    for (const type of Object.values(EventType)) {
      notifications.subscribe(type, (e) => events.push(e.eventType));
    }
    game = newGame();
  });

  afterEach(() => {
    game.dispose();
    vi.useRealTimers();
  });

  it("start() sends GameStart, gives MapScreen the 5 Rooms, and shows the map", () => {
    game.start();

    expect(events).toEqual([EventType.GameStart]);
    expect(mapScreen.rooms.map((r) => r.id)).toEqual(ROOM_LAYOUT.map((r) => r.id));
    expect(shown).toEqual(["map"]);
  });

  it("generates each Room's Question once and keeps it after leaving and re-entering", () => {
    game.start();
    const question = mapScreen.room("room-1").question;

    mapScreen.click("room-1");
    expect(roomScreen.question).toBe(question);
    roomScreen.leave();
    mapScreen.click("room-1");

    expect(roomScreen.question).toBe(question);
    expect(mapScreen.room("room-1").question).toBe(question);
  });

  it("clicking a locked Room shows access denied, without a screen change or the clock starting", () => {
    game.start();

    mapScreen.click(VAULT_ID);
    vi.advanceTimersByTime(5000);

    expect(mapScreen.denied).toHaveLength(1);
    expect(mapScreen.denied[0].missingPrerequisiteIds).toEqual(["room-1", "room-2", "room-3"]);
    expect(shown).toEqual(["map"]);
    expect(roomScreen.hud).toBeNull();
  });

  it("entering a Room shows its Question, runs the clock and updates the HUD on tick", () => {
    game.start();

    mapScreen.click("room-1");
    expect(roomScreen.question).toBe(mapScreen.room("room-1").question);
    expect(roomScreen.roomName).toBe("Room 1");
    expect(shown).toEqual(["map", "room"]);

    vi.advanceTimersByTime(3000);
    expect(roomScreen.hud).toEqual({ timeRemainingMs: DEFAULT_TIME_LIMIT_MS - 3000, money: 0 });
  });

  it("exiting without solving returns to the map and pauses the clock", () => {
    game.start();
    mapScreen.click("room-1");
    vi.advanceTimersByTime(2000);

    roomScreen.leave();
    const hudAfterExit = roomScreen.hud;
    vi.advanceTimersByTime(10_000);

    expect(shown).toEqual(["map", "room", "map"]);
    expect(roomScreen.hud).toEqual(hudAfterExit);
    expect(mapScreen.room("room-1").isSolved).toBe(false);
  });

  it("a correct Answer in a Main Room solves it, adds money, returns to the map and sends Correct", () => {
    game.start();

    enterAndSolve("room-1");

    expect(mapScreen.room("room-1").isSolved).toBe(true);
    expect(roomScreen.hud?.money).toBe(ROOM_MONEY.main);
    expect(shown).toEqual(["map", "room", "map"]);
    expect(count(EventType.Correct)).toBe(1);
  });

  it("a correct Answer in a Bonus Room earns bonus money and weight", () => {
    game.start();
    enterAndSolve("bonus-1");
    enterAndSolve("room-1");
    enterAndSolve("room-2");
    enterAndSolve("room-3");
    enterAndSolve(VAULT_ID);

    const { snapshot } = game.getResult();
    expect(snapshot.bonusRoomsSolved).toBe(1);
    expect(snapshot.money).toBe(ROOM_MONEY.bonus + 4 * ROOM_MONEY.main);
    expect(snapshot.weightedCorrect).toBe(3 + 4);
  });

  it("a wrong Answer sends Incorrect, applies the time penalty and stays in the Room", () => {
    game.start();
    mapScreen.click("room-1");

    roomScreen.submit(wrongAnswer(mapScreen.room("room-1").question));

    expect(count(EventType.Incorrect)).toBe(1);
    expect(roomScreen.hud?.timeRemainingMs).toBe(
      DEFAULT_TIME_LIMIT_MS - WRONG_ANSWER_PENALTY_SECONDS * 1000,
    );
    expect(shown).toEqual(["map", "room"]);
    expect(mapScreen.room("room-1").isSolved).toBe(false);
  });

  it("solving the Vault sends GameOver once and the outcome is escaped", () => {
    game.start();
    enterAndSolve("room-1");
    enterAndSolve("room-2");
    enterAndSolve("room-3");

    enterAndSolve(VAULT_ID);

    expect(count(EventType.GameOver)).toBe(1);
    const result = game.getResult();
    expect(result.outcome).toBe("escaped");
    expect(result.snapshot.score).toBeGreaterThan(0);
    expect(result.history).toHaveLength(4);
  });

  it("running out of time in a Room sends GameOver with outcome caught and score 0", () => {
    game.start();
    mapScreen.click("room-1");

    vi.advanceTimersByTime(DEFAULT_TIME_LIMIT_MS + 1000);

    expect(count(EventType.GameOver)).toBe(1);
    const result = game.getResult();
    expect(result.outcome).toBe("caught");
    expect(result.snapshot.score).toBe(0);
  });

  it("a wrong Answer that runs the clock out ends caught, with that Answer in the history", () => {
    game.start();
    mapScreen.click("room-1");
    const question = mapScreen.room("room-1").question;
    // Leave less time than one penalty.
    vi.advanceTimersByTime(DEFAULT_TIME_LIMIT_MS - 1000);
    expect(count(EventType.GameOver)).toBe(0);

    roomScreen.submit(wrongAnswer(question));

    expect(count(EventType.GameOver)).toBe(1);
    expect(events.slice(-2)).toEqual([EventType.Incorrect, EventType.GameOver]);
    const result = game.getResult();
    expect(result.outcome).toBe("caught");
    expect(result.history).toHaveLength(1);
    expect(result.history[0]).toMatchObject({ question, isCorrect: false });
  });

  it("ignores Answers and clicks after the Heist ends and never sends GameOver twice", () => {
    game.start();
    mapScreen.click("room-1");
    vi.advanceTimersByTime(DEFAULT_TIME_LIMIT_MS + 1000);
    const result = game.getResult();
    const shownBefore = [...shown];

    roomScreen.submit(mapScreen.room("room-1").question.answer);
    roomScreen.leave();
    mapScreen.click("room-2");
    vi.advanceTimersByTime(10_000);

    expect(count(EventType.GameOver)).toBe(1);
    expect(count(EventType.Correct)).toBe(0);
    expect(shown).toEqual(shownBefore);
    expect(game.getResult()).toBe(result);
  });

  it("dispose() removes every NotificationManager subscription and screen callback it made", () => {
    const subscribe = vi.spyOn(notifications, "subscribe");
    const unsubscribers: ReturnType<typeof vi.fn>[] = [];
    subscribe.mockImplementation((type, handler) => {
      const real = NotificationManager.prototype.subscribe.call(notifications, type, handler);
      const unsubscribe = vi.fn(real);
      unsubscribers.push(unsubscribe);
      return unsubscribe;
    });
    const other = newGame();
    expect(mapScreen.isListening()).toBe(true);

    other.dispose();

    unsubscribers.forEach((u) => expect(u).toHaveBeenCalled());
    expect(mapScreen.isListening()).toBe(false);
    expect(() => notifications.send({ eventType: EventType.Correct })).not.toThrow();
  });

  it("getResult() throws before the Heist ends", () => {
    game.start();
    expect(() => game.getResult()).toThrow();
  });

  it("rejects an unknown difficulty", () => {
    expect(() => newGame(7)).toThrow(RangeError);
  });
});
