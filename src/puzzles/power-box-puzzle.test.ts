import { describe, it, expect, vi } from "vitest";

vi.mock("konva", () => import("../screens/testing/fakeKonva"));

import Konva from "konva";
import PowerBoxPuzzle from "./power-box-puzzle";
import type { PowerBoxPair } from "../power-box/power-box-generator";
import { visibleTexts } from "../screens/testing/fakeKonva";

const PAIRS: PowerBoxPair[] = [
  { question: { prompt: "x * 2 + 3 = 13", answer: "5" } },
  { question: { prompt: "x / 2 - 1 = 3", answer: "8" } },
  { question: { prompt: "x * -3 + 4 = 10", answer: "-2" } },
];
const OPTIONS = { x: 720, y: 480, width: 960, height: 520 };

describe("PowerBoxPuzzle", () => {
  it("shows the Questions it was given", () => {
    const layer = new Konva.Layer();
    new PowerBoxPuzzle(PAIRS, { layer, ...OPTIONS });

    const texts = visibleTexts(layer);
    for (const equation of ["x · 2 + 3 = 13", "x / 2 - 1 = 3", "x · -3 + 4 = 10"]) {
      expect(texts).toContain(equation);
    }
  });

  it("re-entering the Room (a new puzzle with the same pairs) shows the same equations", () => {
    const layer = new Konva.Layer();
    const equations = () => visibleTexts(layer).filter((text) => text.startsWith("x "));

    const first = new PowerBoxPuzzle(PAIRS, { layer, ...OPTIONS });
    const before = equations();
    first.destroy();
    new PowerBoxPuzzle(PAIRS, { layer, ...OPTIONS });

    expect(equations()).toEqual(before);
  });

  it("rejects a bad panel size", () => {
    const layer = new Konva.Layer();
    expect(() => new PowerBoxPuzzle(PAIRS, { layer, ...OPTIONS, width: 0 })).toThrow();
    expect(() => new PowerBoxPuzzle(PAIRS, { layer, ...OPTIONS, height: -1 })).toThrow();
  });
});
