import { NotificationManager } from "../notification-manager/NotificationManager";
import { EventType } from "../notification-manager/GameEvent";
import { getQuestion } from "../questions/QuestionGenerator";
import type { StepAnswer } from "../questions/Question";
import { ScoreController, ScoreModel } from "../score";
import type { Difficulty, ScoreSnapshot } from "../score";
import { MapController } from "../map/MapController";
import type { SwitchMapScreen } from "../map/MapController";
import { Room, type RoomKind } from "../map/Room";
import { AnswerHistory } from "../validation/AnswerHistory";
import type { AnswerRecord } from "../validation/AnswerHistory";
import { AnswerValidator } from "../validation/AnswerValidator";
import type { ScreenController } from "../screens/ScreenController";
import type { MapScreen, RoomScreen, Unsubscribe } from "../screens/contracts";

export type HeistOutcome = "escaped" | "caught";

export interface HeistResult {
  outcome: HeistOutcome;
  snapshot: ScoreSnapshot;
  history: AnswerRecord[];
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

/** The bank's Rooms, from the map layout in #30. */
export const ROOM_LAYOUT: readonly RoomLayout[] = [
  { id: "room_a", name: "Room A", kind: "main", prerequisites: [] },
  { id: "room_b", name: "Room B", kind: "main", prerequisites: [] },
  { id: "room_c", name: "Room C", kind: "main", prerequisites: ["room_a", "room_b"] },
  { id: "room_X", name: "Room X", kind: "bonus", prerequisites: [] },
  { id: VAULT_ID, name: "Vault", kind: "main", prerequisites: ["room_c"] },
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

  constructor(difficulty: Difficulty, deps: GameDeps) {
    this.notifications = deps.notifications;
    this.screens = deps.screens;
    this.mapScreen = deps.mapScreen;
    this.roomScreen = deps.roomScreen;

    // ScoreModel validates the value and throws a RangeError for an unknown difficulty.
    this.score = new ScoreController(new ScoreModel({ difficulty }));
    // The score changes only through events; score.dispose() unsubscribes.
    this.score.listenTo(this.notifications);
    this.map = new MapController(this.notifications);
    this.rooms = ROOM_LAYOUT.map(
      (r) => new Room({ ...r, question: getQuestion(difficulty) }),
    );
    this.rooms.forEach((room) => this.map.registerRoom(room));
    this.validator = new AnswerValidator(this.history, this.notifications);

    this.wire();
  }

  start(): void {
    this.mapScreen.setRooms(this.rooms, this.map.solvedRooms);
    this.updateHud();
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
    // Screen → Game. Every callback also checks `ended` as a second line of
    // defence, since the screens outlive the Heist.
    this.cleanups.push(
      this.mapScreen.onRoomClick((id) => {
        if (!this.ended) this.map.clickRoomButton(id); // map sends RoomEntered → clock runs
      }),
      this.roomScreen.onExit(() => {
        if (!this.ended) this.map.returnToMap(); // map sends ReturnedToMap → clock pauses
      }),
      this.roomScreen.onAnswer((answer) => this.handleAnswer(answer)),
    );

    // Map → screens.
    this.map.onAccessDenied = (payload) => {
      if (!this.ended) this.mapScreen.showAccessDenied(payload);
    };
    this.map.onScreenChange = (event) => this.handleScreenChange(event);

    // Score → HUD / ending. ScoreController.dispose() also drops these.
    this.cleanups.push(
      this.score.onChange(() => {
        if (!this.ended) this.updateHud();
      }),
      this.score.onTimeUp(() => {
        if (this.answering) this.pendingOutcome = "caught";
        else this.end("caught");
      }),
    );
  }

  private updateHud(): void {
    const m = this.score.getModel();
    const remaining = m.getTimeRemainingMs();
    const limit = m.getTimeLimitMs();
    const money = m.getMoney();
    this.mapScreen.setHud(remaining, limit, money);
    this.roomScreen.setHud(remaining, limit, money);
  }

  private handleScreenChange(event: SwitchMapScreen): void {
    if (this.ended) return;
    if (event.room) {
      this.roomScreen.setQuestion(event.room.question, event.room.name);
      this.updateHud();
      this.screens.show("room");
    } else if (event.screen === "map") {
      this.mapScreen.setRooms(this.rooms, this.map.solvedRooms);
      this.screens.show("map");
    }
  }

  private handleAnswer(answer: StepAnswer): void {
    const room = this.map.activeRoom;
    if (this.ended || !room) return;

    // The validator sends RoomSolved/Correct/Incorrect (the score listens to
    // them) and records the Answer. A wrong Answer can run the clock out in the middle of this call,
    // so onTimeUp only flags the ending until the Answer has been recorded.
    this.answering = true;
    let correct: boolean;
    try {
      correct = this.validator.validateAnswer(room.question, answer, room.kind);
    } finally {
      this.answering = false;
    }

    // The clock can also hit zero between ticks; a solve is then rejected by
    // the score, so the Heist ends Caught rather than Escaped.
    if (this.pendingOutcome || this.score.getModel().isTimeUp()) {
      this.end("caught");
      return;
    }
    if (!correct || !answer.isLastStep) return; // stay in the Room

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
