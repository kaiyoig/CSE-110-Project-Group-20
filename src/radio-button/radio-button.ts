import Konva from 'konva';

class RadioButton extends Konva.Group {
  private readonly innerCircle: Konva.Circle;
  private readonly clickedFillColor: string;
  private readonly unclickedFillColor: string;

  public onClick?: () => void;

  /** Creates a selectable circular control with selected/unselected fills. */
  public constructor(
    size: number,
    clickedFillColor: string,
    unclickedFillColor: string,
    strokeColor: string,
  ) {
    super({ width: size, height: size });
    this.clickedFillColor = clickedFillColor;
    this.unclickedFillColor = unclickedFillColor;
    this.add(new Konva.Circle({
      x: size / 2,
      y: size / 2,
      radius: size / 2,
      stroke: strokeColor,
      strokeWidth: 2,
      fill: unclickedFillColor,
    }));
    this.innerCircle = new Konva.Circle({
      x: size / 2,
      y: size / 2,
      radius: size / 4,
      fill: unclickedFillColor,
      listening: false,
    });
    this.add(this.innerCircle);
    this.on('click tap', () => {
      if (!this.listening() || this.isClicked()) return;
      this.click();
      this.onClick?.();
    });
  }

  /** Prevents this button from responding to click events. */
  public disable(): void {
    this.listening(false);
  }

  /** Allows this button to respond to click events again. */
  public enable(): void {
    this.listening(true);
  }

  /** Fills the inner circle to mark the button selected. */
  public click(): void {
    this.innerCircle.fill(this.clickedFillColor);
  }

  /** Removes the selection fill from the button. */
  public clear(): void {
    this.innerCircle.fill(this.unclickedFillColor);
  }

  /** Reports whether the button is currently selected. */
  public isClicked(): boolean {
    return this.innerCircle.fill() === this.clickedFillColor;
  }
}

export default RadioButton;
