import Konva from "konva";
import { formatMoney, formatTime, WRONG_ANSWER_PENALTY_SECONDS } from "../score";
import { COLORS, createText } from "./theme";

const BAR = { x: 204, y: 15, width: 970, height: 50 };
const WARNING_TIME_RATIO = 0.5;  // < 50% remaining -> yellow/orange
const CRITICAL_TIME_RATIO = 0.2; // < 20% remaining -> red
const WARNING_COLOR = "#f59e0b"; 
const PENALTY_MS = WRONG_ANSWER_PENALTY_SECONDS * 1000;
const FLASH_DURATION_MS = 900;

/**
 * The HUD shared by the Map and Room Screens: money earned and time
 * remaining, styled after #30's money label and time bar.
 */
export class Hud extends Konva.Group {
  private readonly moneyLabel: Konva.Text;
  private readonly timeLabel: Konva.Text;
  private readonly penaltyLabel: Konva.Text;
  private readonly barClip: Konva.Group;
  private readonly barFill: Konva.Rect;
  private readonly barOutline: Konva.Rect;

  private lastTimeRemainingMs: number | null = null;
  private lastRatio = 1;
  private lastHasTime = false;
  private flashTimeout: ReturnType<typeof setTimeout> | null = null;
  private isFlashingPenalty = false;

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
    this.add(this.barClip);

    this.barFill = new Konva.Rect({
      ...BAR,
      cornerRadius: BAR.height,
      fill: COLORS.green,
    });
    this.barClip.add(this.barFill);

    this.barOutline = new Konva.Rect({
      ...BAR,
      cornerRadius: BAR.height,
      stroke: "black",
      strokeWidth: 3,
    });
    this.add(this.barOutline);

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

    // Penalty indicator ("-60s") right beside the timer
    this.penaltyLabel = createText({
      x: BAR.x + BAR.width + 172, y: BAR.y, width: 85, height: BAR.height,
      verticalAlign: "middle",
      fontSize: 24,
      fontStyle: "bold",
      text: `-${WRONG_ANSWER_PENALTY_SECONDS}s`,
      fill: COLORS.red,
      visible: false,
      name: "hud-penalty",
    });
    this.add(this.penaltyLabel);

    this.setHud(0, 0, 0);
  }

  /** Shows the time remaining, the bar at remaining / limit (0–1), and the money. */
  setHud(timeRemainingMs: number, timeLimitMs: number, money: number): void {
    // Reset tracking at the start of a fresh heist
    if (timeLimitMs > 0 && timeRemainingMs >= timeLimitMs) {
      this.lastTimeRemainingMs = timeRemainingMs;
      this.clearPenaltyFlash();
    } else if (
      this.lastTimeRemainingMs !== null &&
      this.lastTimeRemainingMs - timeRemainingMs >= PENALTY_MS - 500
    ) {
      this.triggerPenaltyFlash();
    }
    this.lastTimeRemainingMs = timeRemainingMs;

    const ratio = timeLimitMs > 0 ? timeRemainingMs / timeLimitMs : 0;
    const clamped = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
    this.lastRatio = clamped;
    this.lastHasTime = timeLimitMs > 0 && timeRemainingMs > 0;

    this.barClip.clipWidth(BAR.width * clamped);
    this.updateTimerColors();

    this.timeLabel.text(formatTime(timeRemainingMs));
    this.moneyLabel.text(formatMoney(money));
    this.getLayer()?.batchDraw();
  }

  private updateTimerColors(): void {
    const isCritical = this.lastHasTime && this.lastRatio < CRITICAL_TIME_RATIO;
    const isWarning = this.lastHasTime && this.lastRatio < WARNING_TIME_RATIO;

    let barColor: string = COLORS.green;
    let timeTextColor: string = COLORS.white;

    if (isCritical) {
      barColor = COLORS.red;
      timeTextColor = COLORS.red;
    } else if (isWarning) {
      barColor = WARNING_COLOR;
      timeTextColor = WARNING_COLOR;
    }

    if (this.isFlashingPenalty) {
      timeTextColor = COLORS.red;
      this.barOutline.stroke(COLORS.red);
      this.barOutline.strokeWidth(5);
    } else {
      this.barOutline.stroke("black");
      this.barOutline.strokeWidth(3);
    }

    this.barFill.fill(barColor);
    this.timeLabel.fill(timeTextColor);
  }

  private triggerPenaltyFlash(): void {
    this.isFlashingPenalty = true;
    this.penaltyLabel.visible(true);
    this.updateTimerColors();

    if (this.flashTimeout) clearTimeout(this.flashTimeout);
    this.flashTimeout = setTimeout(() => {
      this.clearPenaltyFlash();
      this.updateTimerColors();
      this.getLayer()?.batchDraw();
    }, FLASH_DURATION_MS);
  }

  private clearPenaltyFlash(): void {
    this.isFlashingPenalty = false;
    this.penaltyLabel.visible(false);
    if (this.flashTimeout) {
      clearTimeout(this.flashTimeout);
      this.flashTimeout = null;
    }
  }

}

/** Full width of the time bar, for tests. */
export const HUD_BAR_WIDTH = BAR.width;
