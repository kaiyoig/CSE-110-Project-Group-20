import Konva from "konva";

/** Colours for the server-room scene behind the power box. */
const SCENE = {
  wallTop: "#2b2f36",
  wallBottom: "#14161a",
  seam: "#ffffff",
  floor: "#0d0f12",
  rack: "#1b1e24",
  rackEdge: "#30353e",
  pipe: ["#5b6370", "#9aa3ad", "#4a515c"],
  hazard: "#f5c400",
  ink: "#1a1a1a",
  glow: "#ffd447",
  leds: ["#4cff6a", "#4cff6a", "#3fa9ff", "#ff3b3b", "#4cff6a", "#ffb020"],
} as const;

/**
 * The room the power box hangs in: a concrete wall, overhead pipes, server
 * racks with status LEDs, a warning sign, and a warm light on the box. Purely
 * decoration: nothing here listens for clicks.
 */
export class PowerBoxBackdrop {
  readonly group: Konva.Group;

  /**
   * @param width,height size of the scene (the screen's design size)
   * @param focus center of the power box, where the light falls
   */
  constructor(width: number, height: number, focus: { x: number; y: number }) {
    this.group = new Konva.Group({ name: "power-box-backdrop", listening: false });
    this.drawWall(width, height);
    this.drawGlow(focus);
    this.drawPipes(width);
    this.drawRack(40, 200, height);
    this.drawRack(width - 220, 200, height);
    this.drawFloor(width, height);
    this.drawWarningSign(width - 170, 82);
    this.drawConduit(focus);
  }

  destroy(): void {
    this.group.destroy();
  }

  private drawWall(width: number, height: number): void {
    this.group.add(new Konva.Rect({
      width, height,
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: height },
      fillLinearGradientColorStops: [0, SCENE.wallTop, 1, SCENE.wallBottom],
    }));
    // Concrete panels: faint seams in a staggered grid.
    for (let row = 0; row * 150 < height; row++) {
      const y = row * 150;
      this.group.add(new Konva.Line({ points: [0, y, width, y], stroke: SCENE.seam, opacity: 0.04, strokeWidth: 2 }));
      for (let x = row % 2 ? 120 : 0; x < width; x += 240) {
        this.group.add(new Konva.Line({ points: [x, y, x, y + 150], stroke: SCENE.seam, opacity: 0.04, strokeWidth: 2 }));
      }
    }
  }

  private drawGlow(focus: { x: number; y: number }): void {
    this.group.add(new Konva.Circle({
      x: focus.x, y: focus.y,
      radius: 620,
      fillRadialGradientStartPoint: { x: 0, y: 0 },
      fillRadialGradientEndPoint: { x: 0, y: 0 },
      fillRadialGradientStartRadius: 0,
      fillRadialGradientEndRadius: 620,
      fillRadialGradientColorStops: [0, "rgba(255,212,71,0.16)", 1, "rgba(255,212,71,0)"],
    }));
  }

  private drawPipes(width: number): void {
    // Just under the room title and above the box.
    [{ y: 178, r: 14 }, { y: 206, r: 8 }].forEach(({ y, r }) => {
      this.group.add(new Konva.Rect({
        x: 0, y: y - r, width, height: r * 2,
        fillLinearGradientStartPoint: { x: 0, y: 0 },
        fillLinearGradientEndPoint: { x: 0, y: r * 2 },
        fillLinearGradientColorStops: [0, SCENE.pipe[0], 0.4, SCENE.pipe[1], 1, SCENE.pipe[2]],
      }));
      for (let x = 90; x < width; x += 260) {
        this.group.add(new Konva.Rect({ x, y: y - r - 3, width: 14, height: r * 2 + 6, fill: SCENE.pipe[2], cornerRadius: 3 }));
      }
    });
  }

  private drawRack(x: number, top: number, height: number): void {
    const rackHeight = height - top - 70;
    this.group.add(new Konva.Rect({
      x, y: top, width: 180, height: rackHeight,
      fill: SCENE.rack, stroke: SCENE.rackEdge, strokeWidth: 4, cornerRadius: 6,
    }));
    const units = Math.floor((rackHeight - 20) / 46);
    for (let unit = 0; unit < units; unit++) {
      const y = top + 14 + unit * 46;
      this.group.add(new Konva.Rect({ x: x + 12, y, width: 156, height: 36, fill: "#23272f", cornerRadius: 3 }));
      for (let vent = 0; vent < 6; vent++) {
        this.group.add(new Konva.Line({ points: [x + 60 + vent * 16, y + 8, x + 60 + vent * 16, y + 28], stroke: "#0f1114", strokeWidth: 4 }));
      }
      const color = SCENE.leds[(unit * 7 + x) % SCENE.leds.length];
      this.group.add(new Konva.Circle({ x: x + 30, y: y + 18, radius: 5, fill: color, shadowColor: color, shadowBlur: 10, shadowOpacity: 0.9 }));
      this.group.add(new Konva.Circle({ x: x + 44, y: y + 18, radius: 3, fill: SCENE.leds[(unit + 1) % SCENE.leds.length], opacity: 0.8 }));
    }
  }

  private drawFloor(width: number, height: number): void {
    const top = height - 70;
    this.group.add(new Konva.Rect({ x: 0, y: top, width, height: 70, fill: SCENE.floor }));
    const stripe = new Konva.Group({ y: top, clipX: 0, clipY: 0, clipWidth: width, clipHeight: 14 });
    stripe.add(new Konva.Rect({ width, height: 14, fill: SCENE.hazard }));
    for (let x = -40; x < width + 40; x += 40) {
      stripe.add(new Konva.Line({ points: [x, 14, x + 20, 14, x + 34, 0, x + 14, 0], closed: true, fill: SCENE.ink }));
    }
    this.group.add(stripe);
  }

  private drawWarningSign(x: number, y: number): void {
    const sign = new Konva.Group({ x, y });
    sign.add(new Konva.Line({ points: [30, 0, 60, 52, 0, 52], closed: true, fill: SCENE.hazard, stroke: SCENE.ink, strokeWidth: 4, lineJoin: "round" }));
    sign.add(new Konva.Text({ x: 0, y: 18, width: 60, align: "center", text: "⚡", fontSize: 26, fill: SCENE.ink }));
    sign.add(new Konva.Text({ x: -50, y: 58, width: 160, align: "center", text: "HIGH VOLTAGE", fontSize: 14, fontStyle: "bold", fill: SCENE.hazard }));
    this.group.add(sign);
  }

  private drawConduit(focus: { x: number; y: number }): void {
    // A thick cable from the ceiling pipe down into the top of the box.
    this.group.add(new Konva.Line({
      points: [focus.x + 260, 206, focus.x + 260, focus.y - 200],
      stroke: "#0f1114", strokeWidth: 22, lineCap: "round",
    }));
    this.group.add(new Konva.Line({
      points: [focus.x + 256, 206, focus.x + 256, focus.y - 200],
      stroke: "#3a3f47", strokeWidth: 6, lineCap: "round",
    }));
  }
}
