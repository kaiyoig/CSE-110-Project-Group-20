import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Game, VAULT_ID } from "./Game";
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
import type { MapGrid } from "../map/MapGrid";
import type { MapFloor } from "../map/MapLayout";
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

/** MapScreen fake: records grid/floor state from Game and provides room click hooks. */
class FakeMapScreen implements MapScreen {
  readonly layer = {} as Konva.Layer;
  grid: MapGrid | null = null;
  floors: readonly MapFloor[] = [];
  activeFloorIndex = 0;
  rooms: readonly Room[] = [];
  solved: string[] = [];
  hud: Hud | null = null;
  denied: AccessDeniedPayload[] = [];
  readonly roomClick = new Slot<[string]>();

  show(): void {}
  hide(): void {}

  setGrid(grid: MapGrid, solvedRoomIds: ReadonlySet<string>): void {
    this.grid = grid;
    this.rooms = grid.getAllRooms().map((placed) => placed.room);
    this.solved = [...solvedRoomIds];
  }

  setFloors(
    floors: readonly MapFloor[],
    solvedRoomIds: ReadonlySet<string>,
    activeFloorIndex?: number,
  ): void {
    this.floors = floors;
    if (activeFloorIndex !== undefined) {
      this.activeFloorIndex = activeFloorIndex;
    }
    const active = floors[this.activeFloorIndex] ?? floors[0];
    if (active) {
      this.grid = active.grid;
    }
    this.rooms = floors.flatMap((f) => f.grid.getAllRooms().map((placed) => placed.room));
    this.solved = [...solvedRoomIds];
  }

  selectFloor(index: number): void {
    this.activeFloorIndex = index;
    const active = this.floors[index];
    if (active) {
      this.grid = active.grid;
    }
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
    const target = id.toLowerCase();
    const found = this.rooms.find(
      (r) => r.id === id || r.id.toLowerCase() === target,
    );
    if (!found) throw new Error(`no room ${id}`);
    return found;
  }
}

/** RoomScreen fake: records the Room and HUD, and lets tests answer and exit. */
class FakeRoomScreen implements RoomScreen {
  readonly layer = {} as Konva.Layer;
  room: Room | null = null;
  question: Question | null = null;
  roomName = "";
  setRoomCalls = 0;
  lastHint: number | null = null;
  hud: Hud | null = null;
  readonly answer = new Slot<[StepAnswer]>();
  readonly exit = new Slot<[]>();
  readonly hint = new Slot<[]>();

  show(): void {}
  hide(): void {}

  setRoom(room: Room): void {
    this.room = room;
    this.lastHint = null;
    this.question = room.question;
    this.roomName = room.name;
    this.setRoomCalls += 1;
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
  onHint(cb: () => void): Unsubscribe {
    return this.hint.set(cb);
  }
  showHint(hintNumber: number | null): void {
    this.lastHint = hintNumber;
  }
  useHint(): void {
    this.hint.fire();
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

  /** Solves the full Easy prerequisite chain leading up to (but not including) the Vault. */
  function solveEasyPathToVault(): void {
    enterAndSolve("room_a");
    enterAndSolve("room_b");
    enterAndSolve("room_c");
    enterAndSolve("room_d");
    enterAndSolve("room_e");
    enterAndSolve("room_f");
    enterAndSolve("room_g");
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

  it("start() sends GameStart, gives MapScreen the 10 Easy Rooms across 2 floors with none Solved, sets both HUDs and shows the map", () => {
    game.start();

    expect(events).toEqual([EventType.GameStart]);
    expect(mapScreen.grid).not.toBeNull();
    expect(mapScreen.rooms).toHaveLength(10);
    const roomIds = new Set(mapScreen.rooms.map((r) => r.id.toLowerCase()));
    expect(roomIds).toEqual(
      new Set([
        "room_a",
        "room_b",
        "room_c",
        "room_d",
        "bonus_1",
        "room_e",
        "room_f",
        "room_g",
        "bonus_2",
        "vault",
      ]),
    );
    expect(mapScreen.solved).toEqual([]);

    const startHud = { timeRemainingMs: DEFAULT_TIME_LIMIT_MS, timeLimitMs: DEFAULT_TIME_LIMIT_MS, money: 0 };
    expect(mapScreen.hud).toEqual(startHud);
    expect(roomScreen.hud).toEqual(startHud);
    expect(shown).toEqual(["map"]);
  });

  it("uses the multi-floor Easy layout with bonus_1/bonus_2 as Bonus Rooms and prerequisites leading to Vault", () => {
    game.start();

    expect(mapScreen.room("bonus_1").kind).toBe("bonus");
    expect(mapScreen.room("bonus_2").kind).toBe("bonus");
    expect(mapScreen.room("room_c").prerequisites).toEqual(["room_a", "room_b"]);
    expect(mapScreen.room("room_g").prerequisites).toEqual(["room_e", "room_f"]);
    expect(mapScreen.room(VAULT_ID).prerequisites).toEqual(["room_g"]);
  });

  it("generates each Room's Question once and keeps it after leaving and re-entering", () => {
    game.start();
    const question = mapScreen.room("room_a").question;

    mapScreen.click("room_a");
    expect(roomScreen.question).toBe(question);
    roomScreen.leave();
    mapScreen.click("room_a");

    expect(roomScreen.question).toBe(question);
    expect(roomScreen.setRoomCalls).toBe(2);
    expect(mapScreen.room("room_a").question).toBe(question);
  });

  it("hands the Room Screen the whole Room, so it can build that Room's kind of puzzle", () => {
    game.start();

    mapScreen.click("room_b");

    expect(roomScreen.room).toBe(mapScreen.room("room_b"));
    expect(roomScreen.room?.puzzle.type).toBe("powerBox");
  });

  it("clicking a locked Room shows access denied, without a screen change or the clock starting", () => {
    game.start();

    mapScreen.click("room_c");
    vi.advanceTimersByTime(5000);

    expect(mapScreen.denied).toHaveLength(1);
    expect(mapScreen.denied[0].missingPrerequisiteIds).toEqual(["room_a", "room_b"]);
    expect(mapScreen.denied[0].missingPrerequisiteNames).toEqual(["KEYPAD A", "POWERBOX A"]);
    expect(shown).toEqual(["map"]);
    expect(mapScreen.hud?.timeRemainingMs).toBe(DEFAULT_TIME_LIMIT_MS);
  });

  it("entering a Room shows its Question, runs the clock and updates both HUDs on tick", () => {
    game.start();

    mapScreen.click("room_a");
    expect(roomScreen.question).toBe(mapScreen.room("room_a").question);
    expect(roomScreen.roomName).toBe("KEYPAD A");
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

  it("charges hints only against the room where they were used, even after re-entry", () => {
    game.start();
    mapScreen.click("room_a");
    roomScreen.useHint();
    roomScreen.leave();
    mapScreen.click("room_a");
    roomScreen.useHint();
    expect(roomScreen.lastHint).toBe(2);
    roomScreen.useHint(); // More than two hints cannot be charged.
    expect(roomScreen.lastHint).toBeNull();
    roomScreen.submit(lastStep(mapScreen.room("room_a").question));
    expect(mapScreen.hud?.money).toBe(50);
    expect(count(EventType.HintUsed)).toBe(2);
    enterAndSolve("room_b");
    expect(mapScreen.hud?.money).toBe(150);
  });

  it("a correct last Step in a Main Room solves it, adds money and returns to the map", () => {
    game.start();

    enterAndSolve("room_a");

    expect(mapScreen.solved).toEqual(["room_a"]);
    expect(mapScreen.hud?.money).toBe(ROOM_MONEY.main);
    expect(shown).toEqual(["map", "room", "map"]);
    expect(count(EventType.Correct)).toBe(2);
  });

  it("a correct last Step in bonus_1 earns bonus money and weight", () => {
    game.start();
    enterAndSolve("bonus_1");
    expect(mapScreen.hud?.money).toBe(ROOM_MONEY.bonus);

    solveEasyPathToVault();
    enterAndSolve(VAULT_ID);

    const { snapshot } = game.getResult();
    expect(snapshot.bonusRoomsSolved).toBe(1);
    expect(snapshot.roomsSolved).toBe(9);
    expect(snapshot.money).toBe(ROOM_MONEY.bonus + 8 * ROOM_MONEY.main);
    expect(snapshot.weightedCorrect).toBe(ROOM_SCORE_WEIGHT.bonus + 8 * ROOM_SCORE_WEIGHT.main);
  });

  it("a Solved Room can't be re-entered", () => {
    game.start();
    enterAndSolve("room_a");
    const setRoomCalls = roomScreen.setRoomCalls;

    mapScreen.click("room_a");

    expect(roomScreen.setRoomCalls).toBe(setRoomCalls);
    expect(shown).toEqual(["map", "room", "map"]);
  });

  it("solving the Vault sends GameOver once and the outcome is escaped", () => {
    game.start();
    solveEasyPathToVault();

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
    solveEasyPathToVault();
    mapScreen.click(VAULT_ID);
    vi.setSystemTime(Date.now() + DEFAULT_TIME_LIMIT_MS);

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
    enterAndSolve("room_d");
    enterAndSolve("room_e");
    enterAndSolve("room_f");
    enterAndSolve("room_g");
    enterAndSolve(VAULT_ID);

    const { history } = game.getResult();
    expect(history).toHaveLength(17);
    expect(history.slice(0, 3)).toMatchObject([
      { question, playerAnswer: "+", correctAnswer: "-", isCorrect: false, isLastStep: false },
      { question, playerAnswer: "-", correctAnswer: "-", isCorrect: true, isLastStep: false },
      { question, playerAnswer: question.answer, correctAnswer: question.answer, isCorrect: true, isLastStep: true },
    ]);
    expect(game.getResult().snapshot.flawless).toBe(false);
  });

  it("records an Answer under its own Question, and solves the Room only on solvesRoom", () => {
    game.start();
    mapScreen.click("room_a");
    roomScreen.useHint();
    const wireOne: Question = { prompt: "x + 1 = 3", answer: "2" };
    const wireTwo: Question = { prompt: "x + 2 = 7", answer: "5" };

    roomScreen.submit({ playerAnswer: "5", correctAnswer: "2", isLastStep: true, question: wireOne, solvesRoom: false });
    roomScreen.submit({ playerAnswer: "2", correctAnswer: "2", isLastStep: true, question: wireOne, solvesRoom: false });
    expect(shown[shown.length - 1]).toBe("room");
    expect(count(EventType.RoomSolved)).toBe(0);
    expect(mapScreen.hud?.money).toBe(0);

    roomScreen.submit({ playerAnswer: "5", correctAnswer: "5", isLastStep: true, question: wireTwo, solvesRoom: true });
    expect(count(EventType.RoomSolved)).toBe(1);
    expect(mapScreen.hud?.money).toBe(75);
    expect(mapScreen.solved).toEqual(["room_a"]);
    expect(shown[shown.length - 1]).toBe("map");

    enterAndSolve("room_b");
    enterAndSolve("room_c");
    enterAndSolve("room_d");
    enterAndSolve("room_e");
    enterAndSolve("room_f");
    enterAndSolve("room_g");
    enterAndSolve(VAULT_ID);
    const { history } = game.getResult();
    // Each wire is Step 1 of its own Question.
    expect(history.slice(0, 3)).toMatchObject([
      { question: wireOne, isCorrect: false, stepNumber: 1 },
      { question: wireOne, isCorrect: true, stepNumber: 1 },
      { question: wireTwo, isCorrect: true, stepNumber: 1 },
    ]);
  });

  it("counts Steps per Question and restarts them on re-entering the Room", () => {
    game.start();
    mapScreen.click("room_a");
    const question = mapScreen.room("room_a").question;
    roomScreen.submit(CORRECT_PICK);
    roomScreen.leave();
    mapScreen.click("room_a");
    roomScreen.submit(CORRECT_PICK);
    roomScreen.submit(lastStep(question));
    enterAndSolve("room_b");
    enterAndSolve("room_c");
    enterAndSolve("room_d");
    enterAndSolve("room_e");
    enterAndSolve("room_f");
    enterAndSolve("room_g");
    enterAndSolve(VAULT_ID);

    expect(game.getResult().history.slice(0, 3).map((r) => r.stepNumber)).toEqual([1, 1, 2]);
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

  it("preserves the active floor and solved-room state after completing a room on Floor 2", () => {
    game.start();

    // Clear Floor 1 prerequisites so Floor 2's room_e is unlocked
    enterAndSolve("room_a");
    enterAndSolve("room_b");
    enterAndSolve("room_c");

    // Switch to Floor 2 (index 1) and solve room_e
    mapScreen.selectFloor(1);
    expect(mapScreen.activeFloorIndex).toBe(1);
    expect(mapScreen.grid).toBe(mapScreen.floors[1].grid);

    enterAndSolve("room_e");

    expect(shown[shown.length - 1]).toBe("map");
    expect(mapScreen.activeFloorIndex).toBe(1);
    expect(mapScreen.grid).toBe(mapScreen.floors[1].grid);
    expect(mapScreen.solved).toContain("room_e");
  });
});