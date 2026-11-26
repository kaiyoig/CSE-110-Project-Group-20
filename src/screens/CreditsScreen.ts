import Konva from "konva";
import type { CreditsScreen as CreditsScreenContract, Unsubscribe } from "./contracts";
import { DESIGN_WIDTH, fitLayer } from "./layout";
import { Listeners } from "./listeners";
import { COLORS, createBackground, createButton, createText } from "./theme";
import { VAULT_DOOR, createVaultDoor } from "./vault";

export interface CreditsSection {
  heading: string;
  lines: string[];
}

/**
 * The credits shown on the screen. Sections fill the left column until it
 * holds about half the lines, then the right.
 */
export const CREDITS: CreditsSection[] = [
  { heading: "Team", lines: ["Seven Flaminiano", "Calista Hartono", "Asad Pasha Chaudhry", "Ping-Shu Lee", "Brian To", "Kaiyo Igaki"] },
  { heading: "Built With", lines: ["Konva", "Vite + TypeScript"] },
  { heading: "Fonts", lines: ["Gasoek One", "Fredoka"] },
  { heading: "Music", lines: ["Spy Loop — wipics (CC0)"] },
];

const PADDING = 40;
const COLUMN_GAP = 40;
const HEADING_SIZE = 30;
const LINE_SIZE = 22;
const LINE_HEIGHT = 30;
const SECTION_GAP = 24;
/** Space between the vault door's edge and the white card. */
const CARD_MARGIN = 20;
/** Space between the white card's top/bottom edge and the text. */
const CARD_PADDING = 20;

/** Lists who made the game; Back returns to the Start Screen. */
export class CreditsScreen implements CreditsScreenContract {
  readonly layer = new Konva.Layer();
  private readonly backs = new Listeners<[]>();

  constructor(stageWidth: number, stageHeight: number, credits: CreditsSection[] = CREDITS) {
    fitLayer(this.layer, stageWidth, stageHeight);
    this.layer.add(createBackground());

    this.layer.add(createVaultDoor());

    this.layer.add(createText({
      x: 0, y: 115, width: DESIGN_WIDTH, text: "CREDITS",
      fontFamily: "Gasoek One", fontStyle: "normal", fontSize: 80,
      align: "center", fill: COLORS.gold, listening: false,
    }));

    this.layer.add(this.buildColumns(credits));

    this.layer.add(createButton({
      x: VAULT_DOOR.x + (VAULT_DOOR.width - 163) / 2,
      y: VAULT_DOOR.y + VAULT_DOOR.height - 65 - 30,
      width: 163, height: 65, fontSize: 28,
      label: "Back", name: "credits-back",
      onClick: () => this.backs.emit(),
    }));
  }

  /** Lays the sections out in two columns on a white card inside the vault door. */
  private buildColumns(credits: CreditsSection[]): Konva.Group {
    const group = new Konva.Group({ listening: false });
    const columnWidth = (VAULT_DOOR.width - PADDING * 2 - COLUMN_GAP) / 2;
    const top = VAULT_DOOR.y + PADDING;
    const texts: Konva.Text[] = [];
    let bottom = top;

    splitInHalf(credits).forEach((column, i) => {
      const x = VAULT_DOOR.x + PADDING + i * (columnWidth + COLUMN_GAP);
      let y = top;
      for (const section of column) {
        texts.push(createText({
          x, y, width: columnWidth, text: section.heading,
          fontSize: HEADING_SIZE, fill: COLORS.purple,
        }));
        y += HEADING_SIZE + 10;
        for (const line of section.lines) {
          texts.push(createText({
            x, y, width: columnWidth, text: line,
            fontSize: LINE_SIZE, fontStyle: "500", fill: COLORS.purple,
          }));
          y += LINE_HEIGHT;
        }
        bottom = Math.max(bottom, y);
        y += SECTION_GAP;
      }
    });

    // White card behind the text so it reads clearly over the vault's rings
    group.add(new Konva.Rect({
      x: VAULT_DOOR.x + CARD_MARGIN,
      y: top - CARD_PADDING,
      width: VAULT_DOOR.width - CARD_MARGIN * 2,
      height: bottom - top + CARD_PADDING * 2,
      cornerRadius: 18,
      fill: COLORS.white,
      stroke: COLORS.purple,
      strokeWidth: 3,
      name: "credits-card",
    }));
    texts.forEach((text) => group.add(text));
    return group;
  }

  onBack(cb: () => void): Unsubscribe {
    return this.backs.add(cb);
  }

  show(): void {
    this.layer.show();
    this.layer.batchDraw();
  }

  hide(): void {
    this.layer.hide();
  }
}

/** Splits sections into two columns with roughly equal line counts (heading included). */
function splitInHalf(credits: CreditsSection[]): [CreditsSection[], CreditsSection[]] {
  const size = (section: CreditsSection) => section.lines.length + 1;
  const half = credits.reduce((sum, section) => sum + size(section), 0) / 2;
  let left = 0;
  let split = 0;
  while (split < credits.length && left < half) {
    left += size(credits[split]);
    split++;
  }
  return [credits.slice(0, split), credits.slice(split)];
}
