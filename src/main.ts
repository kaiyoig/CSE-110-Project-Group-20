import { MenuController } from "./menu/MenuController";
import { MenuView } from "./menu/MenuView";
import { showDemo } from "./menu/DemoGame";

const container = document.getElementById("container");
if (container === null) {
  throw new Error("The application needs a container element.");
}

const notice = document.createElement("p");
notice.className = "demo-notice";
notice.textContent = "MENU DEMO · Results use sample data. Full gameplay is not connected.";
const menuRoot = document.createElement("div");
const gameRoot = document.createElement("div");
gameRoot.hidden = true;
container.append(notice, menuRoot, gameRoot);

const controller = new MenuController(
  (difficulty) => showDemo(gameRoot, controller, difficulty),
  () => gameRoot.replaceChildren()
);
const view = new MenuView(menuRoot, controller);

controller.onScreenChange = () => {
  gameRoot.hidden = controller.currentScreen !== "playing";
  view.render();
  if (controller.currentScreen === "playing") {
    gameRoot.querySelector<HTMLElement>("h1")?.focus();
  }
};
view.render();
