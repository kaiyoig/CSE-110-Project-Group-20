import { Room } from "./Room";
import {
  MapController,
  type SwitchMapScreen,
} from "./MapController";
import {
  createMapScreen,
  type RoomId,
} from "./MapScreenView";

export function mountGameMap(
  container: HTMLDivElement,
  navigate: (event: SwitchMapScreen) => void,
) {
  const controller = new MapController();

  const rooms: Room[] = [
    new Room({
      id: "room_a",
      name: "Room A",
    }),
    new Room({
      id: "room_b",
      name: "Room B",
    }),
    new Room({
      id: "room_c",
      name: "Room C",
      prerequisites: ["room_a", "room_b"],
    }),
    new Room({
      id: "room_X",
      name: "Room X",
    }),
    new Room({
      id: "vault",
      name: "Vault",
      prerequisites: ["room_c"],
    }),
  ];

  for (const room of rooms) {
    controller.registerRoom(room);
  }

  const map = createMapScreen({
    container,
    money: 0,
    progress: 1,
    onEnterRoom(roomId) {
      controller.clickRoomButton(roomId);
    },
  });

  function refreshMap() {
    const completed = Array.from(controller.completedRooms);

    for (const room of rooms) {
      map.setRoomLocked(
        room.id as RoomId,
        !room.isAccessible(completed),
      );
    }
  }

  controller.onAccessDenied = (payload) => {
    const required = payload.missingPrerequisiteNames.join(", ");

    map.showAccessDenied(
      payload.roomId as RoomId,
      required
        ? `Complete ${required} to unlock ${payload.roomName}.`
        : `${payload.roomName} is locked.`,
    );
  };

  controller.onScreenChange = (event) => {
    refreshMap();
    map.hideAccessDenied();

    // Hide the map while your game presents another screen.
    container.style.visibility =
      event.screen === "map" ? "visible" : "hidden";

    navigate(event);
  };

  refreshMap();

  return {
    controller,
    map,
    refreshMap,

    destroy() {
      controller.onScreenChange = null;
      controller.onAccessDenied = null;
      map.destroy();
    },
  };
}