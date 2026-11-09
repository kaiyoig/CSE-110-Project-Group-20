import Konva from "konva";
import { formatMath } from "../questions/formatMath";
import { PowerBoxBackdrop } from "./power-box-backdrop";

export interface PowerBoxViewOptions {
  /** Center of the panel, in layer coordinates. */
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * Also draw the server-room scene (`width` × `height` of the whole screen)
   * behind the panel. It goes just above the layer's first child, which is
   * the screen's plain background.
   */
  backdrop?: { width: number; height: number };
}

/** What the controller needs from a view. PowerBoxView implements it; tests use a fake. */
export interface PowerBoxViewLike {
  onLeftPressed?: (left: number) => void;
  onRightPressed?: (right: number) => void;
  /** The player let go of a dragged cable away from any jack, or clicked empty space. */
  onCancel?: () => void;
  render(equations: readonly string[], answers: readonly string[]): void;
  setSelected(left: number | null): void;
  connect(left: number, right: number): void;
  showWrong(right: number): void;
  setSecurity(matched: number, total: number): void;
  destroy(): void;
}

/** One cable colour per row. */
export const WIRE_COLORS = ["#ff4d4d", "#4d8cff", "#ffd447", "#ff66cc", "#59e36b"] as const;

/** How long a wrong answer flashes red. */
export const WRONG_FLASH_MS = 400;

/** A dragged cable snaps to a free right jack this close to the pointer. */
export const SNAP_RADIUS = 60;

/** The pointer has to move this far before a press counts as a drag. */
const DRAG_THRESHOLD = 8;

/** How long a cancelled cable takes to pull back, and a spark takes to fade. */
export const RETRACT_MS = 150;
export const SPARK_MS = 350;

/** One animation step. setTimeout (not requestAnimationFrame) so tests can use fake timers. */
const FRAME_MS = 16;

/** The industrial look: brushed steel, hazard stripes, green LCD screens. */
const STYLE = {
  steel: [0, "#9aa3ad", 0.45, "#cfd5db", 0.55, "#b6bdc5", 1, "#7e8792"],
  edge: "#1b1d22",
  hazard: "#f5c400",
  ink: "#1a1a1a",
  rivet: "#6b7380",
  lcd: "#0c1a10",
  lcdText: "#5dff7a",
  lcdWrong: "#3a0c0c",
  lcdWrongText: "#ff5a5a",
  jack: "#2a2d33",
  jackHole: "#0d0e10",
  ledOn: "#4cff6a",
  ledOff: "#5c1414",
  online: "#ff3b3b",
  offline: "#4cff6a",
  display: "#16181c",
  title: "Fredoka, sans-serif",
  mono: "'Courier New', monospace",
} as const;

const BAND_HEIGHT = 64;
const STATUS_TOP = 84;
const ROWS_TOP = 170;
const ROWS_BOTTOM_GAP = 24;
const JACK_RADIUS = 20;
/** Equations are long ("x · -17 - 20 = 302"), answers are short. */
const LEFT_LABEL_RATIO = 0.42;
const RIGHT_LABEL_RATIO = 0.18;

/**
 * Draws the power box: equations on green LCD screens on the left, answers on
 * the right, a jack beside each, and status LEDs at the top. Press a left
 * jack, then a right one (click-click or drag), to try a cable. The view only
 * draws and reports presses; PowerBoxController decides what they mean.
 */
export class PowerBoxView implements PowerBoxViewLike {
  onLeftPressed?: (left: number) => void;
  onRightPressed?: (right: number) => void;
  onCancel?: () => void;

  private readonly layer: Konva.Layer;
  private readonly options: PowerBoxViewOptions;
  private readonly backdrop: PowerBoxBackdrop | null;
  private readonly root: Konva.Group;
  private readonly rows = new Konva.Group({ name: "rows" });
  private readonly wires = new Konva.Group({ name: "wires", listening: false });
  private readonly lights = new Konva.Group({ name: "lights", listening: false });
  private readonly status: Konva.Text;
  private readonly preview: Konva.Group;
  private readonly sparks = new Konva.Group({ name: "sparks", listening: false });

  private leftJacks: Konva.Circle[] = [];
  private rightJacks: Konva.Circle[] = [];
  private selectionRings: Konva.Circle[] = [];
  private rightScreens: { box: Konva.Rect; text: Konva.Text }[] = [];
  private hoverRings: Konva.Circle[] = [];
  private readonly connectedRight = new Set<number>();
  private selected: number | null = null;
  /** The free right jack the dragged cable is snapped to, if any. */
  private snapped: number | null = null;
  /** Where a press on a left jack started, until the button is let go. */
  private pressStart: { x: number; y: number } | null = null;
  private dragging = false;
  /** Set by a jack's own handler so the stage handler (which runs after) leaves the event alone. */
  private eventHandledByJack = false;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(layer: Konva.Layer, options: PowerBoxViewOptions) {
    this.layer = layer;
    this.options = options;

    this.backdrop = options.backdrop
      ? new PowerBoxBackdrop(options.backdrop.width, options.backdrop.height, options)
      : null;
    if (this.backdrop) {
      layer.add(this.backdrop.group);
      // Above the screen's plain background, below its title, HUD and buttons.
      this.backdrop.group.zIndex(Math.min(1, layer.getChildren().length - 1));
    }

    this.root = new Konva.Group({
      x: options.x - options.width / 2,
      y: options.y - options.height / 2,
      name: "power-box",
    });
    this.drawPanel();

    this.status = new Konva.Text({
      y: STATUS_TOP + 20,
      fontFamily: STYLE.mono,
      fontSize: 24,
      fontStyle: "bold",
      name: "status",
      listening: false,
    });

    this.preview = new Konva.Group({ name: "preview", visible: false, listening: false });
    this.root.add(this.lights, this.status, this.wires, this.rows, this.preview, this.sparks);
    layer.add(this.root);

    const stage = layer.getStage();
    stage?.on("mousemove.powerbox touchmove.powerbox", () => this.onPointerMove());
    stage?.on("mouseup.powerbox touchend.powerbox", () => this.onPointerUp());
    stage?.on("mousedown.powerbox touchstart.powerbox", () => this.onPointerDown());
  }

  render(equations: readonly string[], answers: readonly string[]): void {
    this.rows.destroyChildren();
    this.wires.destroyChildren();
    this.leftJacks = [];
    this.rightJacks = [];
    this.selectionRings = [];
    this.rightScreens = [];
    this.hoverRings = [];
    this.connectedRight.clear();
    this.snapped = null;

    const { width } = this.options;
    const leftWidth = width * LEFT_LABEL_RATIO;
    const rightWidth = width * RIGHT_LABEL_RATIO;
    const leftJackX = 40 + leftWidth + JACK_RADIUS + 18;
    const rightLabelX = width - 40 - rightWidth;
    const rightJackX = rightLabelX - JACK_RADIUS - 18;
    const screenHeight = this.screenHeight(equations.length);

    equations.forEach((equation, left) => {
      const y = this.rowY(left, equations.length);
      const group = new Konva.Group({ name: `left-${left}` });
      group.add(this.screen(40, y, leftWidth, screenHeight, formatMath(equation)).group);
      const jack = this.jack(group, leftJackX, y, WIRE_COLORS[left % WIRE_COLORS.length]);
      const ring = new Konva.Circle({
        x: leftJackX, y, radius: JACK_RADIUS + 5,
        stroke: "#ffffff", strokeWidth: 4, visible: false, listening: false, name: "selection",
      });
      group.add(ring);
      group.on("mousedown touchstart", () => {
        this.eventHandledByJack = true;
        this.pressStart = this.pointer();
        this.dragging = false;
        this.onLeftPressed?.(left);
      });
      this.leftJacks.push(jack);
      this.selectionRings.push(ring);
      this.rows.add(group);
    });

    answers.forEach((answer, right) => {
      const y = this.rowY(right, answers.length);
      const group = new Konva.Group({ name: `right-${right}` });
      const screen = this.screen(rightLabelX, y, rightWidth, screenHeight, formatMath(answer));
      group.add(screen.group);
      const jack = this.jack(group, rightJackX, y, STYLE.jackHole);
      const hover = new Konva.Circle({
        x: rightJackX, y, radius: JACK_RADIUS + 7,
        stroke: STYLE.hazard, strokeWidth: 4,
        shadowColor: STYLE.hazard, shadowBlur: 16, shadowOpacity: 0.9,
        visible: false, listening: false, name: "snap",
      });
      group.add(hover);
      group.on("mousedown touchstart", () => {
        this.eventHandledByJack = true;
      });
      group.on("mouseup touchend", () => {
        this.eventHandledByJack = true;
        this.release(right);
      });
      this.rightJacks.push(jack);
      this.hoverRings.push(hover);
      this.rightScreens.push(screen);
      this.rows.add(group);
    });

    this.setSecurity(0, equations.length);
    this.layer.batchDraw();
  }

  setSelected(left: number | null): void {
    this.selected = left;
    this.selectionRings.forEach((ring, index) => ring.visible(index === left));
    if (left === null) this.setSnapped(null);
    this.updatePreview();
  }

  connect(left: number, right: number): void {
    const from = this.leftJacks[left];
    const to = this.rightJacks[right];
    const color = WIRE_COLORS[left % WIRE_COLORS.length];
    to.fill(color);
    this.connectedRight.add(right);
    this.cable(this.wires, from.x(), from.y(), to.x(), to.y(), color, `wire wire-${left}`);
    this.spark(to.x(), to.y());
    this.layer.batchDraw();
  }

  showWrong(right: number): void {
    const { box, text } = this.rightScreens[right];
    box.fill(STYLE.lcdWrong);
    text.fill(STYLE.lcdWrongText);
    this.layer.batchDraw();
    this.timers.push(setTimeout(() => {
      box.fill(STYLE.lcd);
      text.fill(STYLE.lcdText);
      this.layer.batchDraw();
    }, WRONG_FLASH_MS));
  }

  setSecurity(matched: number, total: number): void {
    const offline = matched === total;
    this.status.text(offline ? "OFFLINE" : `ONLINE: ${total - matched} LEFT`);
    this.status.fill(offline ? STYLE.offline : STYLE.online);

    // The display box grows with the number of lights: [ ● ● ● ●  ONLINE: 2 LEFT ]
    const spacing = 40;
    const padding = 30;
    const textWidth = 230;
    const boxWidth = padding + total * spacing + textWidth;
    const boxX = this.options.width / 2 - boxWidth / 2;
    this.lights.destroyChildren();
    this.lights.add(new Konva.Rect({
      x: boxX, y: STATUS_TOP, width: boxWidth, height: 66,
      fill: STYLE.display, stroke: "#3a3f47", strokeWidth: 3, cornerRadius: 8,
    }));
    for (let i = 0; i < total; i++) {
      const on = i < matched;
      this.lights.add(new Konva.Circle({
        x: boxX + padding + 4 + i * spacing,
        y: STATUS_TOP + 33,
        radius: 13,
        fill: on ? STYLE.ledOn : STYLE.ledOff,
        shadowColor: on ? STYLE.ledOn : STYLE.online,
        shadowBlur: on ? 20 : 4,
        shadowOpacity: 0.9,
        name: on ? "light light-on" : "light light-off",
      }));
    }
    this.status.x(boxX + padding + total * spacing - 4);
    this.status.width(textWidth);
    this.layer.batchDraw();
  }

  destroy(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers = [];
    this.layer.getStage()?.off(".powerbox");
    this.onLeftPressed = undefined;
    this.onRightPressed = undefined;
    this.onCancel = undefined;
    this.root.destroy();
    this.backdrop?.destroy();
    this.layer.batchDraw();
  }

  /** Steel plate, hazard band with the title, and rivets. */
  private drawPanel(): void {
    const { width, height } = this.options;
    this.root.add(new Konva.Rect({
      x: 8, y: 12, width, height,
      fill: "#000000", opacity: 0.45, cornerRadius: 10, listening: false,
    }));
    this.root.add(new Konva.Rect({
      width, height,
      cornerRadius: 10,
      stroke: STYLE.edge,
      strokeWidth: 6,
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: width, y: height },
      fillLinearGradientColorStops: [...STYLE.steel],
      listening: false,
    }));
    for (let y = BAND_HEIGHT + 6; y < height - 6; y += 8) {
      this.root.add(new Konva.Line({ points: [10, y, width - 10, y], stroke: "#ffffff", opacity: 0.06, strokeWidth: 1, listening: false }));
    }

    const band = new Konva.Group({ clipX: 0, clipY: 0, clipWidth: width, clipHeight: BAND_HEIGHT, listening: false });
    band.add(new Konva.Rect({ width, height: BAND_HEIGHT, fill: STYLE.hazard }));
    for (let x = -60; x < width + 60; x += 56) {
      band.add(new Konva.Line({ points: [x, BAND_HEIGHT, x + 28, BAND_HEIGHT, x + 92, 0, x + 64, 0], closed: true, fill: STYLE.ink }));
    }
    this.root.add(band);
    this.root.add(new Konva.Rect({ x: width / 2 - 230, y: 10, width: 460, height: 44, fill: STYLE.ink, cornerRadius: 4, listening: false }));
    this.root.add(new Konva.Text({
      x: width / 2 - 230, y: 20, width: 460,
      align: "center",
      text: "⚡ SECURITY POWER BOX ⚡",
      fontFamily: STYLE.title,
      fontSize: 26,
      fontStyle: "bold",
      fill: STYLE.hazard,
      listening: false,
    }));

    for (const [x, y] of [[18, BAND_HEIGHT + 16], [width - 18, BAND_HEIGHT + 16], [18, height - 18], [width - 18, height - 18]]) {
      this.root.add(new Konva.Circle({ x, y, radius: 9, fill: STYLE.rivet, stroke: "#3a3f47", strokeWidth: 2, listening: false }));
    }
  }

  private rowY(index: number, count: number): number {
    const space = (this.options.height - ROWS_TOP - ROWS_BOTTOM_GAP) / count;
    return ROWS_TOP + space * index + space / 2;
  }

  private screenHeight(count: number): number {
    const space = (this.options.height - ROWS_TOP - ROWS_BOTTOM_GAP) / count;
    return Math.min(60, space - 10);
  }

  /** A green LCD screen showing `text`, centered vertically on `centerY`. */
  private screen(x: number, centerY: number, width: number, height: number, text: string) {
    const group = new Konva.Group({ x, y: centerY - height / 2 });
    const box = new Konva.Rect({
      width, height,
      fill: STYLE.lcd, stroke: "#2b2f36", strokeWidth: 5, cornerRadius: 6,
      name: "label-box",
    });
    const label = new Konva.Text({
      width, height,
      text,
      align: "center",
      verticalAlign: "middle",
      fontFamily: STYLE.mono,
      fontSize: Math.min(28, height * 0.5),
      fontStyle: "bold",
      fill: STYLE.lcdText,
      shadowColor: STYLE.lcdText,
      shadowBlur: 8,
      name: "label-text",
    });
    group.add(box, label);
    return { group, box, text: label };
  }

  /** A jack (socket). Returns the inner hole, whose fill shows the cable colour. */
  private jack(group: Konva.Group, x: number, y: number, holeColor: string): Konva.Circle {
    group.add(new Konva.Circle({ x, y, radius: JACK_RADIUS, fill: STYLE.jack, stroke: "#15171a", strokeWidth: 4 }));
    const hole = new Konva.Circle({ x, y, radius: JACK_RADIUS / 2, fill: holeColor, name: "plug" });
    group.add(hole);
    return hole;
  }

  /** A sagging cable with a shadow and a highlight, drawn into `parent`. */
  private cable(parent: Konva.Group, x1: number, y1: number, x2: number, y2: number, color: string, name: string, dash?: number[]): void {
    const midX = (x1 + x2) / 2;
    const sag = 40;
    const points = [x1, y1, midX, y1 + sag, midX, y2 + sag, x2, y2];
    parent.add(new Konva.Line({ points, bezier: true, x: 4, y: 8, stroke: "#111111", opacity: 0.35, strokeWidth: 20, lineCap: "round", dash, name: "cable-shadow" }));
    parent.add(new Konva.Line({ points, bezier: true, stroke: color, strokeWidth: 16, lineCap: "round", dash, name }));
    parent.add(new Konva.Line({
      points: [x1, y1 - 4, midX, y1 + sag - 4, midX, y2 + sag - 4, x2, y2 - 4],
      bezier: true, stroke: "#ffffff", opacity: 0.25, strokeWidth: 4, lineCap: "round", dash, name: "cable-shine",
    }));
  }

  // ── Pointer handling ─────────────────────────────────────────────────────
  // Jack handlers run first, then the event reaches the stage handlers below.

  private onPointerMove(): void {
    const pointer = this.pointer();
    if (this.pressStart && pointer && !this.dragging) {
      const moved = Math.hypot(pointer.x - this.pressStart.x, pointer.y - this.pressStart.y);
      this.dragging = moved > DRAG_THRESHOLD;
    }
    this.updatePreview();
  }

  /**
   * A button press off the jacks while a cable is selected: next to a
   * highlighted (snapped) jack it plugs in there; anywhere else it drops the cable.
   */
  private onPointerDown(): void {
    const onJack = this.eventHandledByJack;
    this.eventHandledByJack = false;
    if (onJack || this.selected === null) return;
    if (this.snapped !== null) this.release(this.snapped);
    else this.cancel();
  }

  /**
   * A button release. After a drag: on (or snapped to) a right jack it tries
   * the cable; anywhere else it pulls the cable back. After a plain click the
   * cable stays selected, waiting for a click on a right jack.
   */
  private onPointerUp(): void {
    const onJack = this.eventHandledByJack;
    const wasDragging = this.dragging;
    this.eventHandledByJack = false;
    this.pressStart = null;
    this.dragging = false;
    if (onJack || !wasDragging || this.selected === null) return;

    if (this.snapped !== null) this.release(this.snapped);
    else this.cancel();
  }

  private release(right: number): void {
    this.pressStart = null;
    this.dragging = false;
    this.onRightPressed?.(right);
  }

  /** Pulls the preview cable back into its jack, then tells the controller. */
  private cancel(): void {
    const left = this.selected;
    const end = this.previewEnd;
    this.onCancel?.();
    if (left === null || !end) return;

    const from = this.leftJacks[left];
    const color = WIRE_COLORS[left % WIRE_COLORS.length];
    this.animate(RETRACT_MS, (t) => {
      if (this.selected !== null) return; // a new cable was picked; don't draw over it
      const x = end.x + (from.x() - end.x) * t;
      const y = end.y + (from.y() - end.y) * t;
      this.drawPreview(from.x(), from.y(), x, y, color);
    }, () => {
      if (this.selected !== null) return;
      this.preview.destroyChildren();
      this.preview.visible(false);
    });
  }

  // ── Drawing helpers ──────────────────────────────────────────────────────

  /** Where the end of the preview cable was last drawn (for the pull-back). */
  private previewEnd: { x: number; y: number } | null = null;

  private updatePreview(): void {
    const pointer = this.selected === null ? null : this.pointer();
    if (this.selected === null || !pointer) {
      this.preview.destroyChildren();
      this.preview.visible(false);
      this.previewEnd = null;
      this.layer.batchDraw();
      return;
    }
    const from = this.leftJacks[this.selected];
    this.setSnapped(this.nearestFreeRight(pointer));
    const end = this.snapped !== null
      ? { x: this.rightJacks[this.snapped].x(), y: this.rightJacks[this.snapped].y() }
      : pointer;
    this.drawPreview(from.x(), from.y(), end.x, end.y, WIRE_COLORS[this.selected % WIRE_COLORS.length]);
  }

  private drawPreview(x1: number, y1: number, x2: number, y2: number, color: string): void {
    this.preview.destroyChildren();
    this.cable(this.preview, x1, y1, x2, y2, color, "preview-cable", [22, 12]);
    this.plugHead(this.preview, x1, y1, x2, y2, color);
    this.previewEnd = { x: x2, y: y2 };
    this.preview.visible(true);
    this.preview.moveToTop();
    this.layer.batchDraw();
  }

  /** The free right jack within SNAP_RADIUS of `point`, closest first. */
  private nearestFreeRight(point: { x: number; y: number }): number | null {
    let best: number | null = null;
    let bestDistance = SNAP_RADIUS;
    this.rightJacks.forEach((jack, right) => {
      if (this.connectedRight.has(right)) return;
      const distance = Math.hypot(jack.x() - point.x, jack.y() - point.y);
      if (distance <= bestDistance) {
        best = right;
        bestDistance = distance;
      }
    });
    return best;
  }

  private setSnapped(right: number | null): void {
    this.snapped = right;
    this.hoverRings.forEach((ring, index) => ring.visible(index === right));
  }

  /**
   * A plug on the free end of a cable, turned to follow the cable. The cable
   * comes in from its last control point (midX, y2 + sag), like `cable()`.
   */
  private plugHead(parent: Konva.Group, x1: number, y1: number, x2: number, y2: number, color: string): void {
    const midX = (x1 + x2) / 2;
    const angle = Math.atan2(y2 - (y2 + 40), x2 - midX) * (180 / Math.PI);
    const plug = new Konva.Group({ x: x2, y: y2, rotation: angle, name: "plug-head" });
    plug.add(new Konva.Rect({ x: -30, y: -13, width: 30, height: 26, cornerRadius: 5, fill: color, stroke: "#111111", strokeWidth: 3 }));
    plug.add(new Konva.Rect({ x: -24, y: -13, width: 4, height: 26, fill: "#000000", opacity: 0.25 }));
    plug.add(new Konva.Rect({ x: 0, y: -6, width: 14, height: 12, cornerRadius: 2, fill: "#d1d5db", stroke: "#4b5563", strokeWidth: 2 }));
    parent.add(plug);
  }

  /** A short burst of sparks and a flash where a cable plugs in. */
  private spark(x: number, y: number): void {
    const burst = new Konva.Group({ x, y, name: "spark" });
    burst.add(new Konva.Circle({ radius: 30, fill: "#fff7cc", opacity: 0.8, name: "flash" }));
    const rays: Konva.Line[] = [];
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + (i % 2) * 0.3;
      const ray = new Konva.Line({
        points: [0, 0, 0, 0],
        stroke: i % 2 ? "#ffd447" : "#ffffff",
        strokeWidth: 3,
        lineCap: "round",
        shadowColor: "#ffd447",
        shadowBlur: 10,
      });
      ray.setAttr("angle", angle);
      rays.push(ray);
      burst.add(ray);
    }
    this.sparks.add(burst);

    this.animate(SPARK_MS, (t) => {
      const inner = 14 + 30 * t;
      const outer = 24 + 46 * t;
      for (const ray of rays) {
        const angle = ray.getAttr("angle") as number;
        ray.points([Math.cos(angle) * inner, Math.sin(angle) * inner, Math.cos(angle) * outer, Math.sin(angle) * outer]);
      }
      burst.opacity(1 - t);
      this.layer.batchDraw();
    }, () => burst.destroy());
  }

  /** Runs `frame(t)` with t going 0 → 1 over `duration`, then `done()`. */
  private animate(duration: number, frame: (t: number) => void, done: () => void): void {
    const steps = Math.max(1, Math.round(duration / FRAME_MS));
    for (let step = 1; step <= steps; step++) {
      this.timers.push(setTimeout(() => {
        frame(step / steps);
        if (step === steps) {
          done();
          this.layer.batchDraw();
        }
      }, step * FRAME_MS));
    }
    frame(0);
  }

  private pointer(): { x: number; y: number } | null {
    return this.root.getRelativePointerPosition?.() ?? null;
  }
}
