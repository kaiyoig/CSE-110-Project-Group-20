import Konva from "konva";
import BasicMultistepPuzzle from "../puzzles/basic-multistep-puzzle";
import { CONSOLE } from "../multistep-solver/multistep-console";
import PowerBoxPuzzle from "../puzzles/power-box-puzzle";
import LaserMatchPuzzle from "../puzzles/laser-match-puzzle";
import type Puzzle from "../puzzles/puzzle";
import type { Room } from "../map/Room";
import type { NotificationManager } from "../notification-manager/NotificationManager";
import { EventType } from "../notification-manager/GameEvent";
import type { StepAnswer } from "../questions/Question";
import { WRONG_ANSWER_PENALTY_SECONDS } from "../score";
import type { RoomScreen as RoomScreenContract, Unsubscribe } from "./contracts";
import { Hud } from "./Hud";
import { DESIGN_HEIGHT, DESIGN_WIDTH, fitLayer } from "./layout";
import { Listeners } from "./listeners";
import { COLORS, createBackground, createButton, createText } from "./theme";

/** The puzzle panel, centered at (x, y). */
const PUZZLE = { x: DESIGN_WIDTH / 2, y: 470, width: 960, height: 480, spacing: 24, blockSize: 40 };
/** The multistep console is larger and reaches further down the screen. */
const MULTISTEP = { x: DESIGN_WIDTH / 2, y: 160 + CONSOLE.height / 2 };
const PANEL_COLOR = "#4b5563";
/** How long the Correct / Incorrect line stays up. */
export const FEEDBACK_MS = 1000;

/**
 * The screen inside a Room: the Room name, the Room's puzzle (multistep,
 * Power Box or Laser Match), an Exit button and the HUD. Forwards every
 * Step's Answer to `onAnswer`, and shows a short Correct / Incorrect line
 * when the Answer is judged.
 */
export class RoomScreen implements RoomScreenContract {
  readonly layer = new Konva.Layer();

  private readonly answers = new Listeners<[StepAnswer]>();
  private readonly exits = new Listeners<[]>();
  private readonly hints = new Listeners<[]>();
  private readonly hud = new Hud();
  private readonly roomName: Konva.Text;
  private readonly feedback: Konva.Text;
  private puzzle: Puzzle | null = null;
  private activeRoom: Room | null = null;
  private readonly hintModal = new Konva.Group({ visible: false, name: "hint-modal" });
  private readonly hintMessage: Konva.Text;
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private originalFeedbackY?: number;

  constructor(stageWidth: number, stageHeight: number, notifications: NotificationManager) {
    fitLayer(this.layer, stageWidth, stageHeight);
    this.layer.add(createBackground());
    this.layer.add(this.hud);

    this.roomName = createText({
      y: 100, width: DESIGN_WIDTH,
      align: "center",
      fontSize: 40,
      fill: COLORS.gold,
      name: "room-name",
    });
    this.layer.add(this.roomName);

    this.layer.add(createButton({
      x: DESIGN_WIDTH - 225, y: 100,
      width: 170, height: 48,
      label: "Hint",
      name: "hint-button",
      onClick: () => this.requestHint(),
    }));

    this.layer.add(createButton({
      x: 20, y: 100,
      width: 140, height: 43,
      label: "Exit",
      name: "exit",
      onClick: () => {
        // A solved multistep room holds its last Answer while it shows the
        // answer; send it first so leaving through Exit still counts the solve.
        this.puzzle?.sendPendingAnswer?.();
        this.exits.emit();
      },
    }));

    this.feedback = createText({
      y: PUZZLE.y + PUZZLE.height / 2 + 24, width: DESIGN_WIDTH,
      align: "center",
      fontSize: 36,
      visible: false,
      listening: false,
      name: "feedback",
    });
    this.layer.add(this.feedback);

    // Figma 124:2: dim the game, show a large gray hint dialog and green return button.
    this.hintModal.add(new Konva.Rect({
      width: DESIGN_WIDTH, height: 900, fill: "rgba(0,0,0,0.55)", name: "hint-dim",
    }));
    this.hintModal.add(new Konva.Rect({
      x: 220, y: 90, width: 1000, height: 720,
      cornerRadius: 22, fill: COLORS.room, name: "hint-panel",
    }));
    this.hintModal.add(createText({
      x: 270, y: 150, width: 900, height: 90,
      text: "Hint", align: "center", fontSize: 64,
      fontFamily: "Gasoek One", fontStyle: "normal", fill: COLORS.gold,
      listening: false, name: "hint-heading",
    }));
    this.hintMessage = createText({
      x: 280, y: 295, width: 880, height: 300,
      align: "center", verticalAlign: "middle", fontSize: 39,
      lineHeight: 1.25, fill: COLORS.purple, listening: false,
      name: "hint-message",
    });
    this.hintModal.add(this.hintMessage);
    const backButton = createButton({
      x: 410, y: 667, width: 620, height: 90,
      label: "Back to Problem", fontSize: 39, name: "hint-back",
      onClick: () => {
        this.hintModal.hide();
        this.puzzle?.setInteractionEnabled?.(true);
        this.layer.batchDraw();
      },
    });
    // Figma uses a green face for the primary action.
    backButton.findOne<Konva.Rect>(".face")?.fill(COLORS.green);
    this.hintModal.add(backButton);
    this.layer.add(this.hintModal);

    // App-scoped, like the screen itself, so these are never unsubscribed.
    notifications.subscribe(EventType.Correct, () => this.showFeedback("Correct!", COLORS.green));
    notifications.subscribe(EventType.Incorrect, () => {
      this.hud.showPenalty();
      this.showFeedback(`Incorrect!`, COLORS.red)
    });
  }

  /**
   * Shows the Room and builds a fresh puzzle of the Room's kind, replacing
   * any previous one, so the Room restarts from Step 1.
   */
  setRoom(room: Room): void {
    this.destroyPuzzle();
    this.clearFeedback();
    this.roomName.text(room.name);
    // The Correct / Incorrect line goes just under whichever puzzle is shown.
    const bottom = room.puzzle.type === "multistep"
      ? MULTISTEP.y + CONSOLE.height / 2 + 6
      : PUZZLE.y + PUZZLE.height / 2 + 24;
    this.feedback.y(bottom);
    this.activeRoom = room;
    this.hintModal.hide();

    const puzzle = this.buildPuzzle(room);
    puzzle.onAnswer = (answer) => this.answers.emit(answer);
    this.puzzle = puzzle;
    this.feedback.moveToTop();
    this.layer.batchDraw();
  }

  setHud(timeRemainingMs: number, timeLimitMs: number, money: number): void {
    this.hud.setHud(timeRemainingMs, timeLimitMs, money);
  }

  onAnswer(cb: (answer: StepAnswer) => void): Unsubscribe {
    return this.answers.add(cb);
  }

  onExit(cb: () => void): Unsubscribe {
    return this.exits.add(cb);
  }

  onHint(cb: () => void): Unsubscribe {
    return this.hints.add(cb);
  }

  private requestHint(): void {
    if (!this.activeRoom || this.hintModal.visible()) return;
    this.hints.emit();
  }

  showHint(hintNumber: number | null): void {
    if (!this.activeRoom || this.hintModal.visible()) return;
    this.hintMessage.text(hintNumber === null
      ? "You have used both hints for this room. Keep trying!"
      : this.generateHint(this.activeRoom, hintNumber));
    this.puzzle?.setInteractionEnabled?.(false);
    this.hintModal.show();
    this.hintModal.moveToTop();
    this.layer.batchDraw();
  }

  private generateHint(room: Room, hintNumber: number): string {
    if (room.puzzle.type === "laser") {
      return hintNumber === 1
        ? "Compare each equation's slope with the direction and steepness of the graphs."
        : "Set x to zero to find the y-intercept, then check another point on the graph.";
    }
    if (room.puzzle.type === "powerBox") {
      return hintNumber === 1
        ? "Solve each wire's equation for x, then connect it to the matching value."
        : "Undo addition or subtraction first, then multiplication or division. Substitute the matching value back into its equation to check it.";
    }
    const expression = room.question.prompt;
    if (hintNumber === 1) {
      const division = expression.match(/x\s*\/\s*(\d+)/i);
      if (division) return `${expression}\n\nTo isolate x, try multiplying both sides by ${division[1]}.`;
      return `${expression}\n\nStart by getting the x terms on one side and the numbers on the other. Do the same operation to both sides.`;
    }
    return `${expression}\n\nUndo any multiplication or division around x, then substitute your answer back into the original equation to check it.`;
  }

  show(): void {
    this.layer.show();
    this.layer.batchDraw();
  }

  /** Leaving the Room drops the puzzle (and its text box) along with its progress. */
  hide(): void {
    this.destroyPuzzle();
    this.clearFeedback();
    this.activeRoom = null;
    this.hintModal.hide();
    this.layer.hide();
  }

  private buildPuzzle(room: Room): Puzzle {
    const panel = {
      layer: this.layer,
      x: PUZZLE.x,
      y: PUZZLE.y,
      width: PUZZLE.width,
      height: PUZZLE.height,
    };
    const { puzzle } = room;
    switch (puzzle.type) {
      case "multistep": {
        return new BasicMultistepPuzzle(room.question.prompt, { ...MULTISTEP, layer: this.layer });
      }
      case "powerBox":
        return new PowerBoxPuzzle(puzzle.pairs, {
          ...panel,
          backdrop: { width: DESIGN_WIDTH, height: DESIGN_HEIGHT },
        });
      case "laser":
        return new LaserMatchPuzzle(puzzle.questions, { ...panel, panelColor: PANEL_COLOR });
      default: {
        const unknown: never = puzzle;
        throw new Error(`Unknown Room puzzle: ${JSON.stringify(unknown)}`);
      }
    }
  }

  private destroyPuzzle(): void {
    this.puzzle?.destroy();
    this.puzzle = null;
  }

  private showFeedback(text: string, color: string): void {
    this.clearFeedback();

    // save the original position
    if (this.originalFeedbackY === undefined) {
      this.originalFeedbackY = this.feedback.y();
    }

  
    // only change feedback positioning for graph matching puzzles
    const isLaserMatching = this.activeRoom?.puzzle.type === 'laser';
    
    this.feedback.y(
      this.originalFeedbackY + (isLaserMatching ? 65 : 0)
    );

    this.feedback.text(text);
    this.feedback.fill(color);
    this.feedback.visible(true);
    this.layer.batchDraw();
    this.feedbackTimer = setTimeout(() => this.clearFeedback(), FEEDBACK_MS);
  }

  private clearFeedback(): void {
    if (this.feedbackTimer !== null) clearTimeout(this.feedbackTimer);
    this.feedbackTimer = null;
    this.feedback.visible(false);
    this.layer.batchDraw();
  }
}
