import Konva from 'konva'

import { Term, TermValue } from './types'
import MultistepSolverModel, { DisplayTerm as ModelDisplayTerm } from './multistep-solver-model'

type Block = Konva.Group
type BlockRole = 'value' | 'variable' | 'operator' | 'equals'

interface DisplayTerm {
  term: Term
  modelIndex: number
  isCoefficient?: boolean
  negativeSign?: boolean
  displayText?: string
}

/** Colors and type for the equation's blocks and the drop zone. */
export interface MultistepSolverTheme {
  valueFill: string
  valueStroke?: string
  valueText: string
  /** Blocks holding a variable such as `x`; defaults to the value colors. */
  variableFill?: string
  variableStroke?: string
  variableText?: string
  operatorFill: string
  operatorText: string
  equalsFill: string
  equalsText: string
  fontFamily?: string
  fontStyle?: string
  /** How operators are shown, e.g. `{ '*': '·' }`. The model keeps its own. */
  operatorSymbols?: Partial<Record<string, string>>
  dropZoneFill: string
  dropZoneStroke?: string
  dropZoneLabel: string
  dropZoneLabelColor: string
  dropZoneFontSize: number
}

const DEFAULT_THEME: MultistepSolverTheme = {
  valueFill: '#4ade80',
  valueText: 'black',
  operatorFill: '#ffde80',
  operatorText: 'black',
  equalsFill: '#bbcccc',
  equalsText: 'black',
  dropZoneFill: '#eeeeee',
  dropZoneLabel: 'Drag term here',
  dropZoneLabelColor: '#4b5563',
  dropZoneFontSize: 14,
}

export interface MultistepSolverViewOptions {
  panelWidth: number
  panelHeight: number
  blockSize?: number
  panelColor?: string
  theme?: Partial<MultistepSolverTheme>
  /** Center of the equation, from the panel's top-left. Default: a quarter of the way down. */
  equationCenter?: { x: number, y: number }
  /** Center and size of the drop zone, from the panel's top-left. Default: the panel's center. */
  dropZone?: { x: number, y: number, size: number }
}

/** Space on each side of a block's text, so wide values like `(-12)` fit. */
const BLOCK_TEXT_PADDING = 8

/** Renders the equation, solver panel, and drag-and-drop drop zone. */
class MultistepSolverView {
  private leftSide: Array<Block> = []
  private rightSide: Array<Block> = []

  private stage: Konva.Stage
  private layer: Konva.Layer
  private view: Konva.Group
  private panel: Konva.Rect
  private dropZone: Konva.Group
  private dropZoneText: Konva.Text

  private readonly panelWidth: number
  private readonly panelHeight: number
  private readonly blockSize: number

  private blockInDrop: Block | null = null

  private equalSign: Konva.Group

  private readonly theme: MultistepSolverTheme
  private readonly equationCenter?: { x: number, y: number }
  private readonly dropZoneCenter?: { x: number, y: number }
  private readonly DROP_ZONE_SIZE: number

  public onTargetDropped?: (index: number, left: boolean, isCoefficient: boolean) => void
  public onNegativeSignDropped?: (left: boolean) => void

  private rectIntersectsRect(a: Konva.IRect, b: Konva.IRect): boolean {
    return a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y;
  }

  // A palette block is a block that can be "dragged" into the drop zone.
  // All terms qualify as palette blocks, while all operators don't. 
  //
  // e.g. you can't drag + to the other side
  private makePaletteBlock(block: Block) {
    block.setAttr('paletteBlock', true);
    block.on('mousedown.palette touchstart.palette', _ => {
      const isNegativeSign = block.getAttr('negativeSign') === true;
      let mousePosition = this.stage.getPointerPosition();
      if (mousePosition == null) return;

      const clone = block.clone()
      clone.off('.palette');
      clone.setAttr('clone', true);

      clone.on('dragend.workspace touchend.workspace', _ => {
        if ((!this.onTargetDropped && !this.onNegativeSignDropped) || this.dropZone.listening() == false) {
          clone.destroy();
          return;
        }

        let blockRect = clone.getClientRect();
        let dropZoneRect = this.dropZone.getClientRect();

        if (this.rectIntersectsRect(blockRect, dropZoneRect)) {
          let leftIndex = this.leftSide.indexOf(block);
          let rightIndex = this.rightSide.indexOf(block);

          if (leftIndex >= 0 && rightIndex >= 0) {
            throw Error("Found duplicate blocks in both equation sides!");
          } else if (leftIndex < 0 && rightIndex < 0) {
            throw Error("Drop payload does not exist on any equation side!");
          }

          let isLeftSide = leftIndex >= 0;
          const droppedTerm = block.getAttr('term') as Term;
          const sideBlocks = isLeftSide ? this.leftSide : this.rightSide;
          const isOnlyZero = sideBlocks.length === 1 &&
            typeof droppedTerm !== 'string' &&
            droppedTerm.constant &&
            droppedTerm.term.split('/')[0] === '0';
          if (isOnlyZero) {
            clone.destroy();
            return;
          }

          if (isNegativeSign) {
            this.centerInDropzone(clone);
            this.dropZoneText.visible(false);
            this.blockInDrop = clone;
            this.onNegativeSignDropped?.(isLeftSide);
            return;
          }

          let index = block.getAttr('modelIndex') as number;
          if (index === undefined) {
            index = isLeftSide ? leftIndex : rightIndex;
          }

          this.clearDropzone();

          this.blockInDrop = clone;
          this.centerInDropzone(clone);
          this.dropZoneText.visible(false);

          this.onTargetDropped?.(index, isLeftSide, block.getAttr('isCoefficient') === true);
        } else {
          clone.destroy();
        }
      });

      this.layer.add(clone);

      // The pointer is in stage coordinates; the layer may be scaled and offset.
      clone.absolutePosition(mousePosition);
      clone.startDrag();
    });
  }

  // Centers a dropped clone on the drop zone. Client rects are in stage
  // coordinates, so this works on a scaled or offset layer too.
  private centerInDropzone(clone: Konva.Node) {
    const dropZoneRect = this.dropZone.getClientRect();
    const cloneRect = clone.getClientRect();
    const offset = clone.absolutePosition();
    clone.absolutePosition({
      x: offset.x + dropZoneRect.x + (dropZoneRect.width - cloneRect.width) / 2 - cloneRect.x,
      y: offset.y + dropZoneRect.y + (dropZoneRect.height - cloneRect.height) / 2 - cloneRect.y,
    });
  }

  // If a block is a palette, "un-palette" it.
  private removePaletteStatus(block: Block) {
    block.setAttr('paletteBlock', false);
    block.off(".palette");
  }

  private createBlock(x: number, y: number, text: string, role: BlockRole): Konva.Group {
    const width = this.blockWidth(text);
    const colors = this.colorsFor(role);
    const group = new Konva.Group({
      x,
      y,
      width,
      height: this.blockSize,
    });

    group.add(
      new Konva.Rect({
        name: "background",
        width,
        height: this.blockSize,
        fill: colors.fill,
        stroke: colors.stroke,
        strokeWidth: colors.stroke ? 3 : 0,
        cornerRadius: 6,
      })
    );

    group.add(
      new Konva.Text({
        name: "text",
        width,
        height: this.blockSize,
        text: text,
        align: "center",
        verticalAlign: "middle",
        fontSize: this.fontSize(),
        fontFamily: this.theme.fontFamily,
        fontStyle: this.theme.fontStyle,
        fill: colors.text,
      })
    );

    return group;
  }

  private fontSize(): number {
    return Math.floor(this.blockSize * 2 / 4);
  }

  /**
   * Wide enough for the text, never narrower than a square block. Measured
   * from the character count (about 0.62 em each, a little wide for most
   * fonts) so it does not depend on fonts having loaded.
   */
  private blockWidth(text: string): number {
    const textWidth = [...text].length * this.fontSize() * 0.62;
    return Math.max(this.blockSize, Math.ceil(textWidth + 2 * BLOCK_TEXT_PADDING));
  }

  private colorsFor(role: BlockRole): { fill: string, stroke?: string, text: string } {
    const t = this.theme;
    switch (role) {
      case 'operator': return { fill: t.operatorFill, text: t.operatorText };
      case 'equals': return { fill: t.equalsFill, text: t.equalsText };
      case 'variable': return {
        fill: t.variableFill ?? t.valueFill,
        stroke: t.variableStroke ?? t.valueStroke,
        text: t.variableText ?? t.valueText,
      };
      default: return { fill: t.valueFill, stroke: t.valueStroke, text: t.valueText };
    }
  }

  private roleOf(displayTerm: DisplayTerm): BlockRole {
    const term = displayTerm.term;
    if (displayTerm.negativeSign) return 'value';
    if (typeof term === 'string') return 'operator';
    return term.constant ? 'value' : 'variable';
  }

  private textOf(displayTerm: DisplayTerm): string {
    if (displayTerm.displayText) return displayTerm.displayText;
    const term = displayTerm.term;
    if (typeof term === 'string') return this.theme.operatorSymbols?.[term] ?? term;
    return term.term;
  }

  /** Repaints and resizes a block for its text and role. */
  private styleBlock(block: Block, text: string, role: BlockRole): void {
    const width = this.blockWidth(text);
    const colors = this.colorsFor(role);
    const background = block.findOne<Konva.Rect>(".background");
    const label = block.findOne<Konva.Text>(".text");
    if (!label || !background) {
      throw Error("Could not update block because text or background doesn't exist in the group.");
    }
    block.width(width);
    background.width(width);
    background.fill(colors.fill);
    background.setAttr('stroke', colors.stroke);
    background.setAttr('strokeWidth', colors.stroke ? 3 : 0);
    label.width(width);
    label.text(text);
    label.fill(colors.text);
  }

  private createTermBlock(x: number, y: number, displayTerm: DisplayTerm): Konva.Group {
    let term = displayTerm.term;
    let isOperator = typeof term == "string";

    let group = this.createBlock(x, y, this.textOf(displayTerm), this.roleOf(displayTerm));

    group.setAttr('term', term);
    group.setAttr('modelIndex', displayTerm.modelIndex);
    group.setAttr('isCoefficient', displayTerm.isCoefficient === true);
    if (displayTerm.negativeSign) {
      group.setAttr('negativeSign', true);
      this.makePaletteBlock(group);
    }

    if (!isOperator && !displayTerm.negativeSign) {
      this.makePaletteBlock(group);
    }

    return group;
  }

  // TODO: Change y position
  private addBlock(side: Array<Block>, displayTerm: DisplayTerm) {
    let previousBlock = side.at(side.length - 1);
    if (!previousBlock) {
      side.push(this.createTermBlock(0, 100, displayTerm));
      return;
    }
    let x = previousBlock.x();
    let width = previousBlock.width();
    side.push(this.createTermBlock(x + width, 100, displayTerm));
  }

  private updateBlock(block: Block, displayTerm: DisplayTerm) {
    let term = displayTerm.term;
    let prevTerm: Term = block.getAttr('term');
    const isNegativeSign = displayTerm.negativeSign === true;
    const isOperator = typeof term === 'string';
    block.setAttr('modelIndex', displayTerm.modelIndex);
    block.setAttr('isCoefficient', displayTerm.isCoefficient === true);
    block.setAttr('negativeSign', isNegativeSign);

    const shouldBePalette = isNegativeSign || !isOperator;
    const isPalette = block.getAttr('paletteBlock') === true;
    if (shouldBePalette && !isPalette) {
      this.makePaletteBlock(block);
    } else if (!shouldBePalette && isPalette) {
      this.removePaletteStatus(block);
    }

    if (prevTerm != term) block.setAttr('term', term);
    this.styleBlock(block, this.textOf(displayTerm), this.roleOf(displayTerm));
  }

  private getDisplayTerms(displaySide: Array<ModelDisplayTerm>): Array<DisplayTerm> {
    let displayTerms: Array<DisplayTerm> = [];
    const terms = displaySide.map(({ term }) => term);
    const hasLeadingMinusOperator = terms[0] === '-';
    const variableIndex = hasLeadingMinusOperator ? 1 : 0;
    const multiplicationIndex = variableIndex + 1;
    const coefficientIndex = variableIndex + 2;
    const variable = terms[variableIndex];
    const isNegativeVariable = variable !== undefined && typeof variable !== 'string' &&
      variable.constant === false &&
      (hasLeadingMinusOperator || !variable.positive);
    // `-x * 3` or a lone `-x`: its minus sign can be dragged away.
    const canRemoveNegativeSign = isNegativeVariable && (
      terms.length === variableIndex + 1 || (
        terms.length === coefficientIndex + 1 &&
        terms[multiplicationIndex] === '*' &&
        typeof terms[coefficientIndex] !== 'string' &&
        terms[coefficientIndex].constant === true));

    for (let i = 0; i < terms.length; ++i) {
      let term = terms.at(i);
      if (!term) continue;
      const modelDisplayTerm = displaySide[i]

      const isZero = typeof term !== 'string' && term.constant && term.term.split('/')[0] === '0';
      if (i === 0 && hasLeadingMinusOperator && canRemoveNegativeSign) {
        displayTerms.push({
          term: '-',
          modelIndex: displaySide[variableIndex].modelIndex,
          negativeSign: true,
        });
        continue;
      }
      if (i === 0 && hasLeadingMinusOperator) {
        displayTerms.push({ term, modelIndex: displaySide[i].modelIndex });
        continue;
      }
      if (i === 0 && typeof term !== 'string' && !term.positive && !isZero &&
        !(term.constant && terms[i + 1] === '*')) {
        displayTerms.push({
          term: '-',
          modelIndex: displaySide[i].modelIndex,
          negativeSign: canRemoveNegativeSign,
        });
      }
      if (i > 0 && typeof term !== 'string' && typeof terms[i - 1] !== 'string') {
        displayTerms.push({
          term: term.positive ? '+' : '-',
          modelIndex: displaySide[i].modelIndex,
        });
      }
      const isNegativeFactor = i > 0 &&
        typeof term !== 'string' &&
        !term.positive &&
        (terms[i - 1] === '*' || terms[i - 1] === '/') &&
        term.constant;
      displayTerms.push({
        term,
        modelIndex: displaySide[i].modelIndex,
        isCoefficient: displaySide[i].isCoefficient,
        displayText: modelDisplayTerm.displayText ?? (isNegativeFactor
          ? `(-${term.term})`
          : (i === 0 && typeof term !== 'string' && !term.positive && term.constant && terms[i + 1] === '*')
            ? `-${term.term}`
            : undefined),
      });
    }

    return displayTerms;
  }

  private updateSide(side: Array<Block>, displaySide: Array<ModelDisplayTerm>) {
    let displayTerms = this.getDisplayTerms(displaySide);
    // console.debug(displaySide, displayTerms)

    if (displayTerms.length < side.length) {
      let extraBlocks = side.splice(displayTerms.length);
      for (let extraBlock of extraBlocks) {
        extraBlock.destroy();
      }
    }

    for (let i = 0; i < displayTerms.length; ++i) {
      let displayTerm = displayTerms.at(i);
      if (!displayTerm)
        throw Error("Multistep Solver Model has undefined term in the middle of the array!");

      let currentBlock = side.at(i);

      if (!currentBlock) {
        this.addBlock(side, displayTerm);
        let newBlock = side.at(side.length - 1);

        if (newBlock) {
          this.view.add(newBlock);
        }

        continue;
      }

      this.updateBlock(currentBlock, displayTerm);
    }
  }

  // Blocks sit side by side, each as wide as its text.
  private layoutEquation() {
    const blocks = [...this.leftSide, this.equalSign, ...this.rightSide]
    const gap = this.equationCenter ? 6 : 0
    const equationWidth = blocks.reduce((sum, block) => sum + block.width(), 0) + gap * (blocks.length - 1)
    const centerX = this.equationCenter?.x ?? this.panelWidth / 2
    const centerY = this.equationCenter?.y ?? this.panelHeight * 0.25
    const y = centerY - this.blockSize / 2

    let x = centerX - equationWidth / 2
    for (const block of blocks) {
      block.position({ x, y })
      x += block.width() + gap
    }
  }

  private centerDropzone() {
    const center = this.dropZoneCenter ?? { x: this.panelWidth / 2, y: this.panelHeight / 2 }
    this.dropZone.position({
      x: center.x - this.DROP_ZONE_SIZE / 2,
      y: center.y - this.DROP_ZONE_SIZE / 2,
    })
  }

  /**
   * Creates the solver view and adds it to the layer.
   * @param stage Konva stage containing the layer.
   * @param layer Layer receiving the view elements.
   * @param options Panel and block layout options.
   */
  constructor(stage: Konva.Stage, layer: Konva.Layer, options: MultistepSolverViewOptions) {
    if (!Number.isFinite(options.panelWidth) || options.panelWidth <= 0) {
      throw Error('MultistepSolverView panelWidth must be a positive number.')
    }
    if (!Number.isFinite(options.panelHeight) || options.panelHeight <= 0) {
      throw Error('MultistepSolverView panelHeight must be a positive number.')
    }

    this.panelWidth = options.panelWidth
    this.panelHeight = options.panelHeight
    this.blockSize = options.blockSize ?? 32
    if (!Number.isFinite(this.blockSize) || this.blockSize <= 0) {
      throw Error('MultistepSolverView blockSize must be a positive number.')
    }

    this.theme = { ...DEFAULT_THEME, ...options.theme }
    this.equationCenter = options.equationCenter
    this.dropZoneCenter = options.dropZone
    this.DROP_ZONE_SIZE = options.dropZone?.size ?? 100
    if (!Number.isFinite(this.DROP_ZONE_SIZE) || this.DROP_ZONE_SIZE <= 0) {
      throw Error('MultistepSolverView dropZone size must be a positive number.')
    }

    this.view = new Konva.Group({});

    this.stage = stage;
    this.layer = layer;

    this.layer.add(this.view);

    this.panel = new Konva.Rect({
      width: this.panelWidth,
      height: this.panelHeight,
      fill: options.panelColor ?? '#4b5563',
      cornerRadius: 20,
      // Only a backdrop: never take clicks from controls drawn under the view.
      listening: false,
    });
    this.view.add(this.panel);

    this.dropZone = new Konva.Group({
      width: this.DROP_ZONE_SIZE,
      height: this.DROP_ZONE_SIZE,
    });
    this.dropZoneText = new Konva.Text({
      width: this.DROP_ZONE_SIZE,
      height: this.DROP_ZONE_SIZE,
      text: this.theme.dropZoneLabel,
      align: "center",
      verticalAlign: "middle",
      fontSize: this.theme.dropZoneFontSize,
      fontFamily: this.theme.fontFamily,
      fontStyle: this.theme.fontStyle,
      fill: this.theme.dropZoneLabelColor,
      padding: 8,
      listening: false,
    });

    this.dropZone.add(
      new Konva.Rect({
        width: this.DROP_ZONE_SIZE,
        height: this.DROP_ZONE_SIZE,
        fill: this.theme.dropZoneFill,
        stroke: this.theme.dropZoneStroke,
        strokeWidth: this.theme.dropZoneStroke ? 3 : 0,
        dash: this.theme.dropZoneStroke ? [10, 6] : undefined,
        cornerRadius: 20,
      }),
      this.dropZoneText,
    );
    this.dropZone.visible(false);
    this.view.add(this.dropZone);

    this.equalSign = this.createBlock(0, 0, "=", 'equals');
    this.equalSign.visible(false);
    this.view.add(this.equalSign);

    this.centerDropzone();
  }

  /** Positions the panel centered at the given coordinates. @param x Center x. @param y Center y. */
  setPosition(x: number, y: number): void {
    this.view.position({
      x: x - this.panelWidth / 2,
      y: y - this.panelHeight / 2,
    });
  }

  /** Changes the panel background color. @param color New fill color. */
  panelColor(color: string): void {
    this.panel.fill(color);
  }

  /** Synchronizes displayed blocks with the model. @param model Current equation model. */
  update(model: MultistepSolverModel): void {
    let leftSide = model.getLeftSide();
    let rightSide = model.getRightSide();

    if (leftSide.length == 0 || rightSide.length == 0) {
      console.warn("Attempting to update multistep solver view with empty equation.");
      return;
    }

    this.updateSide(this.leftSide, model.getDisplaySide(true));
    this.updateSide(this.rightSide, model.getDisplaySide(false));

    this.layoutEquation();

    this.equalSign.visible(true);
  }

  /** Shows and enables the drop zone. */
  showDropzone(): void {
    this.centerDropzone();
    this.dropZone.visible(true);
    this.dropZone.listening(true);
  }

  /** Hides and disables the drop zone. */
  hideDropzone(): void {
    this.dropZone.visible(false);
    this.dropZone.listening(false);
  }

  /** Removes every node the view added to the layer. */
  destroy(): void {
    this.clearDropzone();
    this.view.destroy();
  }

  /** Removes a dropped clone and restores the drop-zone message. */
  clearDropzone(): void {
    if (this.blockInDrop) {
      this.blockInDrop.destroy();
      this.blockInDrop = null;
    }
    this.dropZoneText.visible(true);
  }
}

export default MultistepSolverView;
