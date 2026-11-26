import Konva from "konva";
import { NotificationManager } from "./notification-manager/NotificationManager";
import { AudioManager } from "./audio/AudioManager";
import { EventType } from "./notification-manager/GameEvent";
import { Leaderboard, UnavailableLeaderboardStore, type Difficulty } from "./score";
import { getSupabase } from "./score/supabaseClient";
import { SupabaseLeaderboardStore } from "./score/SupabaseLeaderboardStore";
import { ScreenController } from "./screens/ScreenController";
import { StartScreen } from "./screens/StartScreen";
import { MapScreen } from "./screens/MapScreen";
import { RoomScreen } from "./screens/RoomScreen";
import { EndScreen } from "./screens/EndScreen";
import { CreditsScreen } from "./screens/CreditsScreen";
import { TutorialScreen } from "./screens/TutorialScreen";
import { Game } from "./game/Game";
import { connectEndScreenLeaderboard } from "./endScreenLeaderboard";

/**
 * The only place that creates app-scoped objects and connects the Heist
 * lifecycle: Start Screen → Map Screen ⇄ Room Screen → End Screen → Start Screen
 * (or straight into a new Heist).
 */

// Force-load fonts in before creating StartScreen
await Promise.all([
  document.fonts.load('400 82px "Gasoek One"'),
]);
await document.fonts.ready;

const stage = new Konva.Stage({
  container: "container",
  width: window.innerWidth,
  height: window.innerHeight,
});
const notifications = new NotificationManager();
// One app-scoped subscriber; all sounds react to the same events as the score/HUD.
const audio = new AudioManager(notifications);
// Online only. Without the Supabase env vars, boards fail to load and saves fail.
const supabase = getSupabase();
if (!supabase) console.warn("VITE_SUPABASE_URL / VITE_SUPABASE_KEY not set: the leaderboard is offline.");
const leaderboard = new Leaderboard(supabase ? new SupabaseLeaderboardStore(supabase) : new UnavailableLeaderboardStore());
const screens = new ScreenController(stage);

const startScreen = new StartScreen(stage.width(), stage.height(), leaderboard);
const mapScreen = new MapScreen(stage.width(), stage.height());
const roomScreen = new RoomScreen(stage.width(), stage.height(), notifications);
const endScreen = new EndScreen(stage.width(), stage.height());
const creditsScreen = new CreditsScreen(stage.width(), stage.height());
const tutorialScreen = new TutorialScreen(stage.width(), stage.height());

screens.register("start", startScreen);
screens.register("map", mapScreen);
screens.register("room", roomScreen);
screens.register("end", endScreen);
screens.register("credits", creditsScreen);
screens.register("tutorial", tutorialScreen);
screens.show("start");

// Safety net: if a font finishes downloading after startup, re-center all Konva.Text nodes
document.fonts.addEventListener("loadingdone", () => {
  stage.find("Text").forEach((node) => node.clearCache());
  stage.batchDraw();
});

let game: Game | null = null;
let lastDifficulty: Difficulty | null = null;
const endLeaderboard = connectEndScreenLeaderboard(endScreen, leaderboard);

function startHeist(difficulty: Difficulty): void {
  game?.dispose();
  lastDifficulty = difficulty;
  game = new Game(difficulty, { notifications, screens, mapScreen, roomScreen });
  game.start();
}

startScreen.onStart((difficulty) => startHeist(difficulty));
startScreen.onAudioMuteChange((muted) => audio.setMuted(muted));
startScreen.onMusicVolumeChange((value) => audio.setMusicVolume(value));
startScreen.onSfxVolumeChange((value) => audio.setSfxVolume(value));
// Browser playback needs a real gesture. Subsequent calls are idempotent.
stage.on("pointerdown", () => audio.startMusic());
window.addEventListener("keydown", () => audio.startMusic());
startScreen.onTutorial(() => screens.show("tutorial"));
tutorialScreen.onMenu(() => screens.show("start"));
tutorialScreen.onStartHeist(() => {
  screens.show("start");
  startScreen.showDifficultySelection();
});
startScreen.onCredits(() => screens.show("credits"));
creditsScreen.onBack(() => screens.show("start"));

notifications.subscribe(EventType.GameOver, () => {
  if (!game) return;
  const result = game.getResult();
  game.dispose();
  game = null;
  endLeaderboard.showResult(result);
  screens.show("end");
});

endScreen.onPlayAgain(() => {
  if (lastDifficulty !== null) startHeist(lastDifficulty);
});

endScreen.onBackToStart(() => {
  screens.show("start");
});
