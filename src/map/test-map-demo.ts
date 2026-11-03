import { mountGameMap } from "./MapDemo";
const container = document.getElementById("sandbox-container") as HTMLDivElement;

const { controller, refreshMap } = mountGameMap(container, (event) => {
  console.log("Navigated to:", event.screen);

  if (event.screen !== "map") {
    const solved = window.confirm(
      `Entered ${event.name}!\n\n` +
      `Click OK to simulate solving this room.\n` +
      `Click Cancel to exit without solving.`
    );

    if (solved) {
      if (event.screen === "vault") {
        controller.completeVault("vault");
        alert("Vault Completed! Screen switched to results.");
      } else {
        controller.completeRoom(event.screen);
      }
    }

    controller.returnToMap();
    refreshMap();
  }
});