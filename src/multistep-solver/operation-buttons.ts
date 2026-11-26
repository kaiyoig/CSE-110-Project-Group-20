import Konva from 'konva'

import { INDUSTRIAL } from '../screens/industrial-theme'
import { setCursor } from '../screens/theme'
import type { TermOp } from './types'

/** Size of the 2 × 2 block of buttons, from its top-left corner. */
export const OPERATION_BUTTONS_WIDTH = 510
export const OPERATION_BUTTONS_HEIGHT = 162

const BUTTON_HEIGHT = 72
const GAP = 18
const BUTTON_WIDTH = (OPERATION_BUTTONS_WIDTH - GAP) / 2

/** The four choices, in reading order, with the words a player knows. */
export const OPERATIONS: ReadonlyArray<{ op: TermOp, symbol: string, word: string }> = [
  { op: '+', symbol: '+', word: 'ADD' },
  { op: '-', symbol: '−', word: 'SUBTRACT' },
  { op: '*', symbol: '×', word: 'MULTIPLY' },
  { op: '/', symbol: '÷', word: 'DIVIDE' },
]

const STYLE = {
  ...INDUSTRIAL,
  badge: INDUSTRIAL.edge,
  badgeText: '#ffd447',
} as const

/**
 * Four labelled buttons (ADD, SUBTRACT, MULTIPLY, DIVIDE) for picking how to
 * undo a term on both sides. Replaces the small unlabelled operator menu.
 */
class OperationButtons extends Konva.Group {
  /** Called with the picked operation while the buttons are enabled. */
  public onPick?: (op: TermOp) => void

  private readonly buttons: Konva.Group[] = []
  private enabled = false

  constructor() {
    super({ name: 'operation-buttons' })
    OPERATIONS.forEach((operation, index) => this.addButton(operation, index))
    this.setEnabled(false)
  }

  /** On: full color and clickable. Off: dimmed and ignores clicks. */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled
    for (const button of this.buttons) {
      button.opacity(enabled ? 1 : 0.4)
      button.listening(enabled)
      this.paint(button, false)
    }
    this.getLayer()?.batchDraw()
  }

  public isEnabled(): boolean {
    return this.enabled
  }

  private addButton(operation: { op: TermOp, symbol: string, word: string }, index: number): void {
    const x = (index % 2) * (BUTTON_WIDTH + GAP)
    const y = Math.floor(index / 2) * (BUTTON_HEIGHT + GAP)
    const button = new Konva.Group({ x, y, name: `operation operation-${operation.op}` })

    button.add(new Konva.Rect({
      y: 6, width: BUTTON_WIDTH, height: BUTTON_HEIGHT, cornerRadius: 14,
      fill: STYLE.edge, listening: false,
    }))
    const top = new Konva.Group({ name: 'operation-top' })
    top.add(new Konva.Rect({
      width: BUTTON_WIDTH, height: BUTTON_HEIGHT, cornerRadius: 14,
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: BUTTON_HEIGHT },
      fillLinearGradientColorStops: [...STYLE.keyFace],
      stroke: STYLE.edge, strokeWidth: 3, name: 'operation-face',
    }))
    top.add(new Konva.Circle({
      x: 40, y: BUTTON_HEIGHT / 2, radius: 22, fill: STYLE.badge, listening: false,
    }))
    top.add(new Konva.Text({
      x: 18, width: 44, height: BUTTON_HEIGHT, align: 'center', verticalAlign: 'middle',
      text: operation.symbol, fontFamily: STYLE.title, fontStyle: 'bold', fontSize: 30,
      fill: STYLE.badgeText, listening: false,
    }))
    top.add(new Konva.Text({
      x: 76, width: BUTTON_WIDTH - 90, height: BUTTON_HEIGHT, verticalAlign: 'middle',
      text: operation.word, fontFamily: STYLE.title, fontStyle: 'bold', fontSize: 24,
      letterSpacing: 1, fill: STYLE.keyText, listening: false,
    }))
    button.add(top)

    button.on('mouseenter', () => {
      this.paint(button, true)
      setCursor(button, 'pointer')
    })
    button.on('mouseleave', () => {
      this.paint(button, false)
      setCursor(button, '')
      top.y(0)
    })
    button.on('mousedown touchstart', () => { top.y(3); this.getLayer()?.batchDraw() })
    button.on('mouseup touchend', () => { top.y(0); this.getLayer()?.batchDraw() })
    button.on('click tap', () => {
      if (this.enabled) this.onPick?.(operation.op)
    })

    this.buttons.push(button)
    this.add(button)
  }

  private paint(button: Konva.Group, hover: boolean): void {
    const face = button.findOne<Konva.Rect>('.operation-face')
    face?.setAttr('fillLinearGradientColorStops', [...(hover ? STYLE.keyHighlight : STYLE.keyFace)])
    this.getLayer()?.batchDraw()
  }
}

export default OperationButtons
