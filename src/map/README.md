# Map module

Rooms, prerequisites and which Rooms are Solved. The floor-plan drawing lives in
`src/screens/MapScreen.ts` (from #30); this folder has no UI.

| File | What |
|---|---|
| `Room.ts` | A Room: id, name, its Question, kind (`"main"` or `"bonus"`) and prerequisites. |
| `MapController.ts` | Tracks the active Room and the Solved Rooms, gates entry, and starts/pauses the clock. |

## API

```ts
const room = new Room({
  id: "room_c",
  name: "Room C",
  question,                          // from getQuestion(difficulty), generated once per Heist
  kind: "main",                      // default; "bonus" for a Bonus Room
  prerequisites: ["room_a", "room_b"],
});
room.isAccessible(solvedRoomIds);           // true when every prerequisite is Solved
room.getMissingPrerequisites(solvedRoomIds); // the prerequisite ids still to Solve

const map = new MapController(notifications);  // the NotificationManager
map.registerRoom(room);
map.clickRoomButton(id);  // enters the Room (and sends RoomEntered) if allowed; returns whether it did
map.returnToMap();        // leaves the Room and sends ReturnedToMap
map.solveRoom(id);        // marks a Room Solved
map.solveVault();         // marks the Vault Solved (ending the Heist is up to Game)
map.solvedRooms;          // ReadonlySet<string> of Solved ids
map.activeRoom;           // the Room the player is in, or null
map.onScreenChange = (e) => { /* e.room set: entered it; e.screen === "map": back on the map */ };
map.onAccessDenied = (p) => { /* p.missingPrerequisiteNames etc. */ };
```

Solved state lives only in MapController, never on Room.

## How Game wires it

`src/game/Game.ts` builds the Rooms (#30's layout, below) and one MapController per Heist:

| Source | → | Target |
|---|---|---|
| `mapScreen.onRoomClick(id)` | → | `map.clickRoomButton(id)` |
| `map.onAccessDenied(p)` | → | `mapScreen.showAccessDenied(p)` |
| `map.onScreenChange` with a Room | → | `roomScreen.setQuestion(room.question, room.name)`, show the Room Screen |
| `map.onScreenChange` back to `"map"` | → | `mapScreen.setRooms(rooms, map.solvedRooms)`, show the Map Screen |
| `roomScreen.onExit()` | → | `map.returnToMap()` |
| correct last Step in a Room | → | `map.solveRoom(id)`, then `map.returnToMap()` |
| correct last Step in the Vault | → | `map.solveVault()`, then Game ends the Heist as Escaped |

| id | name | kind | prerequisites |
|---|---|---|---|
| `room_a` | Room A | main | none |
| `room_b` | Room B | main | none |
| `room_c` | Room C | main | `room_a`, `room_b` |
| `room_X` | Room X | bonus | none |
| `vault` | Vault | main | `room_c` |

## Things to watch out for

- **Room ids are case-sensitive**: `"room_a"`, `"room_b"`, `"room_c"`, `"room_X"`, `"vault"`. MapScreen's floor plan is keyed by these ids.
- **A Solved Room can't be entered again**: `clickRoomButton` returns `false` and fires nothing.
- **A locked Room fires `onAccessDenied`**, not `onScreenChange`, and the clock doesn't start.

Run the tests: `npm test`
