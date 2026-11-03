import Konva from "konva";
import { NotificationManager } from "./notification-manager/NotificationManager";
import { EventType } from "./notification-manager/GameEvent";
import { Leaderboard } from "./score";
import { ScreenController } from "./screens/ScreenController";
import type { EndScreen, MapScreen, RoomScreen, StartScreen } from "./screens/contracts";
import { Game, type HeistResult } from "./game/Game";

/**
 * The only place that creates app-scoped objects and connects the Heist
 * lifecycle: Start Screen → Map Screen ⇄ Room Screen → End Screen → Start Screen.
 */

/**
 * Stand-in until the screen modules land. Each owner replaces one call below
 * with `new XScreen(...)` (see src/screens/contracts.ts for the contracts).
 */
function screenNotImplemented<T>(name: string): T {
  throw new Error(`${name} is not implemented yet (see src/screens/contracts.ts)`);
}

const stage = new Konva.Stage({
  container: "container",
  width: window.innerWidth,
  height: window.innerHeight,
});
const notifications = new NotificationManager();
const leaderboard = new Leaderboard();
const screens = new ScreenController(stage);

const startScreen = screenNotImplemented<StartScreen>("StartScreen");
const mapScreen = screenNotImplemented<MapScreen>("MapScreen");
const roomScreen = screenNotImplemented<RoomScreen>("RoomScreen"); // gets `notifications`
const endScreen = screenNotImplemented<EndScreen>("EndScreen");

screens.register("start", startScreen);
screens.register("map", mapScreen);
screens.register("room", roomScreen);
screens.register("end", endScreen);
screens.show("start");

let game: Game | null = null;
let lastResult: HeistResult | null = null;
let scoreSaved = false;

startScreen.onStart((difficulty) => {
  game?.dispose();
  game = new Game(difficulty, { notifications, screens, mapScreen, roomScreen });
  game.start();
});

notifications.subscribe(EventType.GameOver, () => {
  if (!game) return;
  const result = game.getResult();
  game.dispose();
  game = null;
  lastResult = result;
  scoreSaved = false;
  endScreen.setResult(result, leaderboard.getEntries(result.snapshot.difficulty));
  screens.show("end");
});

endScreen.onSaveScore((playerName) => {
  if (!lastResult || lastResult.outcome !== "escaped" || scoreSaved) return;
  scoreSaved = true;
  const { difficulty, score, timeSpentMs } = lastResult.snapshot;
  leaderboard.addEntry({ playerName, difficulty, score, timeSpentMs });
  endScreen.setResult(lastResult, leaderboard.getEntries(difficulty));
});

endScreen.onPlayAgain(() => {
  screens.show("start");
});
