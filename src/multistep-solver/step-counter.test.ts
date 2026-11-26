import { describe, it, expect } from 'vitest'

import MultistepSolverModel from './multistep-solver-model'
import MultistepSolverController from './multistep-solver-controller'
import type MultistepSolverView from './multistep-solver-view'
import { stepsLeft } from './step-counter'

const fakeView = {
  update() {}, showDropzone() {}, hideDropzone() {}, clearDropzone() {},
} as unknown as MultistepSolverView

function load(equation: string): MultistepSolverModel {
  const model = new MultistepSolverModel()
  new MultistepSolverController(model, fakeView).setEquation(equation)
  return model
}

describe('stepsLeft', () => {
  it.each([
    ['x + 4 = 5', 2],
    ['x * 3 = 21', 2],
    ['x * 3 - 7 = 14', 4],
    ['x * 5 + 4 = 25 + x * 2', 6],
  ])('counts the fewest Steps for %s', (equation, steps) => {
    expect(stepsLeft(load(equation as string))).toBe(steps)
  })

  it('takes one Step to clear the minus sign of a lone -x', () => {
    expect(stepsLeft(load('-x = -9'))).toBe(1)
  })

  it('is 0 for a solved equation', () => {
    expect(stepsLeft(load('x = 7'))).toBe(0)
  })

  it('leaves the equation untouched', () => {
    const model = load('x * 3 - 7 = 14')
    const before = JSON.stringify([model.getLeftSide(), model.getRightSide()])

    stepsLeft(model)

    expect(JSON.stringify([model.getLeftSide(), model.getRightSide()])).toBe(before)
  })

  it('counts waiting arithmetic as Steps', () => {
    const model = load('x * 3 - 7 = 14')
    model.moveLeftTerm(3) // x * 3 = 14 + 7, with 14 + 7 to work out
    expect(stepsLeft(model)).toBe(3)
  })
})
