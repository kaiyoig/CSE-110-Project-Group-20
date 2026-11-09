import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("konva", () => import("../screens/testing/fakeKonva"));

import Konva from "konva";
import { PowerBoxView, WIRE_COLORS, WRONG_FLASH_MS, RETRACT_MS, SPARK_MS, SNAP_RADIUS } from "./power-box-view";
import { FakeNode, visibleTexts } from "../screens/testing/fakeKonva";

const PANEL = { x: 720, y: 470, width: 960, height: 480 };

describe("PowerBoxView", () => {
  let layer: Konva.Layer;
  let view: PowerBoxView;

  const root = () => layer as unknown as FakeNode;
  const find = (selector: string) => root().find(selector);
  const one = (selector: string) => root().findOne(selector)!;

  beforeEach(() => {
    vi.useFakeTimers();
    layer = new Konva.Layer();
    view = new PowerBoxView(layer, PANEL);
    view.render(["x * 2 + 3 = 13", "x / 2 - 1 = 3", "x * -3 + 4 = 10"], ["-2", "5", "8"]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the title, every equation and every answer, with · for multiplication", () => {
    const texts = visibleTexts(layer);
    expect(texts).toContain("⚡ SECURITY POWER BOX ⚡");
    for (const text of ["x · 2 + 3 = 13", "x / 2 - 1 = 3", "x · -3 + 4 = 10", "-2", "5", "8"]) {
      expect(texts).toContain(text);
    }
  });

  it("starts with security online and every light off", () => {
    expect(one(".status").text()).toBe("ONLINE: 3 LEFT");
    expect(find(".light-off")).toHaveLength(3);
    expect(find(".light-on")).toHaveLength(0);
  });

  it("makes room for 5 rows (Hard) without the screens overlapping", () => {
    view.render(["a", "b", "c", "d", "e"], ["1", "2", "3", "4", "5"]);

    // Each left row: [screen group (y = its top), jack, hole, ring]; the screen's first child is its box.
    const screens = [0, 1, 2, 3, 4].map((i) => one(`.left-${i}`).children[0]);
    const height = screens[0].children[0].height();
    for (let i = 1; i < screens.length; i++) {
      expect(screens[i].y() - screens[i - 1].y()).toBeGreaterThan(height);
    }
  });

  it("reports which left and right jacks are pressed", () => {
    const pressed: string[] = [];
    view.onLeftPressed = (left) => pressed.push(`L${left}`);
    view.onRightPressed = (right) => pressed.push(`R${right}`);

    one(".left-1").fire("mousedown");
    one(".right-2").fire("mouseup");
    one(".left-0").fire("touchstart");
    one(".right-0").fire("touchend");

    expect(pressed).toEqual(["L1", "R2", "L0", "R0"]);
  });

  it("shows a ring around the selected left jack only", () => {
    view.setSelected(1);
    const rings = find(".selection");
    expect(rings.map((ring) => ring.visible())).toEqual([false, true, false]);

    view.setSelected(null);
    expect(rings.every((ring) => !ring.visible())).toBe(true);
  });

  it("connect() draws a cable in the left row's colour and fills the right jack", () => {
    view.connect(1, 2);

    expect(one(".wire-1").stroke()).toBe(WIRE_COLORS[1]);
    expect(one(".right-2").findOne(".plug")!.fill()).toBe(WIRE_COLORS[1]);
  });

  it("showWrong() flashes the answer screen red, then back", () => {
    const box = one(".right-0").findOne(".label-box")!;
    const text = one(".right-0").findOne(".label-text")!;
    const normal = [box.fill(), text.fill()];

    view.showWrong(0);
    expect([box.fill(), text.fill()]).not.toEqual(normal);
    expect(text.fill()).toBe("#ff5a5a");

    vi.advanceTimersByTime(WRONG_FLASH_MS);
    expect([box.fill(), text.fill()]).toEqual(normal);
  });

  it("setSecurity() turns lights on and goes offline when every cable is connected", () => {
    view.setSecurity(2, 3);
    expect(find(".light-on")).toHaveLength(2);
    expect(one(".status").text()).toBe("ONLINE: 1 LEFT");

    view.setSecurity(3, 3);
    expect(find(".light-on")).toHaveLength(3);
    expect(one(".status").text()).toBe("OFFLINE");
  });

  it("render() again replaces the old rows and cables", () => {
    view.connect(0, 1);
    view.render(["x + 1 = 2", "x * 3 = 18"], ["6", "1"]);

    expect(find(".wire")).toHaveLength(0);
    expect(find(".light")).toHaveLength(2);
    expect(visibleTexts(layer)).not.toContain("x / 2 - 1 = 3");
  });

  it("connect() makes a spark that fades away", () => {
    view.connect(0, 1);
    expect(find(".spark")).toHaveLength(1);

    vi.advanceTimersByTime(SPARK_MS + 50);
    expect(find(".spark")).toHaveLength(0);
  });

  it("destroy() removes everything and cancels pending flashes", () => {
    view.showWrong(0);
    view.destroy();

    expect(find(".power-box")).toHaveLength(0);
    expect(() => vi.advanceTimersByTime(WRONG_FLASH_MS)).not.toThrow();
  });

  describe("with the server-room backdrop", () => {
    let screenLayer: Konva.Layer;
    let background: FakeNode;
    let hud: FakeNode;

    beforeEach(() => {
      // Like RoomScreen: a plain background first, then the HUD and title.
      screenLayer = new Konva.Layer();
      background = new Konva.Rect({ name: "background" }) as unknown as FakeNode;
      hud = new Konva.Group({ name: "hud" }) as unknown as FakeNode;
      screenLayer.add(background as never, hud as never);
    });

    it("draws the scene above the screen background but below the HUD", () => {
      new PowerBoxView(screenLayer, { ...PANEL, backdrop: { width: 1440, height: 900 } });

      const names = (screenLayer as unknown as FakeNode).children.map((c) => c.attrs.name);
      expect(names.slice(0, 3)).toEqual(["background", "power-box-backdrop", "hud"]);
    });

    it("draws no scene without the option", () => {
      new PowerBoxView(screenLayer, PANEL);

      expect((screenLayer as unknown as FakeNode).find(".power-box-backdrop")).toHaveLength(0);
    });

    it("destroy() removes the scene too", () => {
      const withScene = new PowerBoxView(screenLayer, { ...PANEL, backdrop: { width: 1440, height: 900 } });
      withScene.destroy();

      expect((screenLayer as unknown as FakeNode).find(".power-box-backdrop")).toHaveLength(0);
      expect(background.destroyed).toBe(false);
      expect(hud.destroyed).toBe(false);
    });
  });

  describe("dragging and clicking cables", () => {
    let stage: Konva.Stage;
    let pointer: { x: number; y: number } | null;
    let tried: number[];
    let cancels: number;
    const originalPointer = (FakeNode.prototype as any).getRelativePointerPosition;

    const stageNode = () => stage as unknown as FakeNode;
    /** Centre of a jack, in the panel's own coordinates (the same ones the pointer uses). */
    const jackAt = (side: "left" | "right", row: number) => {
      const hole = one(`.${side}-${row}`).findOne(".plug")!;
      return { x: hole.x() as number, y: hole.y() as number };
    };
    const moveTo = (point: { x: number; y: number }) => {
      pointer = point;
      stageNode().fire("mousemove");
    };
    /** Press on a node (a jack group or empty space): the node's handler runs, then the stage's. */
    const press = (node?: FakeNode) => {
      node?.fire("mousedown");
      stageNode().fire("mousedown");
    };
    const release = (node?: FakeNode) => {
      node?.fire("mouseup");
      stageNode().fire("mouseup");
    };

    beforeEach(() => {
      pointer = null;
      (FakeNode.prototype as any).getRelativePointerPosition = () => pointer;
      // The fake Stage needs no config; the real one requires it, so cast an empty one.
      stage = new Konva.Stage({} as Konva.StageConfig);
      layer = new Konva.Layer();
      stageNode().add(layer as unknown as FakeNode);
      view = new PowerBoxView(layer, PANEL);
      view.render(["x * 2 + 3 = 13", "x / 2 - 1 = 3", "x * -3 + 4 = 10"], ["-2", "5", "8"]);
      // Stand in for the controller.
      tried = [];
      cancels = 0;
      view.onLeftPressed = (left) => view.setSelected(left);
      view.onRightPressed = (right) => {
        tried.push(right);
        view.setSelected(null);
      };
      view.onCancel = () => {
        cancels++;
        view.setSelected(null);
      };
    });

    afterEach(() => {
      (FakeNode.prototype as any).getRelativePointerPosition = originalPointer;
    });

    it("while dragging, a dashed cable with a plug on the end follows the pointer", () => {
      moveTo(jackAt("left", 0));
      press(one(".left-0"));
      moveTo({ x: 500, y: 300 });

      expect(one(".preview").visible()).toBe(true);
      expect(one(".preview-cable")).toBeDefined();
      const plug = one(".plug-head");
      expect([plug.x(), plug.y()]).toEqual([500, 300]);
    });

    it("letting go of a drag on a right jack tries that cable", () => {
      moveTo(jackAt("left", 0));
      press(one(".left-0"));
      moveTo(jackAt("right", 2));
      release(one(".right-2"));

      expect(tried).toEqual([2]);
      expect(cancels).toBe(0);
    });

    it("near a free right jack the cable snaps to it and the jack lights up", () => {
      moveTo(jackAt("left", 0));
      press(one(".left-0"));
      const target = jackAt("right", 1);
      moveTo({ x: target.x - SNAP_RADIUS / 2, y: target.y + 10 });

      const rings = find(".snap");
      expect(rings.map((ring) => ring.visible())).toEqual([false, true, false]);
      expect([one(".plug-head").x(), one(".plug-head").y()]).toEqual([target.x, target.y]);

      release(); // let go just next to the jack, not on it
      expect(tried).toEqual([1]);
    });

    it("never snaps to a jack that already has a cable", () => {
      view.connect(0, 1);
      moveTo(jackAt("left", 1));
      press(one(".left-1"));
      moveTo(jackAt("right", 1));

      expect(find(".snap").some((ring) => ring.visible())).toBe(false);
    });

    it("letting go of a drag on empty space cancels and pulls the cable back", () => {
      moveTo(jackAt("left", 0));
      press(one(".left-0"));
      moveTo({ x: 480, y: 460 });
      release();

      expect(cancels).toBe(1);
      expect(tried).toEqual([]);
      expect(one(".preview").visible()).toBe(true); // still pulling back
      vi.advanceTimersByTime(RETRACT_MS + 50);
      expect(one(".preview").visible()).toBe(false);
    });

    it("click, then click: the cable stays selected between the clicks", () => {
      moveTo(jackAt("left", 2));
      press(one(".left-2"));
      release(); // a click on the left jack, no drag
      expect(cancels).toBe(0);
      expect(find(".selection")[2].visible()).toBe(true);

      moveTo({ x: 600, y: 300 });
      press(one(".right-0"));
      release(one(".right-0"));
      expect(tried).toEqual([0]);
    });

    it("clicking empty space cancels a selected cable", () => {
      moveTo(jackAt("left", 2));
      press(one(".left-2"));
      release();

      moveTo({ x: 480, y: 470 });
      press();
      expect(cancels).toBe(1);
    });

    it("clicking right next to a lit-up jack plugs in there", () => {
      moveTo(jackAt("left", 2));
      press(one(".left-2"));
      release();

      const target = jackAt("right", 0);
      moveTo({ x: target.x - 20, y: target.y });
      press(); // not on the jack itself
      expect(tried).toEqual([0]);
      expect(cancels).toBe(0);
    });
  });
});
