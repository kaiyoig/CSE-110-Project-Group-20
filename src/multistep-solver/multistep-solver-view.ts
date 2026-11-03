import Konva from 'konva'

import { Term, TermValue } from './types'
import MultistepSolverModel from './multistep-solver-model'

type Block = Konva.Group

interface DisplayTerm {
  term: Term
  modelIndex: number
  negativeSign?: boolean
}

export interface MultistepSolverViewOptions {
  panelWidth: number
  panelHeight: number
  blockSize?: number
  panelColor?: string
}

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

  private OPERATOR_BACKGROUND = "#ffde80";
  private VALUE_BACKGROUND = "#4ade80";
  private readonly DROP_ZONE_SIZE = 100

  public onTargetDropped?: (index: number, left: boolean) => void
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
            const dropZoneRect = this.dropZone.getClientRect();
            clone.position({
              x: dropZoneRect.x + (dropZoneRect.width - clone.width()) / 2,
              y: dropZoneRect.y + (dropZoneRect.height - clone.height()) / 2,
            });
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
          const dropZoneRect = this.dropZone.getClientRect();
          clone.position({
            x: dropZoneRect.x + (dropZoneRect.width - clone.width()) / 2,
            y: dropZoneRect.y + (dropZoneRect.height - clone.height()) / 2,
          });
          this.dropZoneText.visible(false);

          this.onTargetDropped?.(index, isLeftSide);
        } else {
          clone.destroy();
        }
      });

      this.layer.add(clone);

      clone.position(mousePosition);
      clone.startDrag();
    });
  }

  // If a block is a palette, "un-palette" it.
  private removePaletteStatus(block: Block) {
    block.setAttr('paletteBlock', false);
    block.off(".palette");
  }

  private createBlock(x: number, y: number, text: string, color: string): Konva.Group {
    const group = new Konva.Group({
      x,
      y,
      width: this.blockSize,
      height: this.blockSize,
    });

    group.add(
      new Konva.Rect({
        name: "background",
        width: this.blockSize,
        height: this.blockSize,
        fill: color,
        cornerRadius: 6,
      })
    );

    group.add(
      new Konva.Text({
        name: "text",
        width: this.blockSize,
        height: this.blockSize,
        text: text,
        align: "center",
        verticalAlign: "middle",
        fontSize: Math.floor(this.blockSize * 2 / 3),
        fill: "black",
      })
    );

    return group;
  }

  private createTermBlock(x: number, y: number, displayTerm: DisplayTerm): Konva.Group {
    let term = displayTerm.term;
    let isOperator = typeof term == "string";
    let fillColor = displayTerm.negativeSign
      ? this.VALUE_BACKGROUND
      : isOperator ? this.OPERATOR_BACKGROUND : this.VALUE_BACKGROUND;

    let text = isOperator ? (term as string) : (term as TermValue).term;

    let group = this.createBlock(x, y, text, fillColor);

    group.setAttr('term', term);
    group.setAttr('modelIndex', displayTerm.modelIndex);
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
    block.setAttr('negativeSign', isNegativeSign);

    const shouldBePalette = isNegativeSign || !isOperator;
    const isPalette = block.getAttr('paletteBlock') === true;
    if (shouldBePalette && !isPalette) {
      this.makePaletteBlock(block);
    } else if (!shouldBePalette && isPalette) {
      this.removePaletteStatus(block);
    }

    if (prevTerm == term) {
      let background = block.findOne<Konva.Rect>(".background");
      if (background) {
        background.fill(isNegativeSign
          ? this.VALUE_BACKGROUND
          : isOperator ? this.OPERATOR_BACKGROUND : this.VALUE_BACKGROUND);
      }
      return;
    }

    block.setAttr('term', term);
    let text = block.findOne<Konva.Text>(".text");
    let background = block.findOne<Konva.Rect>(".background");

    if (!text || !background) {
      throw Error("Could not update block because text or background doesn't exist in the group.");
    }

    text.text(isOperator ? term as string : (term as TermValue).term);
    background.fill(isNegativeSign
      ? this.VALUE_BACKGROUND
      : isOperator ? this.OPERATOR_BACKGROUND : this.VALUE_BACKGROUND);
  }

  private getDisplayTerms(terms: Array<Term>): Array<DisplayTerm> {
    let displayTerms: Array<DisplayTerm> = [];
    const hasLeadingMinusOperator = terms[0] === '-';
    const variableIndex = hasLeadingMinusOperator ? 1 : 0;
    const multiplicationIndex = variableIndex + 1;
    const coefficientIndex = variableIndex + 2;
    const canRemoveNegativeSign = terms.length === coefficientIndex + 1 &&
      typeof terms[variableIndex] !== 'string' &&
      terms[variableIndex].constant === false &&
      (hasLeadingMinusOperator || !terms[variableIndex].positive) &&
      terms[multiplicationIndex] === '*' &&
      typeof terms[coefficientIndex] !== 'string' &&
      terms[coefficientIndex].constant === true;

    for (let i = 0; i < terms.length; ++i) {
      let term = terms.at(i);
      if (!term) continue;

      const isZero = typeof term !== 'string' && term.constant && term.term.split('/')[0] === '0';
      if (i === 0 && hasLeadingMinusOperator && canRemoveNegativeSign) {
        displayTerms.push({
          term: '-',
          modelIndex: variableIndex,
          negativeSign: true,
        });
        continue;
      }
      if (i === 0 && hasLeadingMinusOperator) {
        displayTerms.push({ term, modelIndex: i });
        continue;
      }
      if (i === 0 && typeof term !== 'string' && !term.positive && !isZero) {
        displayTerms.push({
          term: '-',
          modelIndex: i,
          negativeSign: canRemoveNegativeSign,
        });
      }
      if (i > 0 && typeof term !== 'string' && typeof terms[i - 1] !== 'string') {
        displayTerms.push({
          term: term.positive ? '+' : '-',
          modelIndex: i,
        });
      }
      displayTerms.push({ term, modelIndex: i });
    }

    return displayTerms;
  }

  private updateSide(side: Array<Block>, terms: Array<Term>) {
    let displayTerms = this.getDisplayTerms(terms);

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

  private layoutEquation() {
    const equationBlockCount = this.leftSide.length + 1 + this.rightSide.length
    const equationWidth = equationBlockCount * this.blockSize
    const xStart = (this.panelWidth - equationWidth) / 2
    const y = this.panelHeight * 0.25 - this.blockSize / 2

    for (let i = 0; i < this.leftSide.length; ++i) {
      this.leftSide[i].position({
        x: xStart + i * this.blockSize,
        y,
      })
    }

    this.equalSign.position({
      x: xStart + this.leftSide.length * this.blockSize,
      y,
    })

    for (let i = 0; i < this.rightSide.length; ++i) {
      this.rightSide[i].position({
        x: xStart + (this.leftSide.length + 1 + i) * this.blockSize,
        y,
      })
    }
  }

  private centerDropzone() {
    this.dropZone.position({
      x: (this.panelWidth - this.DROP_ZONE_SIZE) / 2,
      y: (this.panelHeight - this.DROP_ZONE_SIZE) / 2,
    })
  }

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

    this.view = new Konva.Group({});

    this.stage = stage;
    this.layer = layer;

    this.layer.add(this.view);

    this.panel = new Konva.Rect({
      width: this.panelWidth,
      height: this.panelHeight,
      fill: options.panelColor ?? '#4b5563',
      cornerRadius: 20,
    });
    this.view.add(this.panel);

    this.dropZone = new Konva.Group({
      width: this.DROP_ZONE_SIZE,
      height: this.DROP_ZONE_SIZE,
    });
    this.dropZoneText = new Konva.Text({
      width: this.DROP_ZONE_SIZE,
      height: this.DROP_ZONE_SIZE,
      text: "Drag term here",
      align: "center",
      verticalAlign: "middle",
      fontSize: 14,
      fill: "#4b5563",
      listening: false,
    });

    this.dropZone.add(
      new Konva.Rect({
        width: this.DROP_ZONE_SIZE,
        height: this.DROP_ZONE_SIZE,
        fill: "#eeeeee",
        cornerRadius: 20,
      }),
      this.dropZoneText,
    );
    this.dropZone.visible(false);
    this.view.add(this.dropZone);

    this.equalSign = this.createBlock(0, 0, "=", "#bbcccc");
    this.equalSign.visible(false);
    this.view.add(this.equalSign);

    this.centerDropzone();
  }

  setPosition(x: number, y: number) {
    this.view.position({
      x: x - this.panelWidth / 2,
      y: y - this.panelHeight / 2,
    });
  }

  panelColor(color: string) {
    this.panel.fill(color);
  }

  update(model: MultistepSolverModel) {
    let leftSide = model.getLeftSide();
    let rightSide = model.getRightSide();

    if (leftSide.length == 0 || rightSide.length == 0) {
      console.warn("Attempting to update multistep solver view with empty equation.");
      return;
    }

    this.updateSide(this.leftSide, leftSide);
    this.updateSide(this.rightSide, rightSide);

    this.layoutEquation();

    this.equalSign.visible(true);
  }

  showDropzone() {
    this.centerDropzone();
    this.dropZone.visible(true);
    this.dropZone.listening(true);
  }

  hideDropzone() {
    this.dropZone.visible(false);
    this.dropZone.listening(false);
  }

  clearDropzone() {
    if (this.blockInDrop) {
      this.blockInDrop.destroy();
      this.blockInDrop = null;
    }
    this.dropZoneText.visible(true);
  }
}

export default MultistepSolverView;
