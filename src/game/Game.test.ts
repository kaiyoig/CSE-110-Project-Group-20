import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Game, ROOM_LAYOUT, VAULT_ID } from "./Game";
import { NotificationManager } from "../notification-manager/NotificationManager";
import { EventType } from "../notification-manager/GameEvent";
import {
  DEFAULT_TIME_LIMIT_MS,
  Difficulty,
  ROOM_MONEY,
  ROOM_SCORE_WEIGHT,
  WRONG_ANSWER_PENALTY_SECONDS,
} from "../score";
import type { Room } from "../map/Room";
import type { AccessDeniedPayload } from "../map/MapController";
import type { Question, StepAnswer } from "../questions/Question";
import type { ScreenController } from "../screens/ScreenController";
import type { MapScreen, RoomScreen, Unsubscribe } from "../screens/contracts";
import type Konva from "konva";

interface Hud {
  timeRemainingMs: number;
  timeLimitMs: number;
  money: number;
}

/** A single-listener callback slot that records whether it is still subscribed. */
class Slot<T extends unknown[]> {
  private cb: ((...args: T) => void) | null = null;
  set(cb: (...args: T) => void): Unsubscribe {
    this.cb = cb;
    return () => { this.cb = null; };
  }
  fire(...args: T): void {
    this.cb?.(...args);
  }
  get listening(): boolean {
    return this.cb !== null;
  }
}

/** MapScreen fake: records what Game gives it and lets tests click Rooms. */
class FakeMapScreen implements MapScreen {
  readonly layer = {} as Konva.Layer;
  rooms: readonly Room[] = [];
  solved: string[] = [];
  hud: Hud | null = null;
  denied: AccessDeniedPayload[] = [];
  readonly roomClick = new Slot<[string]>();

  show(): void {}
  hide(): void {}
  setRooms(rooms: readonly Room[], solvedRoomIds: ReadonlySet<string>): void {
    this.rooms = rooms;
    this.solved = [...solvedRoomIds];
  }
  setHud(timeRemainingMs: number, timeLimitMs: number, money: number): void {
    this.hud = { timeRemainingMs, timeLimitMs, money };
  }
  showAccessDenied(payload: AccessDeniedPayload): void {
    this.denied.push(payload);
  }
  onRoomClick(cb: (id: string) => void): Unsubscribe {
    return this.roomClick.set(cb);
  }
  click(id: string): void {
    this.roomClick.fire(id);
  }
  room(id: string): Room {
    const room = this.rooms.find((r) => r.id === id);
    if (!room) throw new Error(`no room ${id}`);
    return room;
  }
}

/** RoomScreen fake: records the Question and HUD, and lets tests answer and exit. */
class FakeRoomScreen implements RoomScreen {
  readonly layer = {} as Konva.Layer;
  question: Question | null = null;
  roomName = "";
  setQuestionCalls = 0;
  hud: Hud | null = null;
  readonly answer = new Slot<[StepAnswer]>();
  readonly exit = new Slot<[]>();

  show(): void {}
  hide(): void {}
  setQuestion(question: Question, roomName: string): void {
    this.question = question;
    this.roomName = roomName;
    this.setQuestionCalls += 1;
  }
  setHud(timeRemainingMs: number, timeLimitMs: number, money: number): void {
    this.hud = { timeRemainingMs, timeLimitMs, money };
  }
  onAnswer(cb: (answer: StepAnswer) => void): Unsubscribe {
    return this.answer.set(cb);
  }
  onExit(cb: () => void): Unsubscribe {
    return this.exit.set(cb);
  }
  submit(answer: StepAnswer): void {
    this.answer.fire(answer);
  }
  leave(): void {
    this.exit.fire();
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

/** A correct operation pick, as the puzzle reports it. */
const CORRECT_PICK: StepAnswer = { playerAnswer: "-", correctAnswer: "-", isLastStep: false };
/** A wrong operation pick. */
const WRONG_PICK: StepAnswer = { playerAnswer: "+", correctAnswer: "-", isLastStep: false };

function lastStep(question: Question): StepAnswer {
  return { playerAnswer: question.answer, correctAnswer: question.answer, isLastStep: true };
}

function wrongLastStep(question: Question): StepAnswer {
  return {
    playerAnswer: String(Number(question.answer) + 1),
    correctAnswer: question.answer,
    isLastStep: true,
  };
}

const PENALTY_MS = WRONG_ANSWER_PENALTY_SECONDS * 1000;

describe("Game", () => {
  let notifications: NotificationManager;
  let mapScreen: FakeMapScreen;
  let roomScreen: FakeRoomScreen;
  let screens: ScreenController;
  let shown: string[];
  let events: EventType[];
  let game: Game;

  function newGame(difficulty: Difficulty = Difficulty.Easy): Game {
    return new Game(difficulty, { notifications, screens, mapScreen, roomScreen });
  }

  function enterAndSolve(id: string): void {
    mapScreen.click(id);
    roomScreen.submit(CORRECT_PICK);
    roomScreen.submit(lastStep(mapScreen.room(id).question));
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

  it("start() sends GameStart, gives MapScreen the 5 Rooms with none Solved, sets both HUDs and shows the map", () => {
    game.start();

    expect(events).toEqual([EventType.GameStart]);
    expect(mapScreen.rooms.map((r) => r.id)).toEqual(ROOM_LAYOUT.map((r) => r.id));
    expect(mapScreen.solved).toEqual([]);
    const startHud = { timeRemainingMs: DEFAULT_TIME_LIMIT_MS, timeLimitMs: DEFAULT_TIME_LIMIT_MS, money: 0 };
    expect(mapScreen.hud).toEqual(startHud);
    expect(roomScreen.hud).toEqual(startHud);
    expect(shown).toEqual(["map"]);
  });

  it("uses #30's layout, with room_X as the Bonus Room", () => {
    game.start();

    expect(mapScreen.room("room_X").kind).toBe("bonus");
    expect(mapScreen.room("room_c").prerequisites).toEqual(["room_a", "room_b"]);
    expect(mapScreen.room(VAULT_ID).prerequisites).toEqual(["room_c"]);
  });

  it("generates each Room's Question once and keeps it after leaving and re-entering", () => {
    game.start();
    const question = mapScreen.room("room_a").question;

    mapScreen.click("room_a");
    expect(roomScreen.question).toBe(question);
    roomScreen.leave();
    mapScreen.click("room_a");

    expect(roomScreen.question).toBe(question);
    expect(roomScreen.setQuestionCalls).toBe(2); // a fresh puzzle each entry
    expect(mapScreen.room("room_a").question).toBe(question);
  });

  it("clicking a locked Room shows access denied, without a screen change or the clock starting", () => {
    game.start();

    mapScreen.click("room_c");
    vi.advanceTimersByTime(5000);

    expect(mapScreen.denied).toHaveLength(1);
    expect(mapScreen.denied[0].missingPrerequisiteIds).toEqual(["room_a", "room_b"]);
    expect(mapScreen.denied[0].missingPrerequisiteNames).toEqual(["Room A", "Room B"]);
    expect(shown).toEqual(["map"]);
    expect(mapScreen.hud?.timeRemainingMs).toBe(DEFAULT_TIME_LIMIT_MS);
  });

  it("entering a Room shows its Question, runs the clock and updates both HUDs on tick", () => {
    game.start();

    mapScreen.click("room_a");
    expect(roomScreen.question).toBe(mapScreen.room("room_a").question);
    expect(roomScreen.roomName).toBe("Room A");
    expect(shown).toEqual(["map", "room"]);

    vi.advanceTimersByTime(3000);
    const hud = { timeRemainingMs: DEFAULT_TIME_LIMIT_MS - 3000, timeLimitMs: DEFAULT_TIME_LIMIT_MS, money: 0 };
    expect(roomScreen.hud).toEqual(hud);
    expect(mapScreen.hud).toEqual(hud);
  });

  it("exiting without solving returns to the map and pauses the clock", () => {
    game.start();
    mapScreen.click("room_a");
    vi.advanceTimersByTime(2000);

    roomScreen.leave();
    const hudAfterExit = mapScreen.hud;
    vi.advanceTimersByTime(10_000);

    expect(shown).toEqual(["map", "room", "map"]);
    expect(mapScreen.hud).toEqual(hudAfterExit);
    expect(mapScreen.solved).toEqual([]);
  });

  it("a correct Answer to an earlier Step sends Correct, changes no score and stays in the Room", () => {
    game.start();
    mapScreen.click("room_a");

    roomScreen.submit(CORRECT_PICK);

    expect(count(EventType.Correct)).toBe(1);
    expect(roomScreen.hud?.money).toBe(0);
    expect(roomScreen.hud?.timeRemainingMs).toBe(DEFAULT_TIME_LIMIT_MS);
    expect(shown).toEqual(["map", "room"]);
  });

  it.each([
    ["an operation pick", () => WRONG_PICK],
    ["the last Step", (q: Question) => wrongLastStep(q)],
  ])("a wrong Answer to %s sends Incorrect, applies the time penalty and stays in the Room", (_, answer) => {
    game.start();
    mapScreen.click("room_a");

    roomScreen.submit(answer(mapScreen.room("room_a").question));

    expect(count(EventType.Incorrect)).toBe(1);
    expect(roomScreen.hud?.timeRemainingMs).toBe(DEFAULT_TIME_LIMIT_MS - PENALTY_MS);
    expect(shown).toEqual(["map", "room"]);
    expect(mapScreen.solved).toEqual([]);
  });

  it("a correct last Step in a Main Room solves it, adds money and returns to the map", () => {
    game.start();

    enterAndSolve("room_a");

    expect(mapScreen.solved).toEqual(["room_a"]);
    expect(mapScreen.hud?.money).toBe(ROOM_MONEY.main);
    expect(shown).toEqual(["map", "room", "map"]);
    expect(count(EventType.Correct)).toBe(2);
  });

  it("a correct last Step in room_X earns bonus money and weight", () => {
    game.start();
    enterAndSolve("room_X");
    expect(mapScreen.hud?.money).toBe(ROOM_MONEY.bonus);

    enterAndSolve("room_a");
    enterAndSolve("room_b");
    enterAndSolve("room_c");
    enterAndSolve(VAULT_ID);

    const { snapshot } = game.getResult();
    expect(snapshot.bonusRoomsSolved).toBe(1);
    expect(snapshot.roomsSolved).toBe(5);
    expect(snapshot.money).toBe(ROOM_MONEY.bonus + 4 * ROOM_MONEY.main);
    expect(snapshot.weightedCorrect).toBe(ROOM_SCORE_WEIGHT.bonus + 4 * ROOM_SCORE_WEIGHT.main);
  });

  it("a Solved Room can't be re-entered", () => {
    game.start();
    enterAndSolve("room_a");
    const setQuestionCalls = roomScreen.setQuestionCalls;

    mapScreen.click("room_a");

    expect(roomScreen.setQuestionCalls).toBe(setQuestionCalls);
    expect(shown).toEqual(["map", "room", "map"]);
  });

  it("solving the Vault sends GameOver once and the outcome is escaped", () => {
    game.start();
    enterAndSolve("room_a");
    enterAndSolve("room_b");
    enterAndSolve("room_c");

    enterAndSolve(VAULT_ID);

    expect(count(EventType.GameOver)).toBe(1);
    const result = game.getResult();
    expect(result.outcome).toBe("escaped");
    expect(result.snapshot.score).toBeGreaterThan(0);
    expect(result.snapshot.flawless).toBe(true);
  });

  it("running out of time in a Room sends GameOver with outcome caught and score 0", () => {
    game.start();
    mapScreen.click("room_a");

    vi.advanceTimersByTime(DEFAULT_TIME_LIMIT_MS + 1000);

    expect(count(EventType.GameOver)).toBe(1);
    const result = game.getResult();
    expect(result.outcome).toBe("caught");
    expect(result.snapshot.score).toBe(0);
  });

  it("a wrong Answer that runs the clock out ends caught, with that Answer in the history", () => {
    game.start();
    mapScreen.click("room_a");
    const question = mapScreen.room("room_a").question;
    // Leave less time than one penalty.
    vi.advanceTimersByTime(DEFAULT_TIME_LIMIT_MS - 1000);
    expect(count(EventType.GameOver)).toBe(0);

    roomScreen.submit(WRONG_PICK);

    expect(count(EventType.GameOver)).toBe(1);
    expect(events.slice(-2)).toEqual([EventType.Incorrect, EventType.GameOver]);
    const result = game.getResult();
    expect(result.outcome).toBe("caught");
    expect(result.history).toHaveLength(1);
    expect(result.history[0]).toMatchObject({ question, isCorrect: false, playerAnswer: "+" });
  });

  it("a correct last Step after the clock hit zero between ticks ends caught, not escaped", () => {
    game.start();
    enterAndSolve("room_a");
    enterAndSolve("room_b");
    enterAndSolve("room_c");
    mapScreen.click(VAULT_ID);
    vi.setSystemTime(Date.now() + DEFAULT_TIME_LIMIT_MS); // no tick has run yet

    roomScreen.submit(lastStep(mapScreen.room(VAULT_ID).question));

    expect(count(EventType.GameOver)).toBe(1);
    expect(game.getResult().outcome).toBe("caught");
    expect(game.getResult().snapshot.score).toBe(0);
  });

  it("history records every Answer, Steps included", () => {
    game.start();
    mapScreen.click("room_a");
    const question = mapScreen.room("room_a").question;

    roomScreen.submit(WRONG_PICK);
    roomScreen.submit(CORRECT_PICK);
    roomScreen.submit(lastStep(question));
    enterAndSolve("room_b");
    enterAndSolve("room_c");
    enterAndSolve(VAULT_ID);

    const { history } = game.getResult();
    expect(history).toHaveLength(9);
    expect(history.slice(0, 3)).toEqual([
      { question, playerAnswer: "+", correctAnswer: "-", isCorrect: false, isLastStep: false },
      { question, playerAnswer: "-", correctAnswer: "-", isCorrect: true, isLastStep: false },
      { question, playerAnswer: question.answer, correctAnswer: question.answer, isCorrect: true, isLastStep: true },
    ]);
    expect(game.getResult().snapshot.flawless).toBe(false);
  });

  it("ignores Answers and clicks after the Heist ends and never sends GameOver twice", () => {
    game.start();
    mapScreen.click("room_a");
    vi.advanceTimersByTime(DEFAULT_TIME_LIMIT_MS + 1000);
    const result = game.getResult();
    const shownBefore = [...shown];

    roomScreen.submit(lastStep(mapScreen.room("room_a").question));
    roomScreen.leave();
    mapScreen.click("room_b");
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
    expect(mapScreen.roomClick.listening).toBe(true);

    other.dispose();

    unsubscribers.forEach((u) => expect(u).toHaveBeenCalled());
    expect(mapScreen.roomClick.listening).toBe(false);
    expect(roomScreen.answer.listening).toBe(false);
    expect(roomScreen.exit.listening).toBe(false);
    expect(() => notifications.send({ eventType: EventType.Correct })).not.toThrow();
  });

  it("getResult() throws before the Heist ends", () => {
    game.start();
    expect(() => game.getResult()).toThrow();
  });

  it("rejects an unknown difficulty", () => {
    expect(() => newGame(7 as Difficulty)).toThrow(RangeError);
  });
});
