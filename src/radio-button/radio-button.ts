import Konva from 'konva';

class RadioButton extends Konva.Group {
  private readonly innerCircle: Konva.Circle;
  private readonly clickedFillColor: string;
  private readonly unclickedFillColor: string;

  public onClick?: () => void;

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
      if (!this.isListening() || this.isClicked()) return;
      this.click();
      this.onClick?.();
    });
  }

  public disable(): void {
    this.listening(false);
  }

  public enable(): void {
    this.listening(true);
  }

  public click(): void {
    this.innerCircle.fill(this.clickedFillColor);
  }

  public clear(): void {
    this.innerCircle.fill(this.unclickedFillColor);
  }

  public isClicked(): boolean {
    return this.innerCircle.fill() === this.clickedFillColor;
  }
}

export default RadioButton;
