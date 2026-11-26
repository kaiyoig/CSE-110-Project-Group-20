import Konva from "konva";
import BasicMultistepPuzzle from "../puzzles/basic-multistep-puzzle";
import { WRONG_ANSWER_PENALTY_SECONDS } from "../score";
import { HINT_REWARD_PENALTY_RATE, MAX_HINTS_PER_ROOM } from "../score/ScoreModel";
import type { Screen } from "./ScreenController";
import type { Unsubscribe } from "./contracts";
import { DESIGN_WIDTH, fitLayer } from "./layout";
import { Listeners } from "./listeners";
import { COLORS, createBackground, createButton, createText } from "./theme";

/** A real solver exercise, not a live room: no Game, clock or score events. */
export const PRACTICE_EQUATION = "x * 3 - 7 = 14";
const STEP_TITLES = ["PLAN THE HEIST", "CRACK THE EQUATION", "TRY THE KEYPAD", "HINTS & TIME"] as const;
const PRACTICE_STEP = 2;

export class TutorialScreen implements Screen {
  readonly layer = new Konva.Layer();
  private readonly menu = new Listeners<[]>();
  private readonly start = new Listeners<[]>();
  private readonly content = new Konva.Group();
  private readonly controls = new Konva.Group();
  private readonly title = createText({ y: 18, width: DESIGN_WIDTH, align: "center",
    fontSize: 42, fill: COLORS.gold, name: "tutorial-heading", listening: false });
  private readonly status = createText({ y: 69, width: DESIGN_WIDTH, align: "center",
    fontSize: 25, name: "tutorial-progress", listening: false });
  private step = 0;
  private practice: BasicMultistepPuzzle | null = null;

  constructor(stageWidth: number, stageHeight: number) {
    fitLayer(this.layer, stageWidth, stageHeight);
    this.layer.add(createBackground(), this.content, this.title, this.status, this.controls);
  }

  onMenu(cb: () => void): Unsubscribe { return this.menu.add(cb); }
  onStartHeist(cb: () => void): Unsubscribe { return this.start.add(cb); }

  show(): void {
    this.layer.show();
    this.goTo(0);
  }

  hide(): void {
    this.clearPractice();
    this.layer.hide();
  }

  private clearPractice(): void {
    this.practice?.destroy();
    this.practice = null;
  }

  private goTo(step: number): void {
    this.clearPractice();
    this.content.destroyChildren();
    this.controls.destroyChildren();
    this.step = Math.max(0, Math.min(STEP_TITLES.length - 1, step));
    this.title.text(STEP_TITLES[this.step]);
    this.status.text("TRAINING / " + (this.step + 1) + " OF " + STEP_TITLES.length);

    if (this.step === 0) this.drawMap();
    else if (this.step === 1) this.drawSolver();
    else if (this.step === PRACTICE_STEP) this.drawPractice();
    else this.drawRules();

    this.addNavigation();
    this.controls.moveToTop();
    this.layer.batchDraw();
  }

  private panel(x: number, y: number, width: number, height: number, fill: string = COLORS.room): void {
    this.content.add(new Konva.Rect({ x, y, width, height, fill, cornerRadius: 16,
      stroke: COLORS.purple, strokeWidth: 3, listening: false }));
  }

  private text(x: number, y: number, width: number, text: string, fontSize = 28, fill: string = COLORS.purple, align = "left"): void {
    this.content.add(createText({ x, y, width, text, fontSize, fill, align, lineHeight: 1.2, listening: false }));
  }

  private drawMap(): void {
    this.panel(90, 130, 1260, 650);
    this.text(130, 165, 1180, "Your mission: unlock the final vault.", 38);
    this.text(130, 225, 1180, "Choose an available room on the bank map. Solve its puzzle to open more rooms and earn money.", 29);
    const rooms = [
      { name: "KEYPAD", detail: "Solve for x", color: "#b5e1e5" },
      { name: "POWER BOX", detail: "Match equations to values", color: "#b5e1e5" },
      { name: "LASERS", detail: "Match equations to graphs", color: "#dfbcd0" },
      { name: "VAULT", detail: "Unlock by clearing required rooms", color: "#ffd447" },
    ];
    rooms.forEach((room, i) => {
      const x = 135 + i * 300;
      this.panel(x, 340, 270, 180, room.color);
      this.text(x + 12, 370, 246, room.name, 30, COLORS.purple, "center");
      this.text(x + 16, 428, 238, room.detail, 23, COLORS.purple, "center");
      if (i < rooms.length - 1) this.text(x + 270, 407, 30, "→", 28);
    });
    this.text(130, 560, 1180, "Explore floors using the floor tabs. Locked rooms require other rooms to be solved first. Bonus rooms are optional.", 29);
    this.text(130, 675, 1180, "Example route only — follow the actual map's room requirements.", 25, COLORS.darkGreen);
  }

  private drawSolver(): void {
    this.panel(90, 130, 1260, 650);
    this.text(130, 155, 1180, "Goal: isolate x. Work one step at a time.", 38);
    this.panel(130, 230, 1180, 105, "#152e21");
    this.text(155, 250, 1130, "3x − 7 = 14", 48, "#81ff38", "center");
    const examples = [
      ["1  MOVE", "Drag the −7 term into the drop socket.", "Choose ADD to undo subtraction on both sides."],
      ["2  CALCULATE", "The keypad asks: 14 + 7 = ?", "Enter 21 and press ENTER."],
      ["3  ISOLATE", "Drag the coefficient 3 into the socket.", "Choose DIVIDE, then enter 7 for 21 ÷ 3."],
    ];
    examples.forEach(([heading, line1, line2], i) => {
      const x = 130 + 400 * i;
      this.panel(x, 365, 380, 235, "#ffffff");
      this.text(x + 20, 385, 340, heading, 30);
      this.text(x + 20, 437, 340, line1, 25);
      this.text(x + 20, 510, 340, line2, 25);
    });
    this.text(130, 635, 1180, "Result: x = 7. Check: 3 × 7 − 7 = 14.", 32, COLORS.darkGreen);
    this.text(130, 700, 1180, "For non-integer results, enter a simplified fraction (e.g. 7/3), not a decimal.", 25);
  }

  private drawPractice(): void {
    this.status.text("TRAINING / 3 OF 4  ·  PRACTICE ONLY — NO TIMER OR SCORE");
    // The real puzzle needs a layer already attached to the stage. ScreenController
    // registers the layer before show() is ever called.
    const puzzle = new BasicMultistepPuzzle(PRACTICE_EQUATION, {
      layer: this.layer, x: DESIGN_WIDTH / 2, y: 450,
    });
    this.practice = puzzle;
    puzzle.onPuzzleFinished = (solved) => {
      if (solved && this.practice === puzzle) {
        this.status.text("PRACTICE COMPLETE!  ·  NEXT: HINTS & TIME");
        this.layer.batchDraw();
      }
    };
    // The solver's existing solved-panel Continue button dispatches its last
    // answer. In training, this advances the lesson rather than solving a room.
    puzzle.onAnswer = (answer) => {
      if (answer.isLastStep && this.practice === puzzle && answer.playerAnswer === answer.correctAnswer) {
        this.goTo(3);
      }
    };
  }

  private drawRules(): void {
    this.panel(90, 130, 1260, 650);
    this.text(130, 165, 1180, "Make every second count.", 38);
    const items = [
      ["TIME", "The clock counts down during the heist. A wrong answer costs " + WRONG_ANSWER_PENALTY_SECONDS + " seconds."],
      ["HINTS", "Each room allows " + MAX_HINTS_PER_ROOM + " hints. Each hint reduces that room's reward by " + Math.round(HINT_REWARD_PENALTY_RATE * 100) + "%."],
      ["REWARDS", "Solve required rooms to unlock the vault. Optional bonus rooms earn extra money."],
      ["REVIEW", "At the end of the heist, review your mistakes and learn from them."],
    ];
    items.forEach(([name, detail], i) => {
      const y = 245 + i * 125;
      this.panel(130, y, 1180, 104, "#ffffff");
      this.text(152, y + 18, 240, name, 30);
      this.text(390, y + 19, 885, detail, 27);
    });
  }

  private addNavigation(): void {
    const add = (x: number, name: string, label: string, action: () => void, width = 210, primary = false) => {
      const button = createButton({ x, y: 820, width, height: 54, fontSize: 26,
        label, name, onClick: action });
      if (primary) button.findOne<Konva.Rect>(".face")?.fill(COLORS.gold);
      this.controls.add(button);
    };
    add(100, "tutorial-menu", "Main menu", () => this.menu.emit());
    if (this.step > 0) add(330, "tutorial-back", "Back", () => this.goTo(this.step - 1), 150);
    if (this.step === PRACTICE_STEP) {
      add(500, "tutorial-retry", "Retry practice", () => this.goTo(PRACTICE_STEP), 245);
    }
    if (this.step === STEP_TITLES.length - 1) {
      add(770, "tutorial-replay", "Replay", () => this.goTo(0), 200);
      add(990, "tutorial-start", "Start heist", () => this.start.emit(), 350, true);
    } else {
      add(770, "tutorial-skip", "Skip tutorial", () => this.start.emit(), 250);
      add(1040, "tutorial-next", "Next", () => this.goTo(this.step + 1), 300, true);
    }
  }
}
