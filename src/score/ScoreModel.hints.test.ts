import { describe, expect, it } from "vitest";
import { Difficulty, ScoreModel } from "./ScoreModel";

describe("room hint reward penalties", () => {
  it("reduces a main-room payout by 25% per hint", () => {
    const model = new ScoreModel({ difficulty: Difficulty.Medium });
    model.recordHintUsed("room_a");
    expect(model.recordRoomSolved("main", "room_a")).toBe(225);
    model.recordHintUsed("room_b");
    model.recordHintUsed("room_b");
    expect(model.recordRoomSolved("main", "room_b")).toBe(150);
    expect(model.getMoney()).toBe(375);
  });

  it("persists a room's hint penalty across leaving and re-entering", () => {
    const model = new ScoreModel();
    model.recordHintUsed("room_a");
    expect(model.recordRoomSolved("main", "room_b")).toBe(100);
    expect(model.recordRoomSolved("main", "room_a")).toBe(75);
  });

  it("caps penalties at two hints and never reduces money below zero", () => {
    const model = new ScoreModel({ difficulty: Difficulty.Hard });
    for (let i = 0; i < 10; i++) model.recordHintUsed("bonus");
    expect(model.getHintsUsed("bonus")).toBe(2);
    expect(model.canUseHint("bonus")).toBe(false);
    expect(model.getHintsUsed("other")).toBe(0);
    expect(model.canUseHint("other")).toBe(true);
    expect(model.recordRoomSolved("bonus", "bonus")).toBe(900);
    expect(model.getMoney()).toBe(900);
  });

  it("does not count a hint as an incorrect answer or time penalty", () => {
    const model = new ScoreModel();
    const previous = model.getTimeRemainingMs();
    model.recordHintUsed("room_a");
    expect(model.getIncorrectAnswers()).toBe(0);
    expect(model.getTimeRemainingMs()).toBe(previous);
  });

  it("rejects a solved room without an ID", () => {
    const model = new ScoreModel();
    expect(() => model.recordRoomSolved("main", "")).toThrow(RangeError);
    expect(model.getMoney()).toBe(0);
  });

  it("rejects hints without a room ID", () => {
    const model = new ScoreModel();
    expect(() => model.recordHintUsed("")).toThrow(RangeError);
  });
});