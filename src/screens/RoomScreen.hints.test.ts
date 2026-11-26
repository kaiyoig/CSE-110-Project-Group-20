import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("konva", () => import("./testing/fakeKonva"));
vi.mock("../puzzles/basic-multistep-puzzle", () => import("./testing/fakePuzzle"));
vi.mock("../puzzles/power-box-puzzle", async () =>
  ({ default: (await import("./testing/fakePuzzle")).fakePuzzleOf("powerBox") }));
vi.mock("../puzzles/laser-match-puzzle", async () =>
  ({ default: (await import("./testing/fakePuzzle")).fakePuzzleOf("laser") }));

import { Room, type RoomPuzzle } from "../map/Room";
import { RoomScreen } from "./RoomScreen";
import { NotificationManager } from "../notification-manager/NotificationManager";
import type Konva from "konva";
import { created } from "./testing/fakePuzzle";

const question = { prompt: "x / 3 = 5", answer: "15" };
const room = new Room({ id: "room_a", name: "Room A", question });

describe("RoomScreen hint modal", () => {
  let screen: RoomScreen;
  beforeEach(() => {
    vi.useFakeTimers();
    created.length = 0;
    screen = new RoomScreen(1440, 900, new NotificationManager());
    screen.setRoom(room);
  });
  afterEach(() => vi.useRealTimers());

  function clickHint(): void {
    screen.layer.findOne(".hint-button")!.fire("click");
  }
  function closeHint(): void {
    screen.layer.findOne(".hint-back")!.fire("click");
  }

  it("opens the Figma-inspired modal and emits the hint request", () => {
    const requested = vi.fn(() => screen.showHint(1));
    screen.onHint(requested);
    clickHint();
    expect(screen.layer.findOne(".hint-modal")!.visible()).toBe(true);
    expect(created[created.length - 1].interactionEnabled).toBe(false);
    expect((screen.layer.findOne(".hint-message")! as Konva.Text).text()).toContain("multiplying");
    expect(requested).toHaveBeenCalledOnce();
    closeHint();
    expect(screen.layer.findOne(".hint-modal")!.visible()).toBe(false);
    expect(created[created.length - 1].interactionEnabled).toBe(true);
  });

  it("displays the limit message when the game rejects a hint", () => {
    const requested = vi.fn(() => screen.showHint(null));
    screen.onHint(requested);
    clickHint();
    expect(requested).toHaveBeenCalledOnce();
    expect((screen.layer.findOne(".hint-message")! as Konva.Text).text()).toContain("both hints");
  });

  it("closes the modal when the room is hidden", () => {
    screen.onHint(() => screen.showHint(1));
    clickHint();
    screen.hide();
    expect(screen.layer.findOne(".hint-modal")!.visible()).toBe(false);
  });

  it.each<[RoomPuzzle, string]>([
    [{ type: "powerBox", pairs: [{ question }] }, "wire"],
    [{ type: "laser", questions: [{ prompt: "y = x", answer: "y = 1 * x + 0" }] }, "slope"],
  ])("supports hints for canvas-only $type puzzles", (puzzle, hintText) => {
    screen.setRoom(new Room({ id: "new_room", name: "New Room", question, puzzle }));
    // Power Box and Laser Match use the modal's canvas shield, with no HTML-input hook.
    Object.defineProperty(created.at(-1)!, "setInteractionEnabled", { value: undefined });
    const requested = vi.fn(() => screen.showHint(1));
    screen.onHint(requested);
    clickHint();
    expect((screen.layer.findOne(".hint-message")! as Konva.Text).text()).toContain(hintText);
    expect(requested).toHaveBeenCalledOnce();
    closeHint();
    expect(screen.layer.findOne(".hint-modal")!.visible()).toBe(false);
  });
});
