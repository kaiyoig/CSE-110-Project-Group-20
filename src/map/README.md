# Map module

Rooms, prerequisites, 2D spatial arrangement, and solved room state. The floor-plan drawing lives in
`src/screens/MapScreen.ts`; this folder has no UI.

| File | What |
|---|---|
| `Room.ts` | A Room: id, name, its Question, kind (`"main"` or `"bonus"`), and prerequisites. |
| `MapGrid.ts` | Scalable 2D matrix (`(Room \| null)[][]`) managing cell bounds, occupancy collisions, and multi-cell spans (`colSpan`, `rowSpan`). |
| `MapLayout.ts` | Layout factory generating difficulty-specific grids (Easy $3\times3$, Medium $3\times3$, Hard $3\times4$) and prerequisite chains. |
| `MapController.ts` | Tracks the active Room, Solved Rooms, and active `MapGrid`; gates entry and starts/pauses the clock. |

## API

```ts
// 1. Room Definition
const room = new Room({
  id: "room_c",
  name: "Room C",
  question,                           // from getQuestion(difficulty), generated once per Heist
  kind: "main",                       // default; "bonus" for a Bonus Room
  prerequisites: ["room_a", "room_b"],
});
room.isAccessible(solvedRoomIds);            // true when every prerequisite is Solved
room.getMissingPrerequisites(solvedRoomIds);  // the prerequisite ids still to Solve

// 2. Grid Placement
const grid = new MapGrid(3, 3);
// placeRoom(room, row, column, colSpan = 1, rowSpan = 1)
grid.placeRoom(room, 2, 0, 2, 1); // Placed at (row: 2, col: 0) spanning 2 columns wide
grid.getRoomAt(2, 1);             // returns room_c
grid.getAllRooms();               // PlacedRoom[] with origin coords and spans

// 3. Controller
const map = new MapController(notifications, grid);
map.registerRoom(room);
map.clickRoomButton(id);  // enters the Room (and sends RoomEntered) if allowed; returns whether it did
map.returnToMap();        // leaves the Room and sends ReturnedToMap
map.solveRoom(id);        // marks a Room Solved
map.solveVault();         // marks the Vault Solved (ending the Heist is up to Game)
map.solvedRooms;          // ReadonlySet<string> of Solved ids
map.activeRoom;           // the Room the player is in, or null
map.grid;                 // the active MapGrid instance
map.onScreenChange = (e) => { /* e.room set: entered it; e.screen === "map": back on the map */ };
map.onAccessDenied = (p) => { /* p.missingPrerequisiteNames, p.missingPrerequisiteIds, etc. */ };