import type Konva from "konva";
import type { Difficulty } from "../score";
import type { Question, StepAnswer } from "../questions/Question";
import {
  generatePairs,
  shuffledOrder,
  type QuestionSource,
  type RandomFn,
} from "../power-box/power-box-generator";
import { PowerBoxModel } from "../power-box/power-box-model";
import { PowerBoxView } from "../power-box/power-box-view";
import { PowerBoxController } from "../power-box/power-box-controller";

export interface PowerBoxPuzzleOptions {
  layer: Konva.Layer;
  /** Center of the panel. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Where the Questions come from. Defaults to getQuestion (the QuestionGenerator). */
  makeQuestion?: QuestionSource;
  /** Shuffles the answers. Defaults to Math.random; pass a fixed one for a repeatable box. */
  random?: RandomFn;
  /**
   * Draw the server-room scene behind the box, at this size (usually the
   * screen's design size, 1440 × 900). Leave it out for just the box.
   */
  backdrop?: { width: number; height: number };
}

/**
 * The Power Box minigame, ready to put in a Room. It has the same shape as
 * BasicMultistepPuzzle (`onAnswer`, `onPuzzleFinished`, `destroy`), so the
 * Room Screen can use either one.
 */
class PowerBoxPuzzle {
  /**
   * Called with every wire the player tries (each one is a Step), and the
   * Question that wire belongs to. The power box has several Questions, so the
   * Room's own Question is not the one being answered.
   */
  public onAnswer?: (answer: StepAnswer, question: Question) => void;

  /** Called once when every wire is connected (security offline). */
  public onPuzzleFinished?: (solved: boolean) => void;

  private readonly view: PowerBoxView;
  private readonly controller: PowerBoxController;

  constructor(difficulty: Difficulty, options: PowerBoxPuzzleOptions) {
    if (!Number.isFinite(options.width) || options.width <= 0) {
      throw Error("PowerBoxPuzzle width must be a positive number.");
    }
    if (!Number.isFinite(options.height) || options.height <= 0) {
      throw Error("PowerBoxPuzzle height must be a positive number.");
    }
    const pairs = generatePairs(difficulty, options.makeQuestion);
    const model = new PowerBoxModel(pairs, shuffledOrder(pairs.length, options.random));

    this.view = new PowerBoxView(options.layer, options);
    this.controller = new PowerBoxController(model, this.view);
    this.controller.onAnswer = (answer, question) => this.onAnswer?.(answer, question);
    this.controller.onFinished = () => this.onPuzzleFinished?.(true);
  }

  /** Removes the power box from its layer. */
  public destroy(): void {
    this.onAnswer = undefined;
    this.onPuzzleFinished = undefined;
    this.controller.destroy();
    this.view.destroy();
  }
}

export default PowerBoxPuzzle;
