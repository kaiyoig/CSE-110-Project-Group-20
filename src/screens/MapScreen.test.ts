import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("konva", () => import("./testing/fakeKonva"));

import type Konva from "konva";
import { MapScreen } from "./MapScreen";
import { Room } from "../map/Room";
import { MapGrid } from "../map/MapGrid";
import type { MapFloor } from "../map/MapLayout";
import { formatMoney } from "../score";
import { visibleTexts } from "./testing/fakeKonva";

const question = { prompt: "x * 2 + 1 = 5", answer: "2" };

function createRooms(): Room[] {
  return [
    new Room({ id: "room_a", name: "KEYPAD A", question }),
    new Room({
      id: "room_b",
      name: "POWERBOX A",
      question,
      puzzle: { type: "powerBox", pairs: [{ question, value: "2" } as any] },
    }),
    new Room({
      id: "room_c",
      name: "LASERS A",
      question,
      prerequisites: ["room_a", "room_b"],
      puzzle: { type: "laser", questions: [question] },
    }),
    new Room({ id: "room_x", name: "BONUS", question, kind: "bonus" }),
    new Room({ id: "vault", name: "VAULT", question, prerequisites: ["room_c"] }),
  ];
}

function createEasyGrid(rooms: Room[]): MapGrid {
  const [roomA, roomB, roomC, roomX, vault] = rooms;
  const grid = new MapGrid(3, 3);
  grid.placeRoom(roomA, 0, 0, 1, 1);
  grid.placeRoom(roomB, 0, 1, 1, 1);
  grid.placeRoom(vault, 0, 2, 1, 2); // 2 rows tall
  grid.placeRoom(roomC, 2, 0, 2, 1, { visualColSpan: 1.5 });
  grid.placeRoom(roomX, 2, 2, 1, 1);
  return grid;
}

describe("MapScreen", () => {
  let screen: MapScreen;

  function button(id: string): Konva.Group {
    const node = screen.layer.findOne<Konva.Group>(`.room-button-${id}`);
    if (!node) throw new Error(`no button for ${id}`);
    return node;
  }

  function floor(id: string): Konva.Rect {
    const node = screen.layer.findOne<Konva.Rect>(`.floor-${id}`);
    if (!node) throw new Error(`no floor for ${id}`);
    return node;
  }

  function state(id: string): string {
    return button(id).getAttr("roomState");
  }

  function tooltip(): { visible: boolean; text: string } {
    const group = screen.layer.findOne(".tooltip")!;
    return { visible: group.visible(), text: screen.layer.findOne<Konva.Text>(".tooltip-text")!.text() };
  }

  beforeEach(() => {
    screen = new MapScreen(1440, 900);
  });

  it("renders the Goal banner at the top of the MapScreen", () => {
    const banner = screen.layer.findOne<Konva.Group>(".goal-banner");
    const bannerText = screen.layer.findOne<Konva.Text>(".goal-banner-text");

    expect(banner).toBeDefined();
    expect(bannerText?.text()).toBe("★ GOAL: COMPLETE THE VAULT");
  });

  it("draws locked Rooms as locked and Solved Rooms as Solved", () => {
    const rooms = createRooms();
    const grid = createEasyGrid(rooms);

    screen.setGrid(grid, new Set(["room_a"]));

    expect(state("room_a")).toBe("solved");
    expect(state("room_b")).toBe("open");
    expect(state("room_c")).toBe("locked");
    expect(state("room_x")).toBe("open");
    expect(state("vault")).toBe("locked");
    expect(button("room_a").findOne(".solved-label")).toBeDefined();
    expect(screen.layer.find(".lock")).toHaveLength(2);
  });

  it("styles rooms with distinct floor colors based on puzzle type", () => {
    const rooms = createRooms();
    const grid = createEasyGrid(rooms);

    // Solve both prerequisites (room_a and room_b) so room_c is unlocked ("open")
    screen.setGrid(grid, new Set(["room_a", "room_b"]));

    expect(floor("room_b").fill()).toBe("#a6eda7ff"); // Solved Power Box
    expect(floor("room_c").fill()).toBe("#dfbcd0ff"); // Open Laser Match
    expect(floor("room_x").fill()).toBe("rgba(238, 229, 162, 1)");   // Open Bonus
  });

  it("renders interactive floor tabs on the left and switches floors on click", () => {
    const [roomA, roomB, roomC, roomX, vault] = createRooms();

    const floor1Grid = new MapGrid(3, 3);
    floor1Grid.placeRoom(roomA, 0, 0);
    floor1Grid.placeRoom(roomB, 0, 1);

    const floor2Grid = new MapGrid(3, 3);
    floor2Grid.placeRoom(roomC, 0, 0);
    floor2Grid.placeRoom(vault, 0, 2, 1, 2);
    floor2Grid.placeRoom(roomX, 2, 2);

    const floors: MapFloor[] = [
      { id: "floor_1", label: "Floor 1", grid: floor1Grid },
      { id: "floor_2", label: "Floor 2", grid: floor2Grid },
    ];

    screen.setFloors(floors, new Set(["room_a", "room_b"]), 0);

    // Initially on Floor 1
    expect(screen.layer.findOne(".room-button-room_a")).toBeDefined();
    expect(screen.layer.findOne(".room-button-vault")).toBeUndefined();

    // Floor tabs exist and Floor 2 tab is positioned to the right of Floor 1 tab on the left side
    const tab1 = screen.layer.findOne<Konva.Group>(".floor-tab-floor_1")!;
    const tab2 = screen.layer.findOne<Konva.Group>(".floor-tab-floor_2")!;
    expect(tab1.x()).toBe(116);
    expect(tab2.x()).toBeGreaterThan(tab1.x());

    // Clicking Floor 2 tab switches rendered grid to Floor 2
    tab2.fire("click");
    expect(screen.layer.findOne(".room-button-vault")).toBeDefined();
    expect(screen.layer.findOne(".room-button-room_a")).toBeUndefined();
  });

  it("sizes rooms using visualColSpan/visualRowSpan and centers the button inside visual bounds", () => {
    const rooms = createRooms();
    const grid = createEasyGrid(rooms);

    screen.setGrid(grid, new Set());

    // 3x3 grid inside GRID_AREA (width: 1207, height: 695, gap: 16)
    const tileWidth = (1207 - 2 * 16) / 3;
    const tileHeight = (695 - 2 * 16) / 3;

    // Room C has colSpan: 2, visualColSpan: 1.5
    const roomCFloor = floor("room_c");
    const expectedCWidth =
      Math.round(116 + 1.5 * tileWidth + 0.5 * 16) - 116;
    expect(roomCFloor.width()).toBe(expectedCWidth);

    const roomCButton = button("room_c");
    const expectedCButtonX = roomCFloor.x() + (expectedCWidth - 191) / 2;
    expect(roomCButton.x()).toBe(expectedCButtonX);

    // Vault has rowSpan: 2 and no visual override -> uses full 2-row height
    const vaultFloor = floor("vault");
    const expectedVaultHeight =
      Math.round(142 + 2 * tileHeight + 16) - 142;
    expect(vaultFloor.height()).toBe(expectedVaultHeight);
  });

  it("redraws from scratch on each setGrid call", () => {
    const rooms = createRooms();
    const grid = createEasyGrid(rooms);

    screen.setGrid(grid, new Set());
    screen.setGrid(grid, new Set());

    expect(screen.layer.find(".room-button-room_a")).toHaveLength(1);
  });

  it("unlocks a Room once its prerequisites are Solved", () => {
    const rooms = createRooms();
    const grid = createEasyGrid(rooms);

    screen.setGrid(grid, new Set(["room_a", "room_b"]));

    expect(state("room_c")).toBe("open");
    expect(state("vault")).toBe("locked");
  });

  it("labels Rooms from Room.name", () => {
    const rooms = createRooms();
    rooms[0] = new Room({ id: "room_a", name: "Lobby", question });

    screen.setRooms(rooms, new Set());

    expect(button("room_a").findOne<Konva.Text>(".room-label")!.text()).toBe("Lobby");
  });

  it("clicking a Room's button calls onRoomClick with its id", () => {
    const onRoomClick = vi.fn();
    screen.onRoomClick(onRoomClick);
    const rooms = createRooms();
    const grid = createEasyGrid(rooms);

    screen.setGrid(grid, new Set());

    button("room_b").fire("click");
    button("room_c").fire("tap");

    expect(onRoomClick.mock.calls).toEqual([["room_b"], ["room_c"]]);
  });

  it("makes a Solved Room's button non-interactive", () => {
    const rooms = createRooms();
    const grid = createEasyGrid(rooms);

    screen.setGrid(grid, new Set(["room_a"]));

    expect(button("room_a").listening()).toBe(false);
    expect(button("room_b").listening()).toBe(true);
  });

  it("stops calling onRoomClick once unsubscribed", () => {
    const onRoomClick = vi.fn();
    const unsubscribe = screen.onRoomClick(onRoomClick);
    screen.setRooms(createRooms(), new Set());

    unsubscribe();
    button("room_a").fire("click");

    expect(onRoomClick).not.toHaveBeenCalled();
  });

  it("showAccessDenied shows the tooltip with the missing prerequisite names", () => {
    const rooms = createRooms();
    const grid = createEasyGrid(rooms);
    screen.setGrid(grid, new Set());

    screen.showAccessDenied({
      roomId: "room_c",
      roomName: "LASERS A",
      missingPrerequisiteIds: ["room_a", "room_b"],
      missingPrerequisiteNames: ["KEYPAD A", "POWERBOX A"],
    });

    expect(tooltip()).toEqual({
      visible: true,
      text: "Complete KEYPAD A, POWERBOX A to unlock LASERS A.",
    });
  });

  it("falls back to 'is locked' when no prerequisite is named", () => {
    const rooms = createRooms();
    const grid = createEasyGrid(rooms);
    screen.setGrid(grid, new Set());

    screen.showAccessDenied({
      roomId: "vault",
      roomName: "VAULT",
      missingPrerequisiteIds: [],
      missingPrerequisiteNames: [],
    });

    expect(tooltip().text).toBe("VAULT is locked.");
  });

  it("hides the tooltip on the next Room click and on setGrid", () => {
    const rooms = createRooms();
    const grid = createEasyGrid(rooms);
    screen.setGrid(grid, new Set());

    const payload = {
      roomId: "vault",
      roomName: "VAULT",
      missingPrerequisiteIds: ["room_c"],
      missingPrerequisiteNames: ["LASERS A"],
    };

    screen.showAccessDenied(payload);
    button("room_a").fire("click");
    expect(tooltip().visible).toBe(false);

    screen.showAccessDenied(payload);
    screen.setGrid(grid, new Set());
    expect(tooltip().visible).toBe(false);
  });

  it("forwards setHud to its HUD", () => {
    screen.setHud(30_000, 60_000, 300);

    expect(visibleTexts(screen.layer)).toEqual(expect.arrayContaining([formatMoney(300), "00:00:30"]));
  });

  it("adds its layer to no Stage itself", () => {
    expect(screen.layer.getStage()).toBeNull();
  });

  it("show() and hide() toggle its layer", () => {
    screen.hide();
    expect(screen.layer.visible()).toBe(false);
    screen.show();
    expect(screen.layer.visible()).toBe(true);
  });
});