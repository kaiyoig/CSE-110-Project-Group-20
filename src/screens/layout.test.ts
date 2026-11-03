import { describe, it, expect, vi } from "vitest";

vi.mock("konva", () => import("./testing/fakeKonva"));

import Konva from "konva";
import { DESIGN_HEIGHT, DESIGN_WIDTH, fitLayer } from "./layout";

describe("fitLayer", () => {
  it("scales the design space to fit a wider stage and centers it horizontally", () => {
    const layer = new Konva.Layer();

    fitLayer(layer, DESIGN_WIDTH * 2 + 200, DESIGN_HEIGHT * 2);

    expect(layer.scale()).toEqual({ x: 2, y: 2 });
    expect(layer.position()).toEqual({ x: 100, y: 0 });
  });

  it("letterboxes a taller stage vertically", () => {
    const layer = new Konva.Layer();

    fitLayer(layer, DESIGN_WIDTH / 2, DESIGN_HEIGHT);

    expect(layer.scale()).toEqual({ x: 0.5, y: 0.5 });
    expect(layer.position()).toEqual({ x: 0, y: DESIGN_HEIGHT / 4 });
  });
});
