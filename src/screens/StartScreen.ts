import Konva from "konva";
import { Difficulty, DIFFICULTY_LABEL } from "../score";
import type { StartScreen as StartScreenContract, Unsubscribe } from "./contracts";
import { DESIGN_WIDTH, fitLayer } from "./layout";
import { Listeners } from "./listeners";
import { COLORS, createBackground, createButton, createText } from "./theme";

const DIFFICULTIES = [Difficulty.Easy, Difficulty.Medium, Difficulty.Hard] as const;
const BUTTON = { width: 260, height: 64, gap: 48, y: 520 };

/**
 * The first screen: the player picks a Difficulty, which starts the Heist.
 * Reworked from the start menu in #28 (Asad) as a passive Konva screen.
 */
export class StartScreen implements StartScreenContract {
  readonly layer = new Konva.Layer();
  private readonly starts = new Listeners<[Difficulty]>();

  constructor(stageWidth: number, stageHeight: number) {
    fitLayer(this.layer, stageWidth, stageHeight);
    this.layer.add(createBackground());

    this.layer.add(createText({
      y: 200, width: DESIGN_WIDTH,
      text: "Operation: Equation",
      align: "center",
      fontSize: 80,
      fill: COLORS.gold,
    }));
    this.layer.add(createText({
      y: 320, width: DESIGN_WIDTH,
      text: "Solve each Room's Question, reach the Vault, and escape before the clock runs out.",
      align: "center",
      fontSize: 28,
      fontStyle: "normal",
    }));
    this.layer.add(createText({
      y: 450, width: DESIGN_WIDTH,
      text: "Pick a Difficulty to start the Heist",
      align: "center",
      fontSize: 32,
    }));

    const rowWidth = DIFFICULTIES.length * BUTTON.width + (DIFFICULTIES.length - 1) * BUTTON.gap;
    DIFFICULTIES.forEach((difficulty, i) => {
      this.layer.add(createButton({
        x: (DESIGN_WIDTH - rowWidth) / 2 + i * (BUTTON.width + BUTTON.gap),
        y: BUTTON.y,
        width: BUTTON.width,
        height: BUTTON.height,
        fontSize: 32,
        label: DIFFICULTY_LABEL[difficulty],
        name: `difficulty-${DIFFICULTY_LABEL[difficulty].toLowerCase()}`,
        onClick: () => this.starts.emit(difficulty),
      }));
    });
  }

  onStart(cb: (difficulty: Difficulty) => void): Unsubscribe {
    return this.starts.add(cb);
  }

  show(): void {
    this.layer.show();
    this.layer.batchDraw();
  }

  hide(): void {
    this.layer.hide();
  }
}
