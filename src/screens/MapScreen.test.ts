import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("konva", () => import("./testing/fakeKonva"));

import type Konva from "konva";
import { MapScreen } from "./MapScreen";
import { Room } from "../map/Room";
import { formatMoney } from "../score";
import { visibleTexts } from "./testing/fakeKonva";

const question = { prompt: "x * 2 + 1 = 5", answer: "2" };

function layout(): Room[] {
  return [
    new Room({ id: "room_a", name: "Room A", question }),
    new Room({ id: "room_b", name: "Room B", question }),
    new Room({ id: "room_c", name: "Room C", question, prerequisites: ["room_a", "room_b"] }),
    new Room({ id: "room_X", name: "Room X", question, kind: "bonus" }),
    new Room({ id: "vault", name: "Vault", question, prerequisites: ["room_c"] }),
  ];
}

describe("MapScreen", () => {
  let screen: MapScreen;

  function button(id: string): Konva.Group {
    const node = screen.layer.findOne<Konva.Group>(`.room-button-${id}`);
    if (!node) throw new Error(`no button for ${id}`);
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

  it("draws locked Rooms as locked and Solved Rooms as Solved", () => {
    screen.setRooms(layout(), new Set(["room_a"]));

    expect(state("room_a")).toBe("solved");
    expect(state("room_b")).toBe("open");
    expect(state("room_c")).toBe("locked");
    expect(state("room_X")).toBe("open");
    expect(state("vault")).toBe("locked");
    expect(button("room_a").findOne(".solved-label")).toBeDefined();
    expect(screen.layer.find(".lock")).toHaveLength(2);
  });

  it("unlocks a Room once its prerequisites are Solved", () => {
    screen.setRooms(layout(), new Set(["room_a", "room_b"]));

    expect(state("room_c")).toBe("open");
    expect(state("vault")).toBe("locked");
  });

  it("labels Rooms from Room.name", () => {
    const rooms = layout();
    rooms[0] = new Room({ id: "room_a", name: "Lobby", question });

    screen.setRooms(rooms, new Set());

    expect(button("room_a").findOne<Konva.Text>(".room-label")!.text()).toBe("Lobby");
  });

  it("redraws from scratch on each setRooms", () => {
    screen.setRooms(layout(), new Set());
    screen.setRooms(layout(), new Set());

    expect(screen.layer.find(".room-button-room_a")).toHaveLength(1);
  });

  it("clicking a Room's button calls onRoomClick with its id", () => {
    const onRoomClick = vi.fn();
    screen.onRoomClick(onRoomClick);
    screen.setRooms(layout(), new Set());

    button("room_b").fire("click");
    button("room_c").fire("tap");

    expect(onRoomClick.mock.calls).toEqual([["room_b"], ["room_c"]]);
  });

  it("makes a Solved Room's button non-interactive", () => {
    screen.setRooms(layout(), new Set(["room_a"]));

    expect(button("room_a").listening()).toBe(false);
    expect(button("room_b").listening()).toBe(true);
  });

  it("stops calling onRoomClick once unsubscribed", () => {
    const onRoomClick = vi.fn();
    const unsubscribe = screen.onRoomClick(onRoomClick);
    screen.setRooms(layout(), new Set());

    unsubscribe();
    button("room_a").fire("click");

    expect(onRoomClick).not.toHaveBeenCalled();
  });

  it("showAccessDenied shows the tooltip with the missing prerequisite names", () => {
    screen.setRooms(layout(), new Set());

    screen.showAccessDenied({
      roomId: "room_c",
      roomName: "Room C",
      missingPrerequisiteIds: ["room_a", "room_b"],
      missingPrerequisiteNames: ["Room A", "Room B"],
    });

    expect(tooltip()).toEqual({ visible: true, text: "Complete Room A, Room B to unlock Room C." });
  });

  it("falls back to 'is locked' when no prerequisite is named", () => {
    screen.showAccessDenied({ roomId: "vault", roomName: "Vault", missingPrerequisiteIds: [], missingPrerequisiteNames: [] });

    expect(tooltip().text).toBe("Vault is locked.");
  });

  it("hides the tooltip on the next Room click and on setRooms", () => {
    screen.setRooms(layout(), new Set());
    const payload = {
      roomId: "vault", roomName: "Vault", missingPrerequisiteIds: ["room_c"], missingPrerequisiteNames: ["Room C"],
    };

    screen.showAccessDenied(payload);
    button("room_a").fire("click");
    expect(tooltip().visible).toBe(false);

    screen.showAccessDenied(payload);
    screen.setRooms(layout(), new Set());
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
