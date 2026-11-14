import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("konva", () => import("./testing/fakeKonva"));
vi.mock("../puzzles/basic-multistep-puzzle", () => import("./testing/fakePuzzle"));

import type Konva from "konva";
import { RoomScreen, FEEDBACK_MS } from "./RoomScreen";
import { NotificationManager } from "../notification-manager/NotificationManager";
import { EventType } from "../notification-manager/GameEvent";
import { formatMoney, WRONG_ANSWER_PENALTY_SECONDS } from "../score";
import type { StepAnswer } from "../questions/Question";
import { visibleTexts } from "./testing/fakeKonva";
import { created } from "./testing/fakePuzzle";

const question = { prompt: "x * 2 + 1 = 5", answer: "2" };
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

  it("setQuestion shows the Room name and builds a puzzle from the prompt on its layer", () => {
    screen.setQuestion(question, "Room A");

    expect(screen.layer.findOne<Konva.Text>(".room-name")!.text()).toBe("Room A");
    expect(created).toHaveLength(1);
    expect(created[0].equation).toBe(question.prompt);
    expect(created[0].options.layer).toBe(screen.layer);
  });

  it("a second setQuestion destroys the first puzzle and builds a fresh one", () => {
    screen.setQuestion(question, "Room A");
    screen.setQuestion(question, "Room A");

    expect(created).toHaveLength(2);
    expect(created[0].destroyed).toBe(true);
    expect(created[1].destroyed).toBe(false);
  });

  it("hide() destroys the puzzle, so leaving loses Step progress", () => {
    screen.setQuestion(question, "Room A");

    screen.hide();

    expect(created[0].destroyed).toBe(true);
    expect(screen.layer.visible()).toBe(false);
  });

  it("forwards every puzzle Answer to onAnswer as a StepAnswer", () => {
    const onAnswer = vi.fn();
    screen.onAnswer(onAnswer);
    screen.setQuestion(question, "Room A");
    const last = { playerAnswer: "2", correctAnswer: "2", isLastStep: true };

    created[0].answer(pick);
    created[0].answer(last);

    expect(onAnswer.mock.calls).toEqual([[pick], [last]]);
  });

  it("stops forwarding Answers once unsubscribed", () => {
    const onAnswer = vi.fn();
    screen.onAnswer(onAnswer)();
    screen.setQuestion(question, "Room A");

    created[0].answer(pick);

    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("Exit calls onExit", () => {
    const onExit = vi.fn();
    screen.onExit(onExit);

    screen.layer.findOne(".exit")!.fire("click");

    expect(onExit).toHaveBeenCalledOnce();
  });

  it("shows Correct! in green for about a second", () => {
    notifications.send({ eventType: EventType.Correct });
    expect(feedback()).toEqual({ visible: true, text: "Correct!" });

    vi.advanceTimersByTime(FEEDBACK_MS);
    expect(feedback().visible).toBe(false);
  });

  it("shows the time penalty for an Incorrect Answer, then clears it", () => {
    notifications.send({ eventType: EventType.Incorrect });
    expect(feedback()).toEqual({ visible: true, text: `Incorrect: −${WRONG_ANSWER_PENALTY_SECONDS} s` });

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

  //random value below 0.5 selects keypad
  it("selects keypad input when random value is below 0.5", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.25);

    screen.setQuestion(question, "Room A");

    expect(created[0].options.inputType).toBe("keypad");

    random.mockRestore();
   });
  
   //random value above 0.5 selects typed input
  it("selects typed input when random value is above 0.5", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.75);

    screen.setQuestion(question, "Room A");

    expect(created[0].options.inputType).toBe("typed");

    random.mockRestore();
  });
});
