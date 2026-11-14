import Konva from 'konva'

import ActionMenu from '../multistep-solver/action-menu'
import MultistepSolverController from '../multistep-solver/multistep-solver-controller'
import MultistepSolverModel from '../multistep-solver/multistep-solver-model'
import MultistepSolverView from '../multistep-solver/multistep-solver-view'
import { TermOp } from '../multistep-solver/types'
import type { StepAnswer } from '../questions/Question'
import TextInput from '../text-input/text-input'
import KeypadInput from '../text-input/keypad-input'

export type PuzzleInputType = "typed" | "keypad";

export interface BasicMultistepPuzzleOptions {
  layer: Konva.Layer
  x: number
  y: number
  width: number
  height: number
  spacing: number
  blockSize?: number
  panelColor?: string
  actionMenuWidth?: number
  actionMenuHeight?: number
  inputWidth?: number
  inputHeight?: number
  inputType?: PuzzleInputType
}

/** Self-contained composition of the multistep solver and its input controls. */
class BasicMultistepPuzzle {
  private static readonly DROP_ZONE_SIZE = 100

  private readonly options: BasicMultistepPuzzleOptions
  private readonly view: MultistepSolverView
  private readonly controller: MultistepSolverController
  private readonly actionMenu: ActionMenu
  private readonly input: TextInput
  private readonly keypad: KeypadInput
  private keypadAnswer = ''

  /** Called when the puzzle reaches its Finished state. */
  public onPuzzleFinished?: (solved: boolean) => void

  /**
   * Called with every Step's Answer (operation picks and arithmetic), after
   * the puzzle has judged it and advanced if it was correct.
   */
  public onAnswer?: (answer: StepAnswer) => void

  /**
   * Creates and initializes a puzzle.
   * @param equation Initial equation string.
   * @param options Layer, panel, control, and spacing options.
   */
  constructor(equation: string, options: BasicMultistepPuzzleOptions) {
    this.validateOptions(options)
    this.options = options

    const model = new MultistepSolverModel()
    this.view = new MultistepSolverView(options.layer.getStage()!, options.layer, {
      panelWidth: options.width,
      panelHeight: options.height,
      blockSize: options.blockSize,
      panelColor: options.panelColor,
    })
    this.controller = new MultistepSolverController(model, this.view)
    this.actionMenu = new ActionMenu(
      options.actionMenuWidth ?? 64,
      options.actionMenuHeight ?? 64,
    )
    this.input = new TextInput({
      layer: options.layer,
      x: 0,
      y: 0,
      width: options.inputWidth ?? 100,
      height: options.inputHeight ?? 50,
      backgroundColor: '#eeeeee',
      foregroundColor: '#000000',
      ghostText: 'input',
      ghostTextColor: '#aaaaaa',
    })

    this.keypad = new KeypadInput();
    options.layer.add(this.keypad);

    options.layer.add(this.actionMenu)
    this.view.setPosition(options.x, options.y)
    this.hideExternalControls()
    this.connectComponents()
    this.controller.setEquation(equation)
  }

  private validateOptions(options: BasicMultistepPuzzleOptions): void {
    if (!options.layer.getStage()) {
      throw Error('BasicMultistepPuzzle requires a layer attached to a Konva stage.')
    }
    if (!Number.isFinite(options.width) || options.width <= 0) {
      throw Error('BasicMultistepPuzzle width must be a positive number.')
    }
    if (!Number.isFinite(options.height) || options.height <= 0) {
      throw Error('BasicMultistepPuzzle height must be a positive number.')
    }
    if (!Number.isFinite(options.spacing) || options.spacing < 0) {
      throw Error('BasicMultistepPuzzle spacing must be a non-negative number.')
    }
  }

  private connectComponents(): void {

    this.keypad.onKeyPressed = (key) => {
        if (key === "C"){
          this.keypadAnswer = ""
        } else if (key === "⌫") {
          this.keypadAnswer = this.keypadAnswer.slice(0, -1)
        } else if (key === "-") {
          this.keypadAnswer = this.keypadAnswer.startsWith("-")
              ? this.keypadAnswer.slice(1)
              : "-" + this.keypadAnswer
        } else if (key === "/"){
          if (this.keypadAnswer !== "" &&
            this.keypadAnswer !== "-" &&
            !this.keypadAnswer.includes("/")) {
            this.keypadAnswer += "/"
          }
        } else {
            this.keypadAnswer += key
        }
        this.keypad.setAnswer(this.keypadAnswer);
    }

    this.keypad.onSubmit = () => {
      const answer = this.keypadAnswer.trim();

      //Only allows whole number or fractions to be submitted
      if (!/^-?\d+(\/\d+)?$/.test(answer)) return;

      //Disallows division by 0
      if (answer.includes("/") && Number(answer.split("/")[1]) === 0) {
        return;
    }

      this.controller.arithmetic(answer);

    };


    
    this.view.onTargetDropped = (index, isLeftSide) => {
      this.controller.operation(index, isLeftSide)
    }
    this.view.onNegativeSignDropped = isLeftSide => {
      this.controller.removeNegativeSign(isLeftSide)
    }

    this.actionMenu.onAdditionClicked = () => this.moveRequest('+')
    this.actionMenu.onSubtractionClicked = () => this.moveRequest('-')
    this.actionMenu.onMultiplicationClicked = () => this.moveRequest('*')
    this.actionMenu.onDivisionClicked = () => this.moveRequest('/')

    this.input.onTextFocused = () => {
      this.input.outlineColor('#77aaff')
    }
    this.input.onTextEntered = text => {
      this.input.outlineColor('#aabbbb')
      const answer = text.trim()
      if (answer === '') return // an empty box (e.g. on blur) isn't an Answer
      this.controller.arithmetic(answer)
    }

    this.controller.onAnswerSubmit = (_question, playerAnswer, correctAnswer, isLastStep) => {
      this.input.clear()
      this.keypadAnswer = ''
      this.keypad.setAnswer('')
      if (playerAnswer === correctAnswer) this.controller.step()
      this.onAnswer?.({ playerAnswer, correctAnswer, isLastStep })
    }

    this.controller.onStateChange = state => {
      if (state === 'Operation') {
        this.input.hide()
        this.keypad.hide()
        this.actionMenu.show(this.actionMenuX(), this.options.y)
        return
      }

      if (state === 'Arithmetic') {
        this.actionMenu.hide()
        
        if (this.options.inputType === "keypad") {
        this.input.hide()

        this.keypad.position({
            x: this.options.x + this.options.width / 2 - 260,
            y: this.options.y - 220
        })

        this.keypad.show()
        this.keypad.moveToTop()

        }else{
          this.keypad.hide();
          this.input.show(this.options.x, this.inputY())
          this.input.outlineColor('#aabbbb')
        }
        return
      }

      this.hideExternalControls()
      if (state === 'Finished') {
        this.onPuzzleFinished?.(true)
      }
    }
  }

  /** Removes the puzzle from its layer, including the text input's HTML element. */
  public destroy(): void {
    this.onAnswer = undefined
    this.onPuzzleFinished = undefined
    this.controller.onAnswerSubmit = undefined
    this.controller.onStateChange = undefined
    this.view.destroy()
    this.actionMenu.destroy()
    this.input.destroy()
    this.keypad.destroy();
  }

  private moveRequest(operation: TermOp): void {
    this.controller.moveRequest(operation)
  }

  private actionMenuX(): number {
    const menuWidth = this.options.actionMenuWidth ?? 64
    return this.options.x + BasicMultistepPuzzle.DROP_ZONE_SIZE / 2 +
      this.options.spacing + menuWidth / 2
  }

  private inputY(): number {
    const inputHeight = this.options.inputHeight ?? 50
    return this.options.y + BasicMultistepPuzzle.DROP_ZONE_SIZE / 2 +
      this.options.spacing + inputHeight / 2
  }

  private hideExternalControls(): void {
    this.actionMenu.hide()
    this.input.hide()
    this.keypad.hide()
  }
}

export default BasicMultistepPuzzle
