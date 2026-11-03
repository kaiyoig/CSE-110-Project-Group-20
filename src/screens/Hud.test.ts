import { describe, it, expect, vi } from "vitest";

vi.mock("konva", () => import("./testing/fakeKonva"));

import type Konva from "konva";
import { Hud, HUD_BAR_WIDTH } from "./Hud";
import { formatMoney, formatTime } from "../score";

const HOUR = 60 * 60 * 1000;

function parts(hud: Hud) {
  return {
    money: hud.findOne<Konva.Text>(".hud-money")!.text(),
    time: hud.findOne<Konva.Text>(".hud-time")!.text(),
    bar: hud.findOne<Konva.Group>(".hud-bar")!.clipWidth(),
  };
}

describe("Hud", () => {
  it("shows the time with formatTime and the money with formatMoney", () => {
    const hud = new Hud();

    hud.setHud(HOUR - 5000, HOUR, 1800);

    expect(parts(hud).time).toBe(formatTime(HOUR - 5000));
    expect(parts(hud).money).toBe(formatMoney(1800));
  });

  it("sizes the bar by the remaining / limit ratio", () => {
    const hud = new Hud();

    hud.setHud(HOUR / 4, HOUR, 0);

    expect(parts(hud).bar).toBe(HUD_BAR_WIDTH / 4);
  });

  it("clamps the bar between empty and full", () => {
    const hud = new Hud();

    hud.setHud(2 * HOUR, HOUR, 0);
    expect(parts(hud).bar).toBe(HUD_BAR_WIDTH);

    hud.setHud(-1000, HOUR, 0);
    expect(parts(hud).bar).toBe(0);

    hud.setHud(1000, 0, 0);
    expect(parts(hud).bar).toBe(0);
  });
});
