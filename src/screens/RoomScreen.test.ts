import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("konva", () => import("./testing/fakeKonva"));
vi.mock("../puzzles/basic-multistep-puzzle", () => import("./testing/fakePuzzle"));
vi.mock("../puzzles/power-box-puzzle", async () =>
  ({ default: (await import("./testing/fakePuzzle")).fakePuzzleOf("powerBox") }));
vi.mock("../puzzles/laser-match-puzzle", async () =>
  ({ default: (await import("./testing/fakePuzzle")).fakePuzzleOf("laser") }));

import type Konva from "konva";
import { RoomScreen, FEEDBACK_MS } from "./RoomScreen";
import { NotificationManager } from "../notification-manager/NotificationManager";
import { EventType } from "../notification-manager/GameEvent";
import { formatMoney, WRONG_ANSWER_PENALTY_SECONDS } from "../score";
import { CONSOLE } from "../multistep-solver/multistep-console";
import type { StepAnswer } from "../questions/Question";
import { visibleTexts } from "./testing/fakeKonva";
import { created } from "./testing/fakePuzzle";
import { Room } from "../map/Room";

const question = { prompt: "x * 2 + 1 = 5", answer: "2" };
const roomA = new Room({ id: "room_a", name: "Room A", question });
const pick: StepAnswer = { playerAnswer: "-", correctAnswer: "-", isLastStep: false };

describe("RoomScreen", () => {
  let notifications: NotificationManager;
  let screen: RoomScreen;

  function feedback(): { visible: boolean; text: string } {
    const node = screen.layer.findOne<Konva.Text>(".feedback")!;
    return { visible: node.visible(), text: node.text() };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    created.length = 0;
    notifications = new NotificationManager();
    screen = new RoomScreen(1440, 900, notifications);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("setRoom shows the Room name and builds a multistep puzzle from the prompt on its layer", () => {
    screen.setRoom(roomA);

    expect(screen.layer.findOne<Konva.Text>(".room-name")!.text()).toBe("Room A");
    expect(created).toHaveLength(1);
    expect(created[0].type).toBe("multistep");
    expect(created[0].source).toBe(question.prompt);
    expect(created[0].options.layer).toBe(screen.layer);
  });

  it("builds a Power Box from a Power Box Room's pairs, with the server-room backdrop", () => {
    const pairs = [{ question }];
    screen.setRoom(new Room({ id: "room_b", name: "Room B", question, puzzle: { type: "powerBox", pairs } }));

    expect(created[0].type).toBe("powerBox");
    expect(created[0].source).toBe(pairs);
    expect(created[0].options).toMatchObject({ layer: screen.layer, backdrop: { width: 1440, height: 900 } });
  });

  it("builds a Laser Match from a Laser Room's Questions", () => {
    const questions = [{ prompt: "y = x", answer: "y = 1 * x + 0" }];
    screen.setRoom(new Room({ id: "room_c", name: "Room C", question, puzzle: { type: "laser", questions } }));

    expect(created[0].type).toBe("laser");
    expect(created[0].source).toBe(questions);
    expect(created[0].options.layer).toBe(screen.layer);
  });

  it("forwards a Power Box Answer with its own Question untouched", () => {
    const onAnswer = vi.fn();
    screen.onAnswer(onAnswer);
    screen.setRoom(new Room({ id: "room_b", name: "Room B", question, puzzle: { type: "powerBox", pairs: [{ question }] } }));
    const wire: StepAnswer = { playerAnswer: "2", correctAnswer: "2", isLastStep: true, question, solvesRoom: true };

    created[0].answer(wire);

    expect(onAnswer).toHaveBeenCalledWith(wire);
  });

  it("a second setRoom destroys the first puzzle and builds a fresh one", () => {
    screen.setRoom(roomA);
    screen.setRoom(roomA);

    expect(created).toHaveLength(2);
    expect(created[0].destroyed).toBe(true);
    expect(created[1].destroyed).toBe(false);
  });

  it("hide() destroys the puzzle, so leaving loses Step progress", () => {
    screen.setRoom(roomA);

    screen.hide();

    expect(created[0].destroyed).toBe(true);
    expect(screen.layer.visible()).toBe(false);
  });

  it("forwards every puzzle Answer to onAnswer as a StepAnswer", () => {
    const onAnswer = vi.fn();
    screen.onAnswer(onAnswer);
    screen.setRoom(roomA);
    const last = { playerAnswer: "2", correctAnswer: "2", isLastStep: true };

    created[0].answer(pick);
    created[0].answer(last);

    expect(onAnswer.mock.calls).toEqual([[pick], [last]]);
  });

  it("stops forwarding Answers once unsubscribed", () => {
    const onAnswer = vi.fn();
    screen.onAnswer(onAnswer)();
    screen.setRoom(roomA);

    created[0].answer(pick);

    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("Exit calls onExit", () => {
    const onExit = vi.fn();
    screen.onExit(onExit);

    screen.layer.findOne(".exit")!.fire("click");

    expect(onExit).toHaveBeenCalledOnce();
  });

  it("Exit sends an Answer the puzzle is still holding before leaving, so a solve is not lost", () => {
    const events: string[] = [];
    screen.onAnswer((a) => events.push(`answer ${a.playerAnswer}`));
    screen.onExit(() => events.push("exit"));
    screen.setRoom(roomA);
    created[0].holdAnswer({ playerAnswer: "2", correctAnswer: "2", isLastStep: true });

    screen.layer.findOne(".exit")!.fire("click");

    expect(events).toEqual(["answer 2", "exit"]);
  });

  it("shows Correct! in green for about a second", () => {
    notifications.send({ eventType: EventType.Correct });
    expect(feedback()).toEqual({ visible: true, text: "Correct!" });

    vi.advanceTimersByTime(FEEDBACK_MS);
    expect(feedback().visible).toBe(false);
  });

  it("shows the time penalty for an Incorrect Answer, then clears it", () => {
    notifications.send({ eventType: EventType.Incorrect });
    expect(feedback()).toEqual({ visible: true, text: `Incorrect!` });

    vi.advanceTimersByTime(FEEDBACK_MS);
    expect(feedback().visible).toBe(false);
  });

  it("restarts the feedback timer for each Answer", () => {
    notifications.send({ eventType: EventType.Incorrect });
    vi.advanceTimersByTime(FEEDBACK_MS - 100);
    notifications.send({ eventType: EventType.Correct });
    vi.advanceTimersByTime(500);

    expect(feedback()).toEqual({ visible: true, text: "Correct!" });
  });

  it("forwards setHud to its HUD", () => {
    screen.setHud(30_000, 60_000, 300);

    expect(visibleTexts(screen.layer)).toEqual(expect.arrayContaining([formatMoney(300), "00:00:30"]));
  });

  it("adds its layer to no Stage itself", () => {
    expect(screen.layer.getStage()).toBeNull();
  });

  it("builds the multistep puzzle on the full-size console, with feedback under it", () => {
    screen.setRoom(roomA);

    expect(created[0].options).toMatchObject({ x: 720 });
    const consoleBottom = (created[0].options.y as number) + CONSOLE.height / 2;
    expect(screen.layer.findOne<Konva.Text>(".feedback")!.y()).toBeGreaterThan(consoleBottom);
  });


  it("positions feedback below the panel for Laser Matching in any room", () => {
    const questions = [
      { prompt: "y = x", answer: "y = 1 * x + 0" }
    ];

    //use Room A to verify it doesn't depend on Room C
    const laserRoom = new Room({
      id: "room_a_laser",
      name: "Room A",
      question,
      puzzle: { type: "laser", questions },
    });

    screen.setRoom(laserRoom);

    const feedbackNode = screen.layer.findOne<Konva.Text>(".feedback")!;

    notifications.send({ eventType: EventType.Incorrect });

    expect(feedbackNode.text()).toBe("Incorrect!");
    expect(feedbackNode.y()).toBe(799);

    notifications.send({ eventType: EventType.Correct });

    expect(feedbackNode.text()).toBe("Correct!");
    expect(feedbackNode.y()).toBe(799);
  });


  it("restores the original feedback position for other puzzle types", () => {
    const questions = [
      { prompt: "y = x", answer: "y = 1 * x + 0" }
    ];

    const laserRoom = new Room({
      id: "laser_room",
      name: "Room A",
      question,
      puzzle: { type: "laser", questions },
    });

    const powerBoxRoom = new Room({
      id: "power_room",
      name: "Room B",
      question,
      puzzle: {
        type: "powerBox",
        pairs: [{ question }],
      },
    });

    const feedbackNode = screen.layer.findOne<Konva.Text>(".feedback")!;

    //laser Mmtching uses the lower position
    screen.setRoom(laserRoom);
    notifications.send({ eventType: EventType.Correct });
    expect(feedbackNode.y()).toBe(799);

    //power box returns to the original position
    screen.setRoom(powerBoxRoom);
    notifications.send({ eventType: EventType.Correct });
    expect(feedbackNode.y()).toBe(734);

    //multistep returns to the original position
    screen.setRoom(roomA);
    notifications.send({ eventType: EventType.Incorrect });
    expect(feedbackNode.y()).toBe(734);

    // switching back to laser matching restores its position
    screen.setRoom(laserRoom);
    notifications.send({ eventType: EventType.Correct });
    expect(feedbackNode.y()).toBe(799);
  });


});
