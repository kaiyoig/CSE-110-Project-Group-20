import { TermOp, TermValue } from './types'
import MultistepSolverModel from './multistep-solver-model'
import MultistepSolverView from './multistep-solver-view'

export type MultistepSolverState = 'Idle' | 'Operation' | 'Arithmetic' | 'Finished'

interface PendingOperation {
  kind: 'term' | 'negativeSign'
  index?: number
  isLeftSide: boolean
  accepted: boolean
}

class MultistepSolverController {
  private readonly model: MultistepSolverModel
  private readonly view: MultistepSolverView
  private state: MultistepSolverState = 'Idle'
  private pendingOperation: PendingOperation | null = null
  private arithmeticAnswerAccepted = false
  private equation = ''

  public onStateChange?: (newState: MultistepSolverState) => void
  public onAnswerSubmit?: (
    question: string,
    playerAnswer: string,
    correctAnswer: string,
    isLastStep: boolean,
  ) => void

  constructor(model: MultistepSolverModel, view: MultistepSolverView) {
    this.model = model
    this.view = view
  }

  private setState(state: MultistepSolverState): void {
    if (this.state === state) return
    this.state = state
    if (state === 'Finished') {
      this.view.clearDropzone()
      this.view.hideDropzone()
    }
    this.onStateChange?.(state)
  }

  public getState(): MultistepSolverState {
    return this.state
  }

  public setEquation(equationString: string): void {
    const sides = equationString.split('=')
    if (sides.length !== 2) {
      throw Error('An equation must contain exactly one equals sign.')
    }

    this.model.reset()
    this.parseSide(sides[0], true)
    this.parseSide(sides[1], false)
    if (this.model.getLeftSide().length === 0 || this.model.getRightSide().length === 0) {
      throw Error('Both sides of the equation must contain at least one term.')
    }

    this.equation = equationString
    this.pendingOperation = null
    this.arithmeticAnswerAccepted = false
    this.view.update(this.model)
    if (this.isSolvedEquation()) {
      this.setState('Finished')
    } else {
      this.view.showDropzone()
      this.setState('Idle')
    }
  }

  public operation(index: number, isLeftSide: boolean): void {
    if (this.state === 'Arithmetic' || this.state === 'Finished') return

    const side = isLeftSide ? this.model.getLeftSide() : this.model.getRightSide()
    if (index < 0 || index >= side.length || typeof side[index] === 'string') return

    this.pendingOperation = { kind: 'term', index, isLeftSide, accepted: false }
    this.setState('Operation')
  }

  public removeNegativeSign(isLeftSide: boolean): void {
    if (this.state === 'Arithmetic' || this.state === 'Finished') return

    this.pendingOperation = { kind: 'negativeSign', isLeftSide, accepted: false }
    this.setState('Operation')
  }

  public moveRequest(operation: TermOp): void {
    if (this.state !== 'Operation' || !this.pendingOperation) return

    const expectedOperation = this.pendingOperation.kind === 'negativeSign'
      ? '*'
      : this.model.correctOperation(
        this.pendingOperation.index!,
        this.pendingOperation.isLeftSide,
      )
    const isCorrect = operation === expectedOperation
    this.pendingOperation.accepted = isCorrect
    this.onAnswerSubmit?.(this.equation, operation, expectedOperation, false)
  }

  public arithmetic(answer: string): void {
    if (this.state !== 'Arithmetic') return

    const problems = this.model.arithmeticProblems()
    if (problems.length === 0) {
      this.setState('Idle')
      return
    }

    const [_, correctAnswer] = problems[0]
    const isLastStep = this.isLastArithmeticStep()
    this.arithmeticAnswerAccepted = answer === correctAnswer
    this.onAnswerSubmit?.(this.equation, answer, correctAnswer, isLastStep)
  }

  public step(): void {
    if (this.state === 'Finished') return

    if (this.state === 'Operation') {
      if (!this.pendingOperation?.accepted) return

      if (this.pendingOperation.kind === 'negativeSign') {
        this.model.removeNegativeSign(this.pendingOperation.isLeftSide)
      } else if (this.pendingOperation.isLeftSide) {
        this.model.moveLeftTerm(this.pendingOperation.index!)
      } else {
        this.model.moveRightTerm(this.pendingOperation.index!)
      }

      this.pendingOperation = null
      this.view.clearDropzone()
      this.view.hideDropzone()
      this.view.update(this.model)
      this.updateStateAfterModelChange()
      return
    }

    if (this.state === 'Arithmetic') {
      if (!this.arithmeticAnswerAccepted) return

      this.model.solve()
      this.arithmeticAnswerAccepted = false
      this.view.update(this.model)
      this.updateStateAfterModelChange()
    }
  }

  public fail(): void {
    this.pendingOperation = null
    this.arithmeticAnswerAccepted = false
    this.view.clearDropzone()
    this.view.hideDropzone()
    this.setState('Finished')
  }

  private parseSide(sideString: string, isLeftSide: boolean): void {
    const tokens = sideString.match(/[A-Za-z]+|(?:\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?)|[+\-*/]/g)
    if (!tokens || tokens.join('') !== sideString.replace(/\s/g, '')) {
      throw Error(`Could not parse equation side: ${sideString}`)
    }

    let expectingValue = true
    let pendingSign: boolean | null = null
    for (const token of tokens) {
      const isValue = /^[A-Za-z]+$/.test(token) || /^\d/.test(token)
      if (isValue) {
        if (!expectingValue) throw Error('Two values cannot be adjacent in an equation.')

        const isZero = !/^[A-Za-z]+$/.test(token) && Number(token) === 0;
        const value: TermValue = /^[A-Za-z]+$/.test(token)
          ? { term: token, positive: pendingSign ?? true, constant: false }
          : { term: token, positive: isZero ? true : pendingSign ?? true, constant: true }
        this.addParsedTerm(value, isLeftSide)
        expectingValue = false
        pendingSign = null
        continue
      }

      if (expectingValue) {
        if ((token === '+' || token === '-') && pendingSign === null) {
          pendingSign = token === '+'
          continue
        }
        throw Error(`Unexpected operator: ${token}`)
      }

      if (token === '+' || token === '-') {
        pendingSign = token === '+'
      } else {
        this.addParsedOperator(token as TermOp, isLeftSide)
      }
      expectingValue = true
    }

    if (expectingValue) throw Error('An equation side cannot end with an operator.')
  }

  private addParsedTerm(term: TermValue, isLeftSide: boolean): void {
    if (isLeftSide) this.model.addLeft(term)
    else this.model.addRight(term)
  }

  private addParsedOperator(operator: TermOp, isLeftSide: boolean): void {
    if (isLeftSide) this.model.addLeft(operator)
    else this.model.addRight(operator)
  }

  private isLastArithmeticStep(): boolean {
    const problems = this.model.arithmeticProblems()
    if (problems.length !== 1) return false

    const left = this.model.getLeftSide()
    const right = this.model.getRightSide()
    const isVariable = (side: Array<unknown>): boolean => {
      if (side.length !== 1) return false
      const term = side[0] as TermValue
      return typeof term !== 'string' && !term.constant
    }
    const isConstant = (side: Array<unknown>): boolean => {
      if (side.length !== 1) return false
      const term = side[0] as TermValue
      return typeof term !== 'string' && term.constant
    }

    return (isVariable(left) && isConstant(right)) || (isConstant(left) && isVariable(right))
  }

  private isSolvedEquation(): boolean {
    const isVariable = (side: Array<unknown>): boolean => {
      if (side.length !== 1) return false
      const term = side[0] as TermValue
      return typeof term !== 'string' && !term.constant
    }
    const isConstant = (side: Array<unknown>): boolean => {
      if (side.length !== 1) return false
      const term = side[0] as TermValue
      return typeof term !== 'string' && term.constant
    }

    const left = this.model.getLeftSide()
    const right = this.model.getRightSide()
    return (isVariable(left) && isConstant(right)) || (isConstant(left) && isVariable(right))
  }

  private updateStateAfterModelChange(): void {
    if (this.isSolvedEquation()) {
      this.setState('Finished')
      return
    }

    this.view.showDropzone()
    this.setState(this.model.arithmeticProblems().length > 0 ? 'Arithmetic' : 'Idle')
  }
}

export default MultistepSolverController
