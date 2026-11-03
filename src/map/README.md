# Bank Map Component (Calista)

Everything lives in `src/map/` (or run isolated via `test-map.html`). Import from the folder:

```ts
import { mountGameMap } from "./map/MapDemo";
import { MapController } from "./map/MapController";
import { Room } from "./map/Room";
```

## File Overview

| File | Description |
|---|---|
| Room.ts| Room entity definition and prerequisite validation logic |
| MapController.ts | State machine tracking completedRooms, active screens, and click gating |
| MapScreenView.ts | Konva-based floor plan canvas, HUD indicators, and tooltip modals |
| MapDemo.ts | Assembles default rooms, links controller callbacks to the view, and exports mountGameMap |
| test-map.html | Independent HTML entry point for manual UI verification |
| test-map-demo.ts | Bootstraps test-map.html and provides mock prompts for solving rooms and vault testing |

## Usage Guidance

| Component | When | Call |
|---|---|---|
| **map** | Player clicks an unlocked room button | `score.enterRoom()` |
| **map** | Player goes back to the map | `score.returnToMap()`, then `refreshMap()` |
| **map** | Vault puzzle solved | `controller.completeVault("vault")`, `showEndScreen(score.getModel().snapshot())` |
| **room/puzzle** | Room puzzle is finished and solved | `controller.completeRoom(roomId)`, then `controller.returnToMap()`, then `refreshMap()` |
| **HUD** | Sync remaining heist time / balance on the map | `map.setProgress(ratio)` (0–1), `map.setMoney(amount)` |
| **menu/navigation** | Clean up Konva stage on game reset or exit | `destroy()` |

## Things to watch out for

- **Case-sensitive room IDs:** Always match exact casing: `"room_a"`, `"room_b"`, `"room_c"`, `"room_X"`, `"vault"`. 
- **Rooms cannot be re-entered once solved:** When a room is completed, its button becomes non-interactive. Calling `clickRoomButton(roomId)` on a completed room returns `false`.
- **Call `refreshMap()` after room completions:** This re-evaluates prerequisite locks and updates floor colors/icons on the Konva stage.
- **Locked rooms show popup tooltips automatically:** Clicking a locked room blocks navigation and renders a tooltip explaining which rooms must be solved first (e.g., *"Complete Room A to unlock Room C"*).
- **Cleanup when unmounting:** Always invoke `destroy()` when exiting back to the main menu to disconnect the `ResizeObserver` and remove the Konva stage listeners.

## Testing & Sandbox

```bash
# Run unit tests (prerequisites, controller state, vault completion)
npm test

# Run isolated UI sandbox in browser 
npm run dev
# Visit: http://localhost:5173/test-map.html
```