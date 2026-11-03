import Konva from 'konva'

import ActionMenu from '../multistep-solver/action-menu'
import MultistepSolverController from '../multistep-solver/multistep-solver-controller'
import MultistepSolverModel from '../multistep-solver/multistep-solver-model'
import MultistepSolverView from '../multistep-solver/multistep-solver-view'
import { TermOp } from '../multistep-solver/types'
import TextInput from '../text-input/text-input'

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
}

class BasicMultistepPuzzle {
  private static readonly DROP_ZONE_SIZE = 100

  private readonly options: BasicMultistepPuzzleOptions
  private readonly view: MultistepSolverView
  private readonly controller: MultistepSolverController
  private readonly actionMenu: ActionMenu
  private readonly input: TextInput

  /** Called when the puzzle reaches its Finished state. */
  public onPuzzleFinished?: (solved: boolean) => void

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
    this.view.onTargetDropped = (index, isLeftSide) => {
      this.controller.operation(index, isLeftSide)
    }

    this.actionMenu.onAdditionClicked = () => this.moveRequest('+')
    this.actionMenu.onSubtractionClicked = () => this.moveRequest('-')
    this.actionMenu.onMultiplicationClicked = () => this.moveRequest('*')
    this.actionMenu.onDivisionClicked = () => this.moveRequest('/')

    this.input.onTextFocused = () => {
      this.input.outlineColor('#77aaff')
    }
    this.input.onTextEntered = answer => {
      this.input.outlineColor('#aabbbb')
      this.controller.arithmetic(answer)
    }

    this.controller.onAnswerSubmit = (_question, playerAnswer, correctAnswer) => {
      this.input.clear()
      if (playerAnswer === correctAnswer) this.controller.step()
    }

    this.controller.onStateChange = state => {
      if (state === 'Operation') {
        this.input.hide()
        this.actionMenu.show(this.actionMenuX(), this.options.y)
        return
      }

      if (state === 'Arithmetic') {
        this.actionMenu.hide()
        this.input.show(this.options.x, this.inputY())
        this.input.outlineColor('#aabbbb')
        return
      }

      this.hideExternalControls()
      if (state === 'Finished') {
        this.onPuzzleFinished?.(true)
      }
    }
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
  }
}

export default BasicMultistepPuzzle
