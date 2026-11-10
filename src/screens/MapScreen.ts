import Konva from "konva";
import type { Room } from "../map/Room";
import type { MapGrid } from "../map/MapGrid";
import type { AccessDeniedPayload } from "../map/MapController";
import type { MapScreen as MapScreenContract, Unsubscribe } from "./contracts";
import { Hud } from "./Hud";
import { DESIGN_HEIGHT, DESIGN_WIDTH, fitLayer } from "./layout";
import { Listeners } from "./listeners";
import { COLORS, BONUS_COLORS, VAULT_COLORS, createText, setCursor } from "./theme";

export type RoomState = "open" | "locked" | "solved";

interface RoomGeometry {
  bounds: [x: number, y: number, width: number, height: number];
  button: [x: number, y: number];
  lock: [x: number, y: number];
}

/** Fallback floor plan from #30, keyed by Room id. */
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

// Boundaries of the interior corridor area on canvas
const GRID_AREA = {
  x: 116,
  y: 81,
  width: 1207,
  height: 737,
  gap: 16,
};

export class MapScreen implements MapScreenContract {
  readonly layer = new Konva.Layer();

  private readonly roomClicks = new Listeners<[string]>();
  private readonly floors = new Konva.Group({ listening: false });
  private readonly controls = new Konva.Group();
  private readonly hud = new Hud();
  private readonly tooltip: Konva.Group;
  private readonly tooltipBackground: Konva.Rect;
  private readonly tooltipText: Konva.Text;

  /** Dynamic cache of active room positions for anchoring access-denied tooltips */
  private activeGeometry: Map<string, RoomGeometry> = new Map();

  constructor(stageWidth: number, stageHeight: number) {
    fitLayer(this.layer, stageWidth, stageHeight);

    this.layer.add(new Konva.Rect({
      width: DESIGN_WIDTH, height: DESIGN_HEIGHT,
      fill: COLORS.background,
      listening: false,
    }));
    // Corridor / overall floor plan boundary.
    this.layer.add(new Konva.Rect({
      x: GRID_AREA.x, y: GRID_AREA.y, width: GRID_AREA.width, height: GRID_AREA.height,
      fill: "rgba(217,217,217,0.5)",
      stroke: "black", strokeWidth: 3,
      listening: false,
    }));
    this.layer.add(this.floors);
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

  /**
   * Renders the 2D MapGrid dynamically according to rows and columns.
   */
  setGrid(grid: MapGrid, solvedRoomIds: ReadonlySet<string>): void {
    this.floors.destroyChildren();
    this.controls.destroyChildren();
    this.tooltip.visible(false);
    this.activeGeometry.clear();

    const cols = grid.columns;
    const rows = grid.rows;

    const totalGapW = (cols - 1) * GRID_AREA.gap;
    const totalGapH = (rows - 1) * GRID_AREA.gap;

    const tileWidth = Math.floor((GRID_AREA.width - totalGapW) / cols);
    const tileHeight = Math.floor((GRID_AREA.height - totalGapH) / rows);

    const placedRooms = grid.getAllRooms();

    for (const { room, row, column, colSpan, rowSpan } of placedRooms) {
      const rx = GRID_AREA.x + column * (tileWidth + GRID_AREA.gap);
      const ry = GRID_AREA.y + row * (tileHeight + GRID_AREA.gap);

      const roomWidth = colSpan * tileWidth + (colSpan - 1) * GRID_AREA.gap;
      const roomHeight = rowSpan * tileHeight + (rowSpan - 1) * GRID_AREA.gap;

      // Centered button inside tile bounds
      const bx = rx + Math.max(0, (roomWidth - BUTTON.width) / 2);
      const by = ry + Math.max(0, (roomHeight - BUTTON.height) / 2);

      // Lock icon at top-left of the room tile
      const lx = rx + 20;
      const ly = ry + 20;

      const geometry: RoomGeometry = {
        bounds: [rx, ry, roomWidth, roomHeight],
        button: [bx, by],
        lock: [lx, ly],
      };

      this.activeGeometry.set(room.id, geometry);

      const state: RoomState = solvedRoomIds.has(room.id)
        ? "solved"
        : room.isAccessible(solvedRoomIds) ? "open" : "locked";

      this.drawRoom(room, geometry, state);
    }

    this.layer.batchDraw();
  }

  /**
   * Original contract method: renders rooms using the fallback FLOOR_PLAN
   * (maintains full backward compatibility with existing tests).
   */
  setRooms(rooms: readonly Room[], solvedRoomIds: ReadonlySet<string>): void {
    this.floors.destroyChildren();
    this.controls.destroyChildren();
    this.tooltip.visible(false);
    this.activeGeometry.clear();

    for (const room of rooms) {
      const geometry = FLOOR_PLAN[room.id];
      if (!geometry) {
        console.warn(`MapScreen has no floor plan for Room "${room.id}"`);
        continue;
      }
      this.activeGeometry.set(room.id, geometry);

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
    const geometry = this.activeGeometry.get(payload.roomId) ?? FLOOR_PLAN[payload.roomId];
    if (!geometry) return;

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
    const isBonus = room.kind === "bonus";
    const isVault = room.id === "vault";

    // Floor Tile Styling
    let floorFill: string =COLORS.room;
    let floorStroke : string = "black";
    let strokeWidth = 3;

    if (state === "solved") {
      floorFill = SOLVED_FLOOR;
    } else if (isVault) {
      floorFill = state === "locked" ? VAULT_COLORS.floorLocked : VAULT_COLORS.floorOpen;
      floorStroke = state === "locked" ? VAULT_COLORS.borderLocked : VAULT_COLORS.borderOpen;
      strokeWidth = 4;
    } else if (state === "locked") {
      floorFill = COLORS.locked;
    } else if (isBonus) {
      floorFill = BONUS_COLORS.floor;
      floorStroke = BONUS_COLORS.border;
    }

    this.floors.add(new Konva.Rect({
      x, y, width, height,
      fill: floorFill,
      stroke: floorStroke,
      strokeWidth: isBonus ? 3 : 3,
      name: `floor-${room.id}`,
    }));

    // Lock Icon (if locked)
    if (state === "locked") this.controls.add(this.createLock(geometry.lock));

    // Button Setup
    const button = new Konva.Group({
      x: geometry.button[0],
      y: geometry.button[1],
      name: `room-button-${room.id}`,
      roomState: state,
      listening: state !== "solved",
    });

    // Drop shadow rect
    button.add(new Konva.Rect({
      y: 4,
      ...BUTTON,
      cornerRadius: 24,
      fill: isBonus ? BONUS_COLORS.buttonStroke : COLORS.purple,
      listening: false,
    }));

    // Foreground button rect
    let btnFill: string = COLORS.buttonDisabled;
    let btnStroke: string = COLORS.purple;

    if (isVault) {
      btnFill = state === "open" ? COLORS.button : VAULT_COLORS.buttonLocked;
      btnStroke = state === "open" ? COLORS.purple : VAULT_COLORS.buttonStrokeLocked;
    } else if (state === "open") {
      btnFill = isBonus ? BONUS_COLORS.buttonFill : COLORS.button;
      btnStroke = isBonus ? BONUS_COLORS.buttonStroke : COLORS.purple;
    }

    button.add(new Konva.Rect({
      ...BUTTON,
      cornerRadius: 24,
      stroke: btnStroke,
      strokeWidth: 3,
      fill: btnFill,
    }));

    // Icons: Star for Vault, Diamond for Bonus
    let textOffsetX = 0;
    let textWidth = BUTTON.width;

    if (isVault) {
      button.add(new Konva.Star({
        x: 49.5, y: 21.5,
        numPoints: 5, innerRadius: 4, outerRadius: 9,
        fill: state === "locked" ? VAULT_COLORS.buttonStar : COLORS.purple,
        listening: false,
      }));
      textOffsetX = 66;
      textWidth = 101;
    } else if (isBonus) {
      // Add a diamond badge for bonus room
      button.add(new Konva.RegularPolygon({
        x: 46, y: 21.5,
        sides: 4,
        radius: 9,
        fill: BONUS_COLORS.buttonStroke,
        listening: false,
      }));
      textOffsetX = 60;
      textWidth = 110;
    }

    // Room Label
    button.add(createText({
      x: textOffsetX,
      width: textWidth,
      height: BUTTON.height,
      text: room.name,
      align: "center",
      verticalAlign: "middle",
      fill: isBonus && state === "open" ? BONUS_COLORS.text : isVault && state === "locked" ? VAULT_COLORS.textLocked : COLORS.purple,
      listening: false,
      name: "room-label",
    }));

    // Solved Label
    if (state === "solved") {
      button.add(createText({
        y: BUTTON.height + 10,
        width: BUTTON.width,
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