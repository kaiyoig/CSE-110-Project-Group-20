import Konva from "konva";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "./layout";

/** Colours and font shared by every screen, from the map design in #30. */
export const COLORS = {
  background: "#202543",
  room: "#d9d9d9",
  locked: "#5b5b5b",
  purple: "#342657",
  button: "#f4f4f4",
  buttonDisabled: "rgba(183, 183, 183, 0.73)",
  buttonSolved: "#8ee4a2ff",
  gold: "#ffd447",
  green: "#81ff38",
  darkGreen: "#02671dff",
  red: "#ff5a5a",
  white: "#ffffff",
} as const;

export const BONUS_COLORS = {
  floor: "rgba(238, 229, 162, 1)", 
  border: "#b45309",
  buttonFill: "#fef08a", 
  buttonStroke: "#d97706", 
  text: "#78350f", 
};

export const VAULT_COLORS = {
  floorLocked: "#343943ff",  
  floorOpen: "#334155", 
  borderLocked: "#3397c2ff",  
  borderOpen: "#60a5fa",
  button: "#2f2e3bff", 
  buttonLocked: '#828aaaff',
  buttonStroke: "#0284c7",
  buttonStar: "#38bdf8", 
  textLocked: "#94a3b8", 
  blue: "#053072ff",
};

export const FONT_FAMILY = "Fredoka, sans-serif";

/** A full-design-size background rectangle. */
export function createBackground(): Konva.Rect {
  return new Konva.Rect({
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    fill: COLORS.background,
    listening: false,
  });
}

/** Text in the shared font. */
export function createText(config: Konva.TextConfig): Konva.Text {
  return new Konva.Text({
    fontFamily: FONT_FAMILY,
    fontSize: 24,
    fontStyle: "600",
    fill: COLORS.white,
    ...config,
  });
}

export interface ButtonOptions {
  x: number;
  y: number;
  label: string;
  /** Konva name, used to find the button (e.g. in tests). */
  name?: string;
  width?: number;
  height?: number;
  fontSize?: number;
  onClick: () => void;
}

/**
 * A pill button with a solid offset underneath, styled after #30's room
 * buttons. The returned group fires `onClick` on click or tap.
 */
export function createButton(options: ButtonOptions): Konva.Group {
  const width = options.width ?? 191;
  const height = options.height ?? 43;
  const group = new Konva.Group({ x: options.x, y: options.y, name: options.name });

  group.add(new Konva.Rect({
    y: 4, width, height,
    cornerRadius: height / 2,
    fill: COLORS.purple,
    listening: false,
  }));
  group.add(new Konva.Rect({
    width, height,
    cornerRadius: height / 2,
    stroke: COLORS.purple, strokeWidth: 3,
    fill: COLORS.button,
    name: "face",
  }));
  group.add(createText({
    width, height,
    text: options.label,
    align: "center",
    verticalAlign: "middle",
    fontSize: options.fontSize ?? 24,
    fill: COLORS.purple,
    listening: false,
    name: "label",
  }));

  group.on("mouseenter", () => setCursor(group, "pointer"));
  group.on("mouseleave", () => setCursor(group, ""));
  group.on("click tap", () => options.onClick());
  return group;
}

/** Sets the cursor on the stage's container, if the node is on a stage. */
export function setCursor(node: Konva.Node, cursor: string): void {
  const stage = node.getStage();
  if (stage) stage.container().style.cursor = cursor;
}
