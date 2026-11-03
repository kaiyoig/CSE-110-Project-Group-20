import { NotificationManager } from "../notification-manager/NotificationManager";
import { EventType } from "../notification-manager/GameEvent";
import { getQuestion } from "../questions/QuestionGenerator";
import { ScoreController, ScoreModel } from "../score";
import type { Difficulty, RoomKind, ScoreSnapshot } from "../score";
import { MapController } from "../map/MapController";
import type { SwitchMapScreen } from "../map/MapController";
import { Room } from "../map/Room";
import { AnswerHistory } from "../validation/AnswerHistory";
import type { ProblemResult } from "../validation/AnswerHistory";
import { AnswerValidator } from "../validation/AnswerValidator";
import type { ScreenController } from "../screens/ScreenController";
import type { MapScreen, RoomScreen, Unsubscribe } from "../screens/contracts";

export type HeistOutcome = "escaped" | "caught";

export interface HeistResult {
  outcome: HeistOutcome;
  snapshot: ScoreSnapshot;
  history: ProblemResult[];
}

export interface GameDeps {
  notifications: NotificationManager;
  screens: ScreenController;
  mapScreen: MapScreen;
  roomScreen: RoomScreen;
}

interface RoomLayout {
  id: string;
  name: string;
  kind: RoomKind;
  prerequisites: string[];
}

export const VAULT_ID = "vault";

/** Placeholder layout. The map owner provides the real one later. */
export const ROOM_LAYOUT: readonly RoomLayout[] = [
  { id: "room-1", name: "Room 1", kind: "main", prerequisites: [] },
  { id: "room-2", name: "Room 2", kind: "main", prerequisites: [] },
  { id: "room-3", name: "Room 3", kind: "main", prerequisites: [] },
  { id: "bonus-1", name: "Bonus Room", kind: "bonus", prerequisites: [] },
  { id: VAULT_ID, name: "Vault", kind: "main", prerequisites: ["room-1", "room-2", "room-3"] },
];

/**
 * One Heist. Builds the heist-scoped modules and wires them to the
 * app-scoped screens (see docs/adr/0001-commands-vs-events.md).
 *
 * Lifecycle: `new Game(...)` → `start()` → … → `GameOver` is sent →
 * the owner reads `getResult()` and calls `dispose()`.
 */
export class Game {
  private readonly notifications: NotificationManager;
  private readonly screens: ScreenController;
  private readonly mapScreen: MapScreen;
  private readonly roomScreen: RoomScreen;

  private readonly score: ScoreController;
  private readonly rooms: Room[];
  private readonly map: MapController;
  private readonly history = new AnswerHistory();
  private readonly validator: AnswerValidator;

  /** Unsubscribers for everything Game registered on longer-lived objects. */
  private readonly cleanups: Unsubscribe[] = [];

  private ended = false;
  private result: HeistResult | null = null;
  /** True while validateAnswer runs, so onTimeUp can defer the ending. */
  private answering = false;
  private pendingOutcome: HeistOutcome | null = null;

  constructor(difficulty: number, deps: GameDeps) {
    this.notifications = deps.notifications;
    this.screens = deps.screens;
    this.mapScreen = deps.mapScreen;
    this.roomScreen = deps.roomScreen;

    // ScoreModel validates the value and throws a RangeError for an unknown difficulty.
    this.score = new ScoreController(new ScoreModel({ difficulty: difficulty as Difficulty }));
    this.map = new MapController(this.score);
    this.rooms = ROOM_LAYOUT.map(
      (r) => new Room({ ...r, question: getQuestion(difficulty) }),
    );
    this.rooms.forEach((room) => this.map.registerRoom(room));
    this.validator = new AnswerValidator(this.history, this.score, this.notifications);

    this.wire();
  }

  start(): void {
    this.mapScreen.setRooms(this.rooms);
    this.screens.show("map");
    this.notifications.send({ eventType: EventType.GameStart });
  }

  /** The frozen result of the Heist. Throws if the Heist hasn't ended. */
  getResult(): HeistResult {
    if (!this.result) throw new Error("The Heist hasn't ended yet");
    return this.result;
  }

  dispose(): void {
    this.ended = true;
    this.cleanups.splice(0).forEach((unsubscribe) => unsubscribe());
    this.map.onScreenChange = null;
    this.map.onAccessDenied = null;
    this.score.dispose();
  }

  private wire(): void {
    // Screen → Game. Screens are app-scoped, so every callback checks `ended`
    // in case the screen's onX can't be unsubscribed.
    this.track(this.mapScreen.onRoomClick((id) => {
      if (!this.ended) this.map.clickRoomButton(id);
    }));
    this.track(this.roomScreen.onExit(() => {
      if (!this.ended) this.map.returnToMap();
    }));
    this.track(this.roomScreen.onAnswer((answer) => this.handleAnswer(answer)));

    // Map → screens.
    this.map.onAccessDenied = (payload) => {
      if (!this.ended) this.mapScreen.showAccessDenied(payload);
    };
    this.map.onScreenChange = (event) => this.handleScreenChange(event);

    // Score → HUD / ending. ScoreController.dispose() also drops these.
    this.track(this.score.onChange((m) => {
      if (!this.ended) this.roomScreen.setHud(m.getTimeRemainingMs(), m.getMoney());
    }));
    this.track(this.score.onTimeUp(() => {
      if (this.answering) this.pendingOutcome = "caught";
      else this.end("caught");
    }));
  }

  private track(unsubscribe: Unsubscribe | void): void {
    if (unsubscribe) this.cleanups.push(unsubscribe);
  }

  private handleScreenChange(event: SwitchMapScreen): void {
    if (this.ended) return;
    if (event.room) {
      const model = this.score.getModel();
      this.roomScreen.setQuestion(event.room.question, event.room.name);
      this.roomScreen.setHud(model.getTimeRemainingMs(), model.getMoney());
      this.screens.show("room");
    } else if (event.screen === "map") {
      this.mapScreen.setRooms(this.rooms);
      this.screens.show("map");
    }
  }

  private handleAnswer(answer: string): void {
    const room = this.map.activeRoom;
    if (this.ended || !room) return;

    // The validator calls the score, sends Correct/Incorrect and records the
    // Answer. A wrong Answer can run the clock out in the middle of this call,
    // so onTimeUp only flags the ending until the Answer has been recorded.
    this.answering = true;
    let correct: boolean;
    try {
      correct = this.validator.validateAnswer(room.question, answer, room.kind);
    } finally {
      this.answering = false;
    }

    if (this.pendingOutcome) {
      this.end(this.pendingOutcome);
      return;
    }
    if (!correct) return; // stay in the Room

    if (room.id === VAULT_ID) {
      this.map.solveVault(VAULT_ID);
      this.end("escaped");
    } else {
      this.map.solveRoom(room.id);
      this.map.returnToMap();
    }
  }

  private end(outcome: HeistOutcome): void {
    if (this.ended) return;
    this.ended = true;
    this.score.dispose(); // stop the clock
    this.result = {
      outcome,
      snapshot: this.score.getModel().snapshot(),
      history: this.history.getResults(),
    };
    this.notifications.send({ eventType: EventType.GameOver });
  }
}
