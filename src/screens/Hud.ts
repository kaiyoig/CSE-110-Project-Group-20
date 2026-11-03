import Konva from "konva";
import { formatMoney, formatTime } from "../score";
import { COLORS, createText } from "./theme";

const BAR = { x: 204, y: 15, width: 970, height: 50 };

/**
 * The HUD shared by the Map and Room Screens: money earned and time
 * remaining, styled after #30's money label and time bar.
 */
export class Hud extends Konva.Group {
  private readonly moneyLabel: Konva.Text;
  private readonly timeLabel: Konva.Text;
  private readonly barClip: Konva.Group;

  constructor() {
    super({ listening: false });

    // Money
    this.add(new Konva.Rect({
      x: 20, y: 18, width: 164, height: 43,
      cornerRadius: 24,
      stroke: COLORS.gold, strokeWidth: 3,
    }));
    this.moneyLabel = createText({
      x: 20, y: 18, width: 164, height: 43,
      align: "center", verticalAlign: "middle",
      fill: COLORS.gold,
      name: "hud-money",
    });
    this.add(this.moneyLabel);

    // Time bar: a green bar clipped to the remaining fraction, inside an outline.
    this.add(new Konva.Rect({
      ...BAR,
      cornerRadius: BAR.height,
      fill: COLORS.background,
      stroke: "black", strokeWidth: 3,
    }));
    this.barClip = new Konva.Group({
      clipX: BAR.x, clipY: BAR.y, clipWidth: BAR.width, clipHeight: BAR.height,
      name: "hud-bar",
    });
    this.barClip.add(new Konva.Rect({ ...BAR, cornerRadius: BAR.height, fill: COLORS.green }));
    this.add(this.barClip);
    this.add(new Konva.Rect({
      ...BAR,
      cornerRadius: BAR.height,
      stroke: "black", strokeWidth: 3,
    }));

    // Time remaining
    this.timeLabel = createText({
      x: BAR.x + BAR.width + 16, y: BAR.y, width: 230, height: BAR.height,
      verticalAlign: "middle",
      fontSize: 32,
      name: "hud-time",
    });
    this.add(this.timeLabel);

    this.setHud(0, 0, 0);
  }

  /** Shows the time remaining, the bar at remaining / limit (0–1), and the money. */
  setHud(timeRemainingMs: number, timeLimitMs: number, money: number): void {
    const ratio = timeLimitMs > 0 ? timeRemainingMs / timeLimitMs : 0;
    const clamped = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
    this.barClip.clipWidth(BAR.width * clamped);
    this.timeLabel.text(formatTime(timeRemainingMs));
    this.moneyLabel.text(formatMoney(money));
    this.getLayer()?.batchDraw();
  }
}

/** Full width of the time bar, for tests. */
export const HUD_BAR_WIDTH = BAR.width;
