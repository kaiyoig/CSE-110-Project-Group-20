import type Konva from "konva";

/** A full-screen view backed by its own Konva layer. */
export interface Screen {
  readonly layer: Konva.Layer;
  show(): void;
  hide(): void;
}

export type ScreenId = "start" | "map" | "room" | "end";

/**
 * Switches between registered Screens so exactly one is visible at a time.
 * Knows nothing about game rules.
 */
export class ScreenController {
  private readonly screens = new Map<ScreenId, Screen>();
  private currentId: ScreenId | null = null;

  constructor(private readonly stage: Konva.Stage) {}

  /** Adds the screen's layer to the stage and starts it hidden. Throws on a duplicate id. */
  register(id: ScreenId, screen: Screen): void {
    if (this.screens.has(id)) {
      throw new Error(`Screen "${id}" is already registered`);
    }
    this.screens.set(id, screen);
    this.stage.add(screen.layer);
    screen.hide();
  }

  /** Shows the given screen and hides every other one. Throws if the id is not registered. */
  show(id: ScreenId): void {
    const target = this.screens.get(id);
    if (!target) {
      throw new Error(`Screen "${id}" is not registered`);
    }
    for (const [otherId, screen] of this.screens) {
      if (otherId !== id) screen.hide();
    }
    target.show();
    this.currentId = id;
  }

  /** The id of the visible screen, or null before the first show. */
  current(): ScreenId | null {
    return this.currentId;
  }
}
