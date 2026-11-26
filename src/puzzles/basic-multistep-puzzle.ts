import Konva from 'konva'

import MultistepConsole, { CONSOLE } from '../multistep-solver/multistep-console'
import MultistepSolverController, { type MultistepSolverState } from '../multistep-solver/multistep-solver-controller'
import MultistepSolverModel from '../multistep-solver/multistep-solver-model'
import MultistepSolverView, { type MultistepSolverTheme } from '../multistep-solver/multistep-solver-view'
import OperationButtons from '../multistep-solver/operation-buttons'
import { acceptableArithmeticAnswer } from '../multistep-solver/arithmetic-expression'
import { answerText, display, displayExpression, normalizeKeypadAnswer, keyboardKey } from '../multistep-solver/answer-format'
import { stepsLeft } from '../multistep-solver/step-counter'
import type { TermOp } from '../multistep-solver/types'
import type { StepAnswer } from '../questions/Question'
import KeypadInput from '../text-input/keypad-input'
import type Puzzle from './puzzle'

/**
 * Where to draw the puzzle. The console is always CONSOLE.width ×
 * CONSOLE.height (1240 × 680) in the design space; the whole screen is
 * scaled to the window by `fitLayer`, so it needs no size of its own.
 */
export interface BasicMultistepPuzzleOptions {
  layer: Konva.Layer
  /** Center of the console. */
  x: number
  y: number
  /** Height of the equation's blocks. */
  blockSize?: number
}

/** How long "LOCK OPEN" and the answer stay up before the Room is left. */
export const FINAL_ANSWER_MS = 2500

/** Most characters the keypad accepts, so long entries never overflow its display. */
const MAX_ANSWER_LENGTH = 9

/** The equation's blocks as green LCD tiles, like the Power Box. */
const CONSOLE_THEME: Partial<MultistepSolverTheme> = {
  valueFill: '#0f2a17',
  valueStroke: '#2f7a3e',
  valueText: '#5dff7a',
  variableFill: '#2b2410',
  variableStroke: '#8a6d14',
  variableText: '#ffd447',
  operatorFill: 'rgba(0,0,0,0)',
  operatorText: '#7fc98d',
  equalsFill: 'rgba(0,0,0,0)',
  equalsText: '#f5c400',
  fontFamily: "'Courier New', monospace",
  fontStyle: 'bold',
  operatorSymbols: { '*': '·', '-': '−' },
  dropZoneFill: '#1b1d22',
  dropZoneStroke: '#6b7380',
  dropZoneLabel: 'Drop a term here',
  dropZoneLabelColor: '#9aa3ad',
  dropZoneFontSize: 18,
}

const OPERATION_VERBS: Record<TermOp, string> = {
  '+': 'added',
  '-': 'subtracted',
  '*': 'multiplied',
  '/': 'divided',
}

/**
 * The multistep room: an equation to solve one Step at a time. The player
 * drags a term into the socket and picks how to undo it (an Operation Step),
 * then works out the arithmetic on the keypad (an Arithmetic Step). The
 * keypad has one light per Step of par (the fewest Steps that solve it), lit
 * as Steps are solved; a longer way round shows "+1" instead of adding
 * lights. The strip at the top says what to do now, and the answer stays on
 * screen for a moment at the end.
 */
class BasicMultistepPuzzle implements Puzzle {
  private readonly model = new MultistepSolverModel()
  private readonly console: MultistepConsole
  private readonly view: MultistepSolverView
  private readonly controller: MultistepSolverController
  private readonly operations: OperationButtons
  private readonly keypad: KeypadInput

  private keypadAnswer = ''
  private solvedSteps = 0
  /** The fewest Steps that solve the equation, worked out once at the start. */
  private par = 0
  private interactionEnabled = true
  /** The Answer that solves the Room, held until the player has seen the answer. */
  private finalAnswer: StepAnswer | null = null
  private finalTimer: ReturnType<typeof setTimeout> | null = null
  private readonly onKeyDown = (event: KeyboardEvent): void => this.handleKeyDown(event)

  /** Called when the puzzle reaches its Finished state. */
  public onPuzzleFinished?: (solved: boolean) => void

  /**
   * Called with every Step's Answer (operation picks and arithmetic), after
   * the puzzle has judged it and advanced if it was correct. The Answer that
   * solves the Room comes once its answer has been shown (FINAL_ANSWER_MS, or
   * sooner if the player presses "Back to map").
   */
  public onAnswer?: (answer: StepAnswer) => void

  /**
   * Creates and initializes a puzzle.
   * @param equation Initial equation string.
   * @param options Layer and console center.
   */
  constructor(equation: string, options: BasicMultistepPuzzleOptions) {
    this.validateOptions(options)

    const left = options.x - CONSOLE.width / 2
    const top = options.y - CONSOLE.height / 2

    this.console = new MultistepConsole()
    this.console.position({ x: left, y: top })
    options.layer.add(this.console)

    this.view = new MultistepSolverView(options.layer.getStage()!, options.layer, {
      panelWidth: CONSOLE.width,
      panelHeight: CONSOLE.height,
      blockSize: options.blockSize ?? 52,
      panelColor: 'rgba(0,0,0,0)',
      theme: CONSOLE_THEME,
      equationCenter: { x: CONSOLE.screen.x + CONSOLE.screen.width / 2, y: CONSOLE.screen.y + 56 },
      dropZone: CONSOLE.dropZone,
    })
    this.view.setPosition(options.x, options.y)
    this.controller = new MultistepSolverController(this.model, this.view)

    this.operations = new OperationButtons()
    this.operations.position({ x: left + CONSOLE.operations.x, y: top + CONSOLE.operations.y })
    options.layer.add(this.operations)

    this.keypad = new KeypadInput()
    this.keypad.position({ x: left + CONSOLE.keypad.x, y: top + CONSOLE.keypad.y })
    options.layer.add(this.keypad)

    this.connectComponents()
    this.controller.setEquation(equation)
    this.par = stepsLeft(this.model)
    this.console.setEquationCaption('Goal: get x alone on one side')
    this.showState(this.controller.getState())

    if (typeof window !== 'undefined') window.addEventListener('keydown', this.onKeyDown)
  }

  private validateOptions(options: BasicMultistepPuzzleOptions): void {
    if (!options.layer.getStage()) {
      throw Error('BasicMultistepPuzzle requires a layer attached to a Konva stage.')
    }
    if (!Number.isFinite(options.x) || !Number.isFinite(options.y)) {
      throw Error('BasicMultistepPuzzle needs a finite center (x, y).')
    }
  }

  private connectComponents(): void {
    this.view.onTargetDropped = (index, isLeftSide, isCoefficient) =>
      this.controller.operation(index, isLeftSide, isCoefficient)
    this.view.onNegativeSignDropped = isLeftSide => this.controller.removeNegativeSign(isLeftSide)
    this.operations.onPick = op => this.controller.moveRequest(op)

    this.keypad.onKeyPressed = key => this.pressKey(key)
    this.keypad.onSubmit = () => this.submitKeypad()
    this.console.onContinue = () => this.sendPendingAnswer()

    this.controller.onAnswerSubmit = (_question, playerAnswer, correctAnswer, isLastStep, stepPrompt) => {
      this.keypadAnswer = ''
      this.keypad.setAnswer()
      // Arithmetic Steps have a prompt and are checked like the solver does
      // (7/3, 2.5 and 3x all count when they equal the answer in simplest
      // form); Operation Steps must pick the exact operation.
      const isArithmetic = stepPrompt !== undefined
      const answer: StepAnswer = {
        playerAnswer, correctAnswer, isLastStep, stepPrompt,
        ...(isArithmetic ? { isMultistepArithmetic: true } : {}),
      }
      const accepted = isArithmetic
        ? acceptableArithmeticAnswer(playerAnswer, stepPrompt, correctAnswer)
        : playerAnswer === correctAnswer

      if (!accepted) {
        this.showWrong()
        this.onAnswer?.(answer)
        return
      }

      const wasOperation = this.controller.getState() === 'Operation'
      this.solvedSteps++
      if (isLastStep) this.finalAnswer = answer
      this.controller.step()
      if (this.controller.getState() !== 'Finished') {
        this.console.setEquationCaption(wasOperation
          ? `You ${OPERATION_VERBS[playerAnswer as TermOp] ?? 'changed'} both sides. Keep going!`
          : 'Worked out. Keep going!')
      }
      this.updateProgress()

      if (!isLastStep) this.onAnswer?.(answer)
    }

    this.controller.onArithmeticStep = expression => {
      const shown = displayExpression(expression)
      this.keypad.setPrompt(`${shown} =`)
      // Combining x terms (e.g. -3x - 7x) has an x in its answer; say so.
      const expected = this.model.arithmeticProblems()[0]?.[1] ?? ''
      if (expected.includes('x')) {
        this.console.setInstruction(this.stepTag(), `Combine the x terms: ${shown}`, 'work')
        this.console.setOperationsHint('The answer has an x: type the number, then the x key (like 5x or 3/4x).')
      } else {
        this.console.setInstruction(this.stepTag(), `Work out ${shown} on the keypad`, 'work')
        if (expression.includes('/')) {
          this.console.setOperationsHint('If it doesn\'t divide evenly, type the simplest fraction, like 7/3.')
        }
      }
    }

    this.controller.onStateChange = state => this.showState(state)
  }

  /** Updates the instructions, buttons and keypad for the state the solver is in. */
  private showState(state: MultistepSolverState): void {
    this.updateProgress()
    switch (state) {
      case 'Idle':
        this.operations.setEnabled(false)
        this.keypad.setEnabled(false)
        this.keypad.setPrompt('Waiting for a term…')
        this.console.setInstruction(this.stepTag(), this.onlyMinusSignLeft()
          ? 'Drag the − in front of x into the socket'
          : 'Drag a term across the = sign', 'move')
        this.console.setSlotCaption('Drag any number or\nx term into the socket')
        this.console.setOperationsHint('Pick one after you drop a term. It applies to both sides.')
        break
      case 'Operation':
        this.operations.setEnabled(true)
        this.keypad.setEnabled(false)
        this.console.setInstruction(this.stepTag(), 'What undoes it? Pick an operation', 'move')
        this.console.setSlotCaption('Picked up.\nWhat undoes it?')
        this.console.setOperationsHint('Whatever you pick happens to both sides of the =.')
        break
      case 'Arithmetic':
        this.operations.setEnabled(false)
        this.keypad.setEnabled(true)
        this.console.setSlotCaption('Drop the next term\nafter this step')
        this.console.setOperationsHint('Type the answer on the keypad, then press ENTER.')
        break
      case 'Finished': {
        const answer = answerText(this.model)
        this.operations.setEnabled(false)
        this.operations.visible(false)
        this.keypad.setEnabled(false)
        this.keypad.setPrompt('Answer')
        this.keypad.showResult(answer)
        this.console.setInstruction('SOLVED', `${display(answer)}. The lock is open.`, 'done')
        this.console.setEquationCaption('')
        this.console.showSolved(display(answer), this.solvedSummary())
        if (this.finalAnswer) this.finalTimer = setTimeout(() => this.sendPendingAnswer(), FINAL_ANSWER_MS)
        this.onPuzzleFinished?.(true)
        break
      }
    }
  }

  /** True for `-x = 9` (or `9 = -x`): only the minus sign is left to remove. */
  private onlyMinusSignLeft(): boolean {
    const sides = [this.model.getLeftSide(), this.model.getRightSide()]
    const loneNegativeX = sides.some(side => side.length === 1 &&
      typeof side[0] !== 'string' && !side[0].constant && !side[0].positive)
    const loneNumber = sides.some(side => side.length === 1 &&
      typeof side[0] !== 'string' && side[0].constant)
    return loneNegativeX && loneNumber
  }

  /** "STEP 3 · PAR 4": which Step this is, and the fewest Steps that solve it. */
  private stepTag(): string {
    return `STEP ${this.solvedSteps + 1} · PAR ${this.par}`
  }

  /** "Solved in 4 steps, right on par!" or "Solved in 5 steps (par 4)". */
  private solvedSummary(): string {
    const steps = `Solved in ${plural(this.solvedSteps, 'step')}`
    return this.solvedSteps <= this.par ? `${steps}, right on par!` : `${steps} (par ${this.par})`
  }

  private updateProgress(): void {
    this.keypad.setProgress(this.solvedSteps, this.par)
  }

  private showWrong(): void {
    if (this.controller.getState() === 'Arithmetic') {
      this.keypad.flashWrong()
    } else {
      this.console.setSlotCaption('Not that one.\nWhat undoes it?')
    }
  }

  /**
   * Sends the Answer that solves the Room, once. Called by "Back to map", by
   * the FINAL_ANSWER_MS timer, or by the Room's Exit button so leaving while
   * the answer is shown still counts the solve.
   */
  public sendPendingAnswer(): void {
    if (this.finalTimer !== null) clearTimeout(this.finalTimer)
    this.finalTimer = null
    const answer = this.finalAnswer
    this.finalAnswer = null
    if (answer) this.onAnswer?.(answer)
  }

  /** One keypad key (or the matching keyboard key) during an Arithmetic Step. */
  private pressKey(key: string): void {
    if (this.controller.getState() !== 'Arithmetic') return
    const answer = this.keypadAnswer
    if (key === 'C') {
      this.keypadAnswer = ''
    } else if (key === '⌫') {
      this.keypadAnswer = answer.slice(0, -1)
    } else if (key === '-') {
      this.keypadAnswer = answer.startsWith('-') ? answer.slice(1) : '-' + answer
    } else if (key === '/') {
      if (/\d$/.test(answer) && !answer.includes('/')) this.keypadAnswer += '/'
    } else if (key === 'x') {
      if (!answer.includes('x')) this.keypadAnswer += 'x'
    } else if (/^\d$/.test(key)) {
      this.keypadAnswer += key
    }
    this.keypadAnswer = this.keypadAnswer.slice(0, MAX_ANSWER_LENGTH)
    this.keypad.setAnswer(this.keypadAnswer)
  }

  private submitKeypad(): void {
    if (this.controller.getState() !== 'Arithmetic') return
    const answer = normalizeKeypadAnswer(this.keypadAnswer)
    if (answer === null) {
      if (this.keypadAnswer !== '') this.keypad.flashWrong()
      this.keypadAnswer = ''
      return
    }
    this.controller.arithmetic(answer)
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.interactionEnabled || this.controller.getState() !== 'Arithmetic') return
    const key = keyboardKey(event.key)
    if (key === null) return
    event.preventDefault()
    if (key === 'Enter') this.submitKeypad()
    else this.pressKey(key)
  }

  /** Stops keyboard input while a screen modal (such as a hint) covers the puzzle. */
  public setInteractionEnabled(enabled: boolean): void {
    this.interactionEnabled = enabled
  }

  /** Removes the puzzle from its layer and stops listening to the keyboard. */
  public destroy(): void {
    if (typeof window !== 'undefined') window.removeEventListener('keydown', this.onKeyDown)
    if (this.finalTimer !== null) clearTimeout(this.finalTimer)
    this.finalTimer = null
    this.finalAnswer = null
    this.onAnswer = undefined
    this.onPuzzleFinished = undefined
    this.controller.onAnswerSubmit = undefined
    this.controller.onStateChange = undefined
    this.controller.onArithmeticStep = undefined
    this.view.destroy()
    this.console.destroy()
    this.operations.destroy()
    this.keypad.destroy()
  }
}

/** "1 step", "4 steps". */
function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

export default BasicMultistepPuzzle
