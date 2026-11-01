
import Konva from 'konva'

type Operator = '+' | '-' | '*' | '/'

/**
 * A four-way operator picker.
 *
 * The menu is a Konva group, so it can be added directly to a layer:
 *
 *   const menu = new ActionMenu(100, 100)
 *   layer.add(menu)
 */
class ActionMenu extends Konva.Group {
  public onAdditionClicked?: () => void
  public onSubtractionClicked?: () => void
  public onMultiplicationClicked?: () => void
  public onDivisionClicked?: () => void

  private quadrantBackgrounds: Konva.Rect[] = []

  private static readonly BACKGROUND_COLOR = '#eeeeee'
  private static readonly HOVER_COLOR = '#c7d2fe'
  private static readonly LABEL_COLOR = '#000000'

  constructor(width: number, height: number) {
    if (!Number.isFinite(width) || width <= 0) {
      throw Error('ActionMenu width must be a positive number.')
    }
    if (!Number.isFinite(height) || height <= 0) {
      throw Error('ActionMenu height must be a positive number.')
    }

    super({
      width,
      height,
      visible: false,
      listening: false,
    })

    const quadrantWidth = width / 2
    const quadrantHeight = height / 2
    // This is intentionally calculated once. The menu's labels do not resize
    // if the group is later scaled or its dimensions are changed.
    const fontSize = Math.max(1, Math.floor(Math.min(quadrantWidth, quadrantHeight) * 0.6))

    const quadrants: Array<{ operator: Operator, x: number, y: number }> = [
      { operator: '+', x: 0, y: 0 },
      { operator: '-', x: quadrantWidth, y: 0 },
      { operator: '*', x: 0, y: quadrantHeight },
      { operator: '/', x: quadrantWidth, y: quadrantHeight },
    ]

    for (const quadrant of quadrants) {
      const area = new Konva.Group({
        x: quadrant.x,
        y: quadrant.y,
        width: quadrantWidth,
        height: quadrantHeight,
        name: `operator-${quadrant.operator}`,
      })

      const background = new Konva.Rect({
        width: quadrantWidth,
        height: quadrantHeight,
        fill: ActionMenu.BACKGROUND_COLOR,
        stroke: '#9ca3af',
        strokeWidth: 1,
      })

      const label = new Konva.Text({
        width: quadrantWidth,
        height: quadrantHeight,
        text: quadrant.operator,
        align: 'center',
        verticalAlign: 'middle',
        fontSize,
        fill: ActionMenu.LABEL_COLOR,
        listening: false,
      })

      area.add(background)
      area.add(label)
      this.quadrantBackgrounds.push(background)

      area.on('mouseenter', () => background.fill(ActionMenu.HOVER_COLOR))
      area.on('mouseleave', () => background.fill(ActionMenu.BACKGROUND_COLOR))
      area.on('click tap', () => this.invoke(quadrant.operator))

      this.add(area)
    }
  }

  /** Show the menu with its center at (x, y). */
  public show(x: number, y: number): this
  public show(): this
  public show(x?: number, y?: number): this {
    if (x !== undefined && y !== undefined) {
      this.position({
        x: x - this.width() / 2,
        y: y - this.height() / 2,
      })
    }
    this.visible(true)
    this.listening(true)
    return this
  }

  /** Hide the menu and stop it from receiving pointer events. */
  public hide(): this {
    for (const background of this.quadrantBackgrounds) {
      background.fill(ActionMenu.BACKGROUND_COLOR)
    }
    this.visible(false)
    this.listening(false)
    return this
  }

  private invoke(operator: Operator): void {
    switch (operator) {
      case '+':
        this.onAdditionClicked?.()
        break
      case '-':
        this.onSubtractionClicked?.()
        break
      case '*':
        this.onMultiplicationClicked?.()
        break
      case '/':
        this.onDivisionClicked?.()
        break
    }
  }
}

export default ActionMenu
