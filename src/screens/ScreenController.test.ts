import { describe, it, expect, vi, beforeEach } from "vitest";
import type Konva from "konva";
import { ScreenController, type Screen } from "./ScreenController";

function fakeScreen() {
  return { layer: {} as Konva.Layer, show: vi.fn(), hide: vi.fn() } satisfies Screen;
}

describe("ScreenController", () => {
  let stage: Konva.Stage;
  let controller: ScreenController;

  beforeEach(() => {
    stage = { add: vi.fn() } as unknown as Konva.Stage;
    controller = new ScreenController(stage);
  });

  describe("register", () => {
    it("adds the screen's layer to the stage and starts it hidden", () => {
      const screen = fakeScreen();
      controller.register("start", screen);

      expect(stage.add).toHaveBeenCalledWith(screen.layer);
      expect(screen.hide).toHaveBeenCalledTimes(1);
      expect(screen.show).not.toHaveBeenCalled();
    });

    it("throws when the same id is registered twice", () => {
      controller.register("map", fakeScreen());

      expect(() => controller.register("map", fakeScreen())).toThrow(/map/);
    });
  });

  describe("show", () => {
    it("shows exactly one screen and hides all the others", () => {
      const start = fakeScreen();
      const map = fakeScreen();
      const room = fakeScreen();
      controller.register("start", start);
      controller.register("map", map);
      controller.register("room", room);
      for (const s of [start, map, room]) {
        s.show.mockClear();
        s.hide.mockClear();
      }

      controller.show("map");

      expect(map.show).toHaveBeenCalledTimes(1);
      expect(map.hide).not.toHaveBeenCalled();
      expect(start.show).not.toHaveBeenCalled();
      expect(start.hide).toHaveBeenCalledTimes(1);
      expect(room.show).not.toHaveBeenCalled();
      expect(room.hide).toHaveBeenCalledTimes(1);
    });

    it("throws an error naming an unregistered id", () => {
      controller.register("start", fakeScreen());

      expect(() => controller.show("end")).toThrow(/end/);
    });
  });

  describe("current", () => {
    it("is null before the first show, then reflects the last show", () => {
      controller.register("start", fakeScreen());
      controller.register("map", fakeScreen());
      expect(controller.current()).toBeNull();

      controller.show("start");
      expect(controller.current()).toBe("start");

      controller.show("map");
      expect(controller.current()).toBe("map");
    });
  });
});
