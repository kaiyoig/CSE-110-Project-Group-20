import Konva from 'konva'

import { Term, TermValue } from './types'
import MultistepSolverModel from './multistep-solver-model'

type Block = Konva.Group

const BLOCK_SIZE = 24;

class MultistepSolverView {
  private leftSide: Array<Block> = []
  private rightSide: Array<Block> = []

  private stage: Konva.Stage
  private layer: Konva.Layer
  private view: Konva.Group
  private dropZone: Konva.Rect

  private blockInDrop: Block | null = null

  private equalSign: Konva.Group

  private OPERATOR_BACKGROUND = "#ffde80";
  private VALUE_BACKGROUND = "#4ade80";

  public onTargetDropped?: (index: number, left: boolean) => void

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
    block.on('mousedown.palette touchstart.palette', _ => {
      let mousePosition = this.stage.getPointerPosition();
      if (mousePosition == null) return;

      const clone = block.clone()
      clone.off('.palette');
      clone.setAttr('clone', true);

      clone.on('dragend.workspace touchend.workspace', _ => {
        if (!this.onTargetDropped) {
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
          let index = isLeftSide ? leftIndex : rightIndex;

          this.clearDropzone();

          this.blockInDrop = clone;

          this.onTargetDropped(index, isLeftSide);
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
    block.off(".palette");
  }

  private createBlock(x: number, y: number, text: string, color: string): Konva.Group {
    const group = new Konva.Group({
      x,
      y,
      width: BLOCK_SIZE,
      height: BLOCK_SIZE,
    });

    group.add(
      new Konva.Rect({
        name: "background",
        width: BLOCK_SIZE,
        height: BLOCK_SIZE,
        fill: color,
        cornerRadius: 6,
      })
    );

    group.add(
      new Konva.Text({
        name: "text",
        width: BLOCK_SIZE,
        height: BLOCK_SIZE,
        text: text,
        align: "center",
        verticalAlign: "middle",
        fontSize: 16,
        fill: "black",
      })
    );

    return group;
  }

  private createTermBlock(x: number, y: number, term: Term): Konva.Group {
    let isOperator = typeof term == "string";
    let fillColor = isOperator ? this.OPERATOR_BACKGROUND : this.VALUE_BACKGROUND;

    let text = isOperator ? (term as string) : (term as TermValue).term;

    let group = this.createBlock(x, y, text, fillColor);

    group.setAttr('term', term);

    if (!isOperator) {
      this.makePaletteBlock(group);
    }

    return group;
  }

  // TODO: Change y position
  private addBlock(side: Array<Block>, term: Term) {
    let previousBlock = side.at(side.length - 1);
    if (!previousBlock) {
      side.push(this.createTermBlock(0, 100, term));
      return;
    }
    let x = previousBlock.x();
    let width = previousBlock.width();
    side.push(this.createTermBlock(x + width, 100, term));
  }

  private updateBlock(block: Block, term: Term) {
    let prevTerm: Term = block.getAttr('term');
    if (prevTerm == term) {
      return;
    }

    let wasPalette = typeof prevTerm !== "string";
    let isTermOperator = typeof term === "string";
    block.setAttr('term', term);
    if (wasPalette && isTermOperator) {
      this.removePaletteStatus(block);
    }
    if (!wasPalette && !isTermOperator) {
      this.makePaletteBlock(block);
    }
    let text = block.findOne<Konva.Text>(".text");
    let background = block.findOne<Konva.Rect>(".background");

    if (!text || !background) {
      throw Error("Could not update block because text or background doesn't exist in the group.");
    }

    text.text(isTermOperator ? term as string : (term as TermValue).term);
    background.fill(isTermOperator ? this.OPERATOR_BACKGROUND : this.VALUE_BACKGROUND);
  }

  private updateSide(side: Array<Block>, terms: Array<Term>) {
    if (terms.length < side.length) {
      let extraBlocks = side.splice(terms.length - 1);
      for (let extraBlock of extraBlocks) {
        extraBlock.destroy();
      }
    }

    for (let i = 0; i < terms.length; ++i) {
      let modelTerm = terms.at(i);
      if (!modelTerm)
        throw Error("Multistep Solver Model has undefined term in the middle of the array!");

      let currentBlock = side.at(i);

      if (!currentBlock) {
        this.addBlock(side, modelTerm);
        let newBlock = side.at(side.length - 1);

        if (newBlock) {
          this.view.add(newBlock);
        }

        continue;
      }

      this.updateBlock(currentBlock, modelTerm);
    }
  }

  constructor(stage: Konva.Stage, layer: Konva.Layer) {
    this.view = new Konva.Group({});

    this.stage = stage;
    this.layer = layer;

    this.layer.add(this.view);

    this.dropZone = new Konva.Rect({
      width: 100,
      height: 100,
      fill: "#eeeeee",
      cornerRadius: 20
    });
    this.dropZone.visible(false);
    this.view.add(this.dropZone);

    this.equalSign = this.createBlock(0, 100, "=", "#bbcccc");
    this.equalSign.visible(false);
    this.view.add(this.equalSign);
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

    let xOffset = (this.leftSide.length + 1) * BLOCK_SIZE;
    for (let i = 0; i < this.rightSide.length; ++i) {
      let newX = xOffset + (i * BLOCK_SIZE);
      this.rightSide.at(i)?.x(newX);
    }

    let lastBlock = this.leftSide.at(this.leftSide.length - 1);
    if (!lastBlock) throw Error("Updating equation ended up with empty left side!");

    this.equalSign.x(lastBlock.x() + lastBlock.width());

    this.equalSign.visible(true);

    this.dropZone.x(this.equalSign.x());
    this.dropZone.y(this.equalSign.y() + this.equalSign.height() + 10);
    this.dropZone.visible(true);
  }

  clearDropzone() {
    if (!this.blockInDrop) return;
    this.blockInDrop.destroy();
    this.blockInDrop = null;
  }
}

export default MultistepSolverView;
