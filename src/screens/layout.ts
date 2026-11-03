import type Konva from "konva";

/** Every screen draws in this fixed design space (from the map design in #30). */
export const DESIGN_WIDTH = 1440;
export const DESIGN_HEIGHT = 900;

/**
 * Scales a layer so the design space fits the stage, and centers it
 * (letterboxed). Screens call this once, at construction.
 */
export function fitLayer(layer: Konva.Layer, stageWidth: number, stageHeight: number): void {
  const scale = Math.min(stageWidth / DESIGN_WIDTH, stageHeight / DESIGN_HEIGHT);
  const safe = Number.isFinite(scale) && scale > 0 ? scale : 1;
  layer.scale({ x: safe, y: safe });
  layer.position({
    x: (stageWidth - DESIGN_WIDTH * safe) / 2,
    y: (stageHeight - DESIGN_HEIGHT * safe) / 2,
  });
}
