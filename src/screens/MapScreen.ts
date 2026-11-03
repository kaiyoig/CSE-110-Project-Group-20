import Konva from "konva";
import type { Room } from "../map/Room";
import type { AccessDeniedPayload } from "../map/MapController";
import type { MapScreen as MapScreenContract, Unsubscribe } from "./contracts";
import { Hud } from "./Hud";
import { DESIGN_HEIGHT, DESIGN_WIDTH, fitLayer } from "./layout";
import { Listeners } from "./listeners";
import { COLORS, createText, setCursor } from "./theme";

export type RoomState = "open" | "locked" | "solved";

interface RoomGeometry {
  bounds: [x: number, y: number, width: number, height: number];
  button: [x: number, y: number];
  lock: [x: number, y: number];
}

/** The bank's floor plan from #30, keyed by Room id. */
const FLOOR_PLAN: Record<string, RoomGeometry> = {
  room_a: { bounds: [116, 81, 368, 275], button: [204, 198], lock: [137, 101] },
  room_b: { bounds: [484, 81, 366, 275], button: [573, 198], lock: [505, 101] },
  room_c: { bounds: [116, 524, 734, 294], button: [388, 661], lock: [137, 544] },
  vault: { bounds: [1029, 81, 293, 443], button: [1080, 281], lock: [1051, 105] },
  room_X: { bounds: [1029, 521, 294, 297], button: [1080, 653], lock: [1051, 541] },
};

const BUTTON = { width: 191, height: 43 };
const TOOLTIP_WIDTH = 260;
const SOLVED_FLOOR = "#a8d8a0";

/**
 * The Map Screen: the floor plan, each Room's locked / Solved state, and the
 * HUD. Reworked from #30's createMapScreen (Calista, chartono) as a passive
 * screen on its own layer of the shared stage.
 */
export class MapScreen implements MapScreenContract {
  readonly layer = new Konva.Layer();

  private readonly roomClicks = new Listeners<[string]>();
  private readonly floors = new Konva.Group({ listening: false });
  private readonly controls = new Konva.Group();
  private readonly player: Konva.Circle;
  private readonly hud = new Hud();
  private readonly tooltip: Konva.Group;
  private readonly tooltipBackground: Konva.Rect;
  private readonly tooltipText: Konva.Text;

  constructor(stageWidth: number, stageHeight: number) {
    fitLayer(this.layer, stageWidth, stageHeight);

    this.layer.add(new Konva.Rect({
      width: DESIGN_WIDTH, height: DESIGN_HEIGHT,
      fill: COLORS.background,
      listening: false,
    }));
    // Corridor / overall floor plan.
    this.layer.add(new Konva.Rect({
      x: 116, y: 81, width: 1207, height: 737,
      fill: "rgba(217,217,217,0.5)",
      stroke: "black", strokeWidth: 3,
      listening: false,
    }));
    this.layer.add(this.floors);

    this.player = new Konva.Circle({
      x: 939.5, y: 773.5, radius: 18.5,
      fill: "#ff0404",
      stroke: "black", strokeWidth: 3,
      listening: false,
      name: "player",
    });
    this.layer.add(this.player);
    this.layer.add(this.controls);
    this.layer.add(this.hud);

    this.tooltip = new Konva.Group({ visible: false, listening: false, name: "tooltip" });
    this.tooltipBackground = new Konva.Rect({
      width: TOOLTIP_WIDTH, height: 58,
      fill: "white",
      cornerRadius: 15,
    });
    this.tooltipText = new Konva.Text({
      x: 12, y: 10, width: TOOLTIP_WIDTH - 24,
      fontFamily: "Freeman, sans-serif",
      fontSize: 16,
      lineHeight: 1.25,
      fill: COLORS.purple,
      name: "tooltip-text",
    });
    this.tooltip.add(this.tooltipBackground, this.tooltipText);
    this.layer.add(this.tooltip);
  }

  setRooms(rooms: readonly Room[], solvedRoomIds: ReadonlySet<string>): void {
    this.floors.destroyChildren();
    this.controls.destroyChildren();
    this.tooltip.visible(false);

    for (const room of rooms) {
      const geometry = FLOOR_PLAN[room.id];
      if (!geometry) {
        console.warn(`MapScreen has no floor plan for Room "${room.id}"`);
        continue;
      }
      const state: RoomState = solvedRoomIds.has(room.id)
        ? "solved"
        : room.isAccessible(solvedRoomIds) ? "open" : "locked";
      this.drawRoom(room, geometry, state);
    }
    this.layer.batchDraw();
  }

  setHud(timeRemainingMs: number, timeLimitMs: number, money: number): void {
    this.hud.setHud(timeRemainingMs, timeLimitMs, money);
  }

  showAccessDenied(payload: AccessDeniedPayload): void {
    const geometry = FLOOR_PLAN[payload.roomId];
    if (!geometry) return;

    // #30's wording, kept at the map author's request.
    const required = payload.missingPrerequisiteNames.join(", ");
    this.tooltipText.text(
      required
        ? `Complete ${required} to unlock ${payload.roomName}.`
        : `${payload.roomName} is locked.`,
    );

    const height = this.tooltipText.height() + 20;
    this.tooltipBackground.height(height);
    const [anchorX, anchorY] = geometry.lock;
    this.tooltip.position({
      x: Math.max(0, Math.min(anchorX + 52, DESIGN_WIDTH - TOOLTIP_WIDTH - 12)),
      y: Math.max(0, Math.min(anchorY + 8, DESIGN_HEIGHT - height - 12)),
    });
    this.tooltip.visible(true);
    this.tooltip.moveToTop();
    this.layer.batchDraw();
  }

  onRoomClick(cb: (roomId: string) => void): Unsubscribe {
    return this.roomClicks.add(cb);
  }

  /** Moves the player dot. Not part of the contract; Game doesn't call it. */
  setPlayerPosition(x: number, y: number): void {
    this.player.position({ x, y });
    this.layer.batchDraw();
  }

  show(): void {
    this.layer.show();
    this.layer.batchDraw();
  }

  hide(): void {
    this.tooltip.visible(false);
    this.layer.hide();
  }

  private drawRoom(room: Room, geometry: RoomGeometry, state: RoomState): void {
    const [x, y, width, height] = geometry.bounds;
    this.floors.add(new Konva.Rect({
      x, y, width, height,
      fill: state === "locked" ? COLORS.locked : state === "solved" ? SOLVED_FLOOR : COLORS.room,
      stroke: "black", strokeWidth: 3,
      name: `floor-${room.id}`,
    }));

    if (state === "locked") this.controls.add(this.createLock(geometry.lock));

    const button = new Konva.Group({
      x: geometry.button[0], y: geometry.button[1],
      name: `room-button-${room.id}`,
      roomState: state,
      listening: state !== "solved", // a Solved Room can't be entered again
    });
    button.add(new Konva.Rect({
      y: 4, ...BUTTON,
      cornerRadius: 24,
      fill: COLORS.purple,
      listening: false,
    }));
    button.add(new Konva.Rect({
      ...BUTTON,
      cornerRadius: 24,
      stroke: COLORS.purple, strokeWidth: 3,
      fill: state === "open" ? COLORS.button : COLORS.buttonDisabled,
    }));

    const isVault = room.id === "vault";
    if (isVault) {
      button.add(new Konva.Star({
        x: 49.5, y: 21.5,
        numPoints: 5, innerRadius: 4, outerRadius: 9,
        fill: COLORS.purple,
        listening: false,
      }));
    }
    button.add(createText({
      x: isVault ? 66 : 0,
      width: isVault ? 101 : BUTTON.width,
      height: BUTTON.height,
      text: room.name,
      align: "center", verticalAlign: "middle",
      fill: COLORS.purple,
      listening: false,
      name: "room-label",
    }));
    if (state === "solved") {
      button.add(createText({
        y: BUTTON.height + 10, width: BUTTON.width,
        text: "Solved",
        align: "center",
        fontSize: 20,
        fill: COLORS.purple,
        listening: false,
        name: "solved-label",
      }));
    }

    button.on("mouseenter", () => setCursor(button, "pointer"));
    button.on("mouseleave", () => setCursor(button, ""));
    button.on("click tap", () => {
      this.tooltip.visible(false);
      // MapController decides whether entry is allowed.
      this.roomClicks.emit(room.id);
      this.layer.batchDraw();
    });
    this.controls.add(button);
  }

  private createLock([x, y]: [number, number]): Konva.Group {
    const icon = new Konva.Group({ x, y, listening: false, name: "lock" });
    icon.add(new Konva.Path({ data: "M7 14V9a8 8 0 0 1 16 0v5", stroke: "white", strokeWidth: 1 }));
    icon.add(new Konva.Rect({ x: 0, y: 14, width: 31, height: 20, cornerRadius: 2, stroke: "white", strokeWidth: 1 }));
    icon.add(new Konva.Circle({ x: 15.5, y: 22, radius: 2, stroke: "white", strokeWidth: 1 }));
    icon.add(new Konva.Line({ points: [15.5, 24, 15.5, 28], stroke: "white", strokeWidth: 1 }));
    return icon;
  }
}
