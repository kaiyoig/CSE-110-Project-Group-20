import { describe, it, expect, beforeEach } from "vitest";
import { PowerBoxModel } from "./power-box-model";
import type { PowerBoxPair } from "./power-box-generator";

const PAIRS: PowerBoxPair[] = [
  { question: { prompt: "x * 2 + 3 = 13", answer: "5" } },
  { question: { prompt: "x / 2 - 1 = 3", answer: "8" } },
  { question: { prompt: "x * -3 + 4 = 10", answer: "-2" } },
];
// Right column shows the answers of pairs 2, 0, 1 → ["-2", "5", "8"]
const RIGHT_ORDER = [2, 0, 1];

describe("PowerBoxModel", () => {
  let box: PowerBoxModel;

  beforeEach(() => {
    box = new PowerBoxModel(PAIRS, RIGHT_ORDER);
  });

  it("shows equations on the left and shuffled answers on the right", () => {
    expect(box.equations()).toEqual(["x * 2 + 3 = 13", "x / 2 - 1 = 3", "x * -3 + 4 = 10"]);
    expect(box.answers()).toEqual(["-2", "5", "8"]);
    expect(box.size).toBe(3);
  });

  it("knows which right row matches each left row", () => {
    expect(box.correctRightFor(0)).toBe(1);
    expect(box.correctRightFor(1)).toBe(2);
    expect(box.correctRightFor(2)).toBe(0);
  });

  it("a correct match connects the wire and reports a correct Step for that Question", () => {
    const result = box.match(0, 1);

    expect(result).toEqual({
      correct: true,
      question: PAIRS[0].question,
      answer: { playerAnswer: "5", correctAnswer: "5", isLastStep: false },
    });
    expect(box.isLeftMatched(0)).toBe(true);
    expect(box.isRightMatched(1)).toBe(true);
    expect(box.matchedCount).toBe(1);
  });

  it("a wrong match changes nothing and reports what the player picked", () => {
    const result = box.match(0, 2);

    expect(result).toEqual({
      correct: false,
      question: PAIRS[0].question,
      answer: { playerAnswer: "8", correctAnswer: "5", isLastStep: false },
    });
    expect(box.isLeftMatched(0)).toBe(false);
    expect(box.isRightMatched(2)).toBe(false);
    expect(box.matchedCount).toBe(0);
  });

  it("only the Step that connects the last wire is the last Step", () => {
    expect(box.match(0, 1).answer.isLastStep).toBe(false);
    expect(box.match(1, 2).answer.isLastStep).toBe(false);
    expect(box.isFinished()).toBe(false);

    expect(box.match(2, 0).answer.isLastStep).toBe(true);
    expect(box.isFinished()).toBe(true);
  });

  it("wrong tries before the end are never the last Step", () => {
    box.match(0, 1);
    expect(box.match(1, 0).answer.isLastStep).toBe(false);
    expect(box.matchedCount).toBe(1);
  });

  it("ignores spaces around an answer", () => {
    const spaced = new PowerBoxModel([{ question: { prompt: "x = 3", answer: " 3 " } }], [0]);
    expect(spaced.answers()).toEqual(["3"]);
    expect(spaced.match(0, 0).answer).toEqual({ playerAnswer: "3", correctAnswer: "3", isLastStep: true });
  });

  it("questionAt() gives the Question on a left row", () => {
    expect(box.questionAt(2)).toBe(PAIRS[2].question);
  });

  it("throws when a connected wire is used again (a bug in the caller)", () => {
    box.match(0, 1);
    expect(() => box.match(0, 2)).toThrow(Error);
    expect(() => box.match(2, 1)).toThrow(Error);
  });

  it("throws on a row that doesn't exist", () => {
    expect(() => box.match(3, 0)).toThrow(RangeError);
    expect(() => box.match(0, -1)).toThrow(RangeError);
    expect(() => box.isLeftMatched(1.5)).toThrow(RangeError);
  });

  it("rejects two pairs with the same answer (an equation would have two matches)", () => {
    const twins: PowerBoxPair[] = [
      { question: { prompt: "x + 1 = 5", answer: "4" } },
      { question: { prompt: "x * 2 = 8", answer: " 4 " } },
    ];
    expect(() => new PowerBoxModel(twins, [1, 0])).toThrow(RangeError);
  });

  it("rejects an empty box or a bad right order", () => {
    expect(() => new PowerBoxModel([], [])).toThrow(RangeError);
    expect(() => new PowerBoxModel(PAIRS, [0, 1])).toThrow(RangeError);
    expect(() => new PowerBoxModel(PAIRS, [0, 0, 1])).toThrow(RangeError);
  });
});
