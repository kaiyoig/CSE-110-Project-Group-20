import { FONT_FAMILY } from "./theme";

/**
 * The industrial look shared by the Power Box and the multistep room's
 * console, keypad and buttons: brushed steel, hazard stripes, green LCD
 * screens and status lights. One place, so the puzzles stay matched.
 */
export const INDUSTRIAL = {
  /** Brushed steel, as Konva linear-gradient color stops. */
  steel: [0, "#9aa3ad", 0.45, "#cfd5db", 0.55, "#b6bdc5", 1, "#7e8792"],
  edge: "#1b1d22",
  hazard: "#f5c400",
  ink: "#1a1a1a",
  rivet: "#6b7380",

  /** Dark readouts (status displays, instruction strip). */
  display: "#16181c",
  displayEdge: "#3a3f47",

  /** Green LCD screens. */
  lcd: "#0c1a10",
  lcdEdge: "#2b2f36",
  lcdText: "#5dff7a",
  lcdDim: "#3f9e52",
  lcdPlaceholder: "#2f7a3e",
  lcdWrong: "#3a0c0c",
  wrongText: "#ff5a5a",

  /** Status lights. */
  ledOn: "#4cff6a",
  ledOff: "#5c1414",

  /** Dark housings (keypad, socket) and the labels on them. */
  housing: "#2a2d33",
  housingEdge: "#15171a",
  housingText: "#c9ced4",
  /** Labels printed on the steel. */
  label: "#2a2d33",

  /** Raised keys and buttons, as gradient color stops. */
  keyFace: [0, "#eef1f4", 1, "#b8bfc7"],
  keyHighlight: [0, "#fff1a8", 1, "#f5c400"],
  keyGo: [0, "#8dffa0", 1, "#2fbf4a"],
  keyText: "#1a1a1a",

  title: FONT_FAMILY,
  mono: "'Courier New', monospace",
} as const;
