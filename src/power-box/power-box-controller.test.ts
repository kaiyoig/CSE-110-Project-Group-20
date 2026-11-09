import { describe, it, expect, vi, beforeEach } from "vitest";
import { PowerBoxController } from "./power-box-controller";
import { PowerBoxModel } from "./power-box-model";
import type { PowerBoxViewLike } from "./power-box-view";
import type { PowerBoxPair } from "./power-box-generator";
import type { Question, StepAnswer } from "../questions/Question";

const PAIRS: PowerBoxPair[] = [
  { question: { prompt: "x * 2 + 3 = 13", answer: "5" } },
  { question: { prompt: "x / 2 - 1 = 3", answer: "8" } },
  { question: { prompt: "x * -3 + 4 = 10", answer: "-2" } },
];
// Right column: ["-2", "5", "8"]. Correct wires: left 0 → right 1, left 1 → right 2, left 2 → right 0.
const RIGHT_ORDER = [2, 0, 1];

/** A view that just records what the controller asked it to draw. */
class FakeView implements PowerBoxViewLike {
  onLeftPressed?: (left: number) => void;
  onRightPressed?: (right: number) => void;
  onCancel?: () => void;
  rendered: { equations: readonly string[]; answers: readonly string[] } | null = null;
  selected: number | null = null;
  connected: [number, number][] = [];
  wrong: number[] = [];
  security: [number, number] | null = null;
  destroyed = false;

  render(equations: readonly string[], answers: readonly string[]): void {
    this.rendered = { equations, answers };
  }
  setSelected(left: number | null): void {
    this.selected = left;
  }
  connect(left: number, right: number): void {
    this.connected.push([left, right]);
  }
  showWrong(right: number): void {
    this.wrong.push(right);
  }
  setSecurity(matched: number, total: number): void {
    this.security = [matched, total];
  }
  destroy(): void {
    this.destroyed = true;
  }

  /** Simulate the player: press a left plug, then a right plug. */
  wire(left: number, right: number): void {
    this.onLeftPressed?.(left);
    this.onRightPressed?.(right);
  }
}

describe("PowerBoxController", () => {
  let view: FakeView;
  let controller: PowerBoxController;
  let answers: StepAnswer[];
  let questions: Question[];
  let finished: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    view = new FakeView();
    controller = new PowerBoxController(new PowerBoxModel(PAIRS, RIGHT_ORDER), view);
    answers = [];
    questions = [];
    finished = vi.fn<() => void>();
    controller.onAnswer = (answer, question) => {
      answers.push(answer);
      questions.push(question);
    };
    controller.onFinished = finished;
  });

  it("draws the equations and the shuffled answers when it starts", () => {
    expect(view.rendered).toEqual({
      equations: ["x * 2 + 3 = 13", "x / 2 - 1 = 3", "x * -3 + 4 = 10"],
      answers: ["-2", "5", "8"],
    });
  });

  it("pressing a left plug selects it", () => {
    view.onLeftPressed?.(1);

    expect(controller.selectedLeft).toBe(1);
    expect(view.selected).toBe(1);
  });

  it("pressing another left plug changes the selection", () => {
    view.onLeftPressed?.(0);
    view.onLeftPressed?.(2);

    expect(view.selected).toBe(2);
  });

  it("a correct wire connects, lights one security light and sends a correct Step", () => {
    view.wire(0, 1);

    expect(view.connected).toEqual([[0, 1]]);
    expect(view.security).toEqual([1, 3]);
    expect(answers).toEqual([{ playerAnswer: "5", correctAnswer: "5", isLastStep: false }]);
    expect(questions).toEqual([PAIRS[0].question]);
    expect(view.selected).toBeNull();
  });

  it("a wrong wire flashes the answer, connects nothing and sends a wrong Step", () => {
    view.wire(0, 2);

    expect(view.wrong).toEqual([2]);
    expect(view.connected).toEqual([]);
    expect(answers).toEqual([{ playerAnswer: "8", correctAnswer: "5", isLastStep: false }]);
    expect(questions).toEqual([PAIRS[0].question]); // the equation the player was working on
    expect(view.selected).toBeNull();
  });

  it("pressing a right plug with nothing selected does nothing", () => {
    view.onRightPressed?.(1);

    expect(answers).toEqual([]);
    expect(view.wrong).toEqual([]);
  });

  it("connected wires can't be picked again", () => {
    view.wire(0, 1);
    view.onLeftPressed?.(0); // already connected
    expect(controller.selectedLeft).toBeNull();

    view.onLeftPressed?.(1);
    view.onRightPressed?.(1); // already taken by left 0
    expect(answers).toHaveLength(1);
    expect(controller.selectedLeft).toBe(1); // still waiting for a free value
  });

  it("connecting every wire sends the last Step and finishes once", () => {
    view.wire(0, 1);
    view.wire(1, 2);
    expect(finished).not.toHaveBeenCalled();

    view.wire(2, 0);

    expect(answers.map((a) => a.isLastStep)).toEqual([false, false, true]);
    expect(view.security).toEqual([3, 3]);
    expect(finished).toHaveBeenCalledTimes(1);
  });

  it("ignores presses after the box is finished", () => {
    view.wire(0, 1);
    view.wire(1, 2);
    view.wire(2, 0);
    view.onLeftPressed?.(0);

    expect(controller.selectedLeft).toBeNull();
    expect(answers).toHaveLength(3);
  });

  it("mistakes and correct tries are all reported, in order", () => {
    view.wire(0, 2); // wrong
    view.wire(0, 0); // wrong
    view.wire(0, 1); // right

    expect(answers.map((a) => a.playerAnswer === a.correctAnswer)).toEqual([false, false, true]);
  });

  it("cancelling a cable drops the selection without a Step or penalty", () => {
    view.onLeftPressed?.(0);
    view.onCancel?.();

    expect(controller.selectedLeft).toBeNull();
    expect(view.selected).toBeNull();
    expect(answers).toEqual([]);

    view.onRightPressed?.(1); // nothing selected any more
    expect(answers).toEqual([]);
  });

  it("destroy() stops listening to the view", () => {
    controller.destroy();

    expect(view.onLeftPressed).toBeUndefined();
    expect(view.onRightPressed).toBeUndefined();
    expect(view.onCancel).toBeUndefined();
  });
});
