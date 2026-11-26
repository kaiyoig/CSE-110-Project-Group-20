import Konva from 'konva'

import { INDUSTRIAL } from '../screens/industrial-theme'
import { setCursor } from '../screens/theme'
import { KEYPAD_HEIGHT, KEYPAD_WIDTH } from '../text-input/keypad-input'
import { OPERATION_BUTTONS_HEIGHT, OPERATION_BUTTONS_WIDTH } from './operation-buttons'

/**
 * Where everything sits on the multistep console, from its top-left corner.
 * The console is drawn for this size; BasicMultistepPuzzle places the
 * equation, operation buttons and keypad inside it.
 */
export const CONSOLE = {
  width: 1240,
  height: 680,
  band: 64,
  strip: { x: 40, y: 82, width: 1160, height: 56 },
  screen: { x: 40, y: 178, width: 760, height: 140 },
  slot: { x: 40, y: 364, width: 220, height: 230 },
  dropZone: { x: 150, y: 440, size: 130 },
  operations: { x: 290, y: 364 },
  keypad: { x: 836, y: 154 },
} as const

export type InstructionTone = 'move' | 'work' | 'done'

/** The dark plate holding "EQUATION LOCK" in the hazard band. */
const TITLE_PLATE_WIDTH = 452

/** The shared industrial look, plus the instruction strip's colors per tone. */
const STYLE = {
  ...INDUSTRIAL,
  tone: {
    move: { tag: INDUSTRIAL.hazard, text: '#ffd447' },
    work: { tag: INDUSTRIAL.ledOn, text: INDUSTRIAL.lcdText },
    done: { tag: INDUSTRIAL.ledOn, text: INDUSTRIAL.lcdText },
  },
} as const

/**
 * The look of the multistep room, matching the Power Box: a steel console with
 * a hazard band, an instruction strip that says what to do now, a green LCD
 * screen for the equation, a socket to drop a term into, and a "LOCK OPEN"
 * panel with the answer when the equation is solved.
 */
class MultistepConsole extends Konva.Group {
  /** Called when the player presses "Back to map" on the solved panel. */
  public onContinue?: () => void

  private readonly stepTag: Konva.Text
  private readonly stepTagBox: Konva.Rect
  private readonly stepMessage: Konva.Text
  private readonly equationCaption: Konva.Text
  private readonly slotCaption: Konva.Text
  private readonly operationsHint: Konva.Text
  private readonly operationsLabel: Konva.Text
  private readonly slotLabel: Konva.Text
  private readonly solvedPanel = new Konva.Group({ visible: false, name: 'solved-panel' })
  private readonly solvedAnswer: Konva.Text
  private readonly solvedDetail: Konva.Text

  constructor() {
    super({ name: 'multistep-console' })
    const { width, height } = CONSOLE

    // Body: shadow, brushed steel, hazard band and rivets.
    this.add(new Konva.Rect({
      x: 8, y: 14, width, height, cornerRadius: 12, fill: '#000000', opacity: 0.35, listening: false,
    }))
    this.add(new Konva.Rect({
      width, height, cornerRadius: 12,
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: width, y: height },
      fillLinearGradientColorStops: [...STYLE.steel],
      stroke: STYLE.edge, strokeWidth: 4, listening: false,
    }))
    this.add(hazardBand(width, CONSOLE.band))
    const plate = { x: (width - TITLE_PLATE_WIDTH) / 2, y: 8, width: TITLE_PLATE_WIDTH, height: 48 }
    this.add(new Konva.Rect({ ...plate, cornerRadius: 8, fill: STYLE.ink, listening: false }))
    this.add(new Konva.Text({
      ...plate, align: 'center', verticalAlign: 'middle',
      text: '⚡ EQUATION LOCK ⚡', fontFamily: STYLE.title, fontStyle: 'bold', fontSize: 26,
      letterSpacing: 2, fill: STYLE.hazard, listening: false,
    }))
    for (const [x, y] of [[20, 84], [width - 20, 84], [20, height - 20], [width - 20, height - 20]]) {
      this.add(new Konva.Circle({ x, y, radius: 9, fill: STYLE.rivet, stroke: '#3a3f47', strokeWidth: 2, listening: false }))
    }

    // Instruction strip.
    const strip = CONSOLE.strip
    this.add(new Konva.Rect({
      ...strip, fill: STYLE.display, stroke: STYLE.displayEdge, strokeWidth: 3, cornerRadius: 10, listening: false,
    }))
    this.stepTagBox = new Konva.Rect({
      x: strip.x + 18, y: strip.y + 13, height: 30, cornerRadius: 6, listening: false,
    })
    this.stepTag = new Konva.Text({
      x: strip.x + 18, y: strip.y + 13, height: 30, padding: 0, align: 'center', verticalAlign: 'middle',
      fontFamily: STYLE.mono, fontStyle: 'bold', fontSize: 22, fill: STYLE.display,
      listening: false, name: 'step-tag',
    })
    this.stepMessage = new Konva.Text({
      y: strip.y, height: strip.height, width: strip.width - 220, verticalAlign: 'middle',
      fontFamily: STYLE.mono, fontStyle: 'bold', fontSize: 26, wrap: 'none', ellipsis: true,
      listening: false, name: 'step-message',
    })
    this.add(this.stepTagBox, this.stepTag, this.stepMessage)

    // Equation screen (the equation's tiles are drawn by the solver view on top).
    const screen = CONSOLE.screen
    this.add(label('EQUATION', screen.x + 4, screen.y - 24))
    this.add(new Konva.Rect({
      ...screen, fill: STYLE.lcd, stroke: STYLE.lcdEdge, strokeWidth: 5, cornerRadius: 10, listening: false,
    }))
    this.equationCaption = new Konva.Text({
      x: screen.x, y: screen.y + screen.height - 32, width: screen.width, align: 'center',
      fontFamily: STYLE.mono, fontStyle: 'bold', fontSize: 17, fill: STYLE.lcdDim,
      listening: false, name: 'equation-caption',
    })
    this.add(this.equationCaption)

    // Socket for the dragged term (the solver view draws its drop zone in it).
    const slot = CONSOLE.slot
    this.slotLabel = label('MOVE A TERM', slot.x + 4, slot.y - 24)
    this.add(this.slotLabel)
    this.add(new Konva.Rect({
      ...slot, fill: STYLE.housing, stroke: STYLE.housingEdge, strokeWidth: 4, cornerRadius: 14, listening: false,
    }))
    this.slotCaption = new Konva.Text({
      x: slot.x + 12, y: CONSOLE.dropZone.y + CONSOLE.dropZone.size / 2 + 12,
      width: slot.width - 24, align: 'center', lineHeight: 1.3,
      fontFamily: STYLE.title, fontStyle: '600', fontSize: 16, fill: STYLE.housingText,
      listening: false, name: 'slot-caption',
    })
    this.add(this.slotCaption)

    // Operation buttons go here; this is their heading and the line under them.
    const ops = CONSOLE.operations
    this.operationsLabel = label('UNDO IT ON BOTH SIDES', ops.x + 4, ops.y - 24)
    this.add(this.operationsLabel)
    this.operationsHint = new Konva.Text({
      x: ops.x, y: ops.y + OPERATION_BUTTONS_HEIGHT + 22, width: OPERATION_BUTTONS_WIDTH, lineHeight: 1.35,
      fontFamily: STYLE.title, fontStyle: '600', fontSize: 17, fill: STYLE.label,
      listening: false, name: 'operations-hint',
    })
    this.add(this.operationsHint)

    // Under the keypad.
    this.add(new Konva.Text({
      x: CONSOLE.keypad.x, y: CONSOLE.keypad.y + KEYPAD_HEIGHT + 10, width: KEYPAD_WIDTH, align: 'center',
      text: 'Keyboard works too: type the answer, then Enter.',
      fontFamily: STYLE.title, fontStyle: '600', fontSize: 15, fill: STYLE.label, listening: false,
    }))

    // Shown over the socket and buttons once the equation is solved.
    const solvedArea = { x: slot.x, y: slot.y, width: screen.width, height: slot.height }
    this.solvedPanel.add(new Konva.Rect({
      ...solvedArea, fill: STYLE.display, stroke: STYLE.displayEdge, strokeWidth: 4, cornerRadius: 14,
    }))
    this.solvedPanel.add(new Konva.Text({
      x: solvedArea.x, y: solvedArea.y + 26, width: solvedArea.width, align: 'center',
      text: 'LOCK OPEN', fontFamily: STYLE.mono, fontStyle: 'bold', fontSize: 46, letterSpacing: 6,
      fill: STYLE.ledOn, shadowColor: STYLE.ledOn, shadowBlur: 16, shadowOpacity: 0.8, listening: false,
    }))
    this.solvedAnswer = new Konva.Text({
      x: solvedArea.x, y: solvedArea.y + 84, width: solvedArea.width, align: 'center',
      fontFamily: STYLE.mono, fontStyle: 'bold', fontSize: 30, fill: '#ffffff',
      listening: false, name: 'solved-answer',
    })
    this.solvedDetail = new Konva.Text({
      x: solvedArea.x, y: solvedArea.y + 124, width: solvedArea.width, align: 'center',
      fontFamily: STYLE.title, fontStyle: '600', fontSize: 18, fill: STYLE.housingText, listening: false,
    })
    this.solvedPanel.add(this.solvedAnswer, this.solvedDetail)
    this.solvedPanel.add(continueButton(solvedArea.x + solvedArea.width / 2 - 150, solvedArea.y + 158, () => this.onContinue?.()))
    this.add(this.solvedPanel)
  }

  /** The strip at the top: a tag such as "STEP 2 OF 4" and what to do now. */
  public setInstruction(tag: string, message: string, tone: InstructionTone): void {
    const colors = STYLE.tone[tone]
    const tagWidth = Math.max(60, tag.length * 13.2 + 24)
    this.stepTag.text(tag)
    this.stepTag.width(tagWidth)
    this.stepTagBox.width(tagWidth)
    this.stepTagBox.fill(colors.tag)
    this.stepMessage.x(CONSOLE.strip.x + 18 + tagWidth + 18)
    this.stepMessage.width(CONSOLE.strip.width - tagWidth - 54)
    this.stepMessage.text(message)
    this.stepMessage.fill(colors.text)
    this.getLayer()?.batchDraw()
  }

  public setEquationCaption(text: string): void {
    this.equationCaption.text(text)
    this.getLayer()?.batchDraw()
  }

  public setSlotCaption(text: string): void {
    this.slotCaption.text(text)
    this.getLayer()?.batchDraw()
  }

  public setOperationsHint(text: string): void {
    this.operationsHint.text(text)
    this.getLayer()?.batchDraw()
  }

  /** Covers the socket and buttons with "LOCK OPEN", the answer and "Back to map". */
  public showSolved(answer: string, detail: string): void {
    this.solvedAnswer.text(answer)
    this.solvedDetail.text(detail)
    this.operationsLabel.visible(false)
    this.slotLabel.visible(false)
    this.operationsHint.visible(false)
    this.solvedPanel.visible(true)
    this.solvedPanel.moveToTop()
    this.getLayer()?.batchDraw()
  }
}

function label(text: string, x: number, y: number): Konva.Text {
  return new Konva.Text({
    x, y, text, fontFamily: STYLE.title, fontStyle: '600', fontSize: 16, letterSpacing: 2,
    fill: STYLE.label, listening: false,
  })
}

/** Yellow and black stripes across the top, like the Power Box. */
function hazardBand(width: number, height: number): Konva.Group {
  const band = new Konva.Group({ clipX: 0, clipY: 0, clipWidth: width, clipHeight: height, listening: false })
  band.add(new Konva.Rect({ width, height, fill: STYLE.hazard }))
  for (let x = -height; x < width + height; x += 76) {
    band.add(new Konva.Line({
      points: [x, height, x + height, 0, x + height + 38, 0, x + 38, height],
      closed: true, fill: STYLE.ink,
    }))
  }
  return band
}

function continueButton(x: number, y: number, onClick: () => void): Konva.Group {
  const button = new Konva.Group({ x, y, name: 'back-to-map' })
  button.add(new Konva.Rect({ y: 5, width: 300, height: 56, cornerRadius: 28, fill: '#342657' }))
  button.add(new Konva.Rect({ width: 300, height: 56, cornerRadius: 28, fill: '#81ff38', stroke: '#342657', strokeWidth: 3 }))
  button.add(new Konva.Text({
    width: 300, height: 56, align: 'center', verticalAlign: 'middle', text: 'Back to map',
    fontFamily: STYLE.title, fontStyle: 'bold', fontSize: 26, fill: '#342657', listening: false,
  }))
  button.on('mouseenter', () => setCursor(button, 'pointer'))
  button.on('mouseleave', () => setCursor(button, ''))
  button.on('click tap', onClick)
  return button
}

export default MultistepConsole
