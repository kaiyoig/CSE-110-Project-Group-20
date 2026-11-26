import { describe, it, expect } from 'vitest'

import MultistepSolverModel from './multistep-solver-model'
import MultistepSolverController from './multistep-solver-controller'
import type MultistepSolverView from './multistep-solver-view'
import { answerText, displayExpression, keyboardKey, normalizeKeypadAnswer } from './answer-format'

const fakeView = {
  update() {}, showDropzone() {}, hideDropzone() {}, clearDropzone() {},
} as unknown as MultistepSolverView

function load(equation: string): MultistepSolverModel {
  const model = new MultistepSolverModel()
  new MultistepSolverController(model, fakeView).setEquation(equation)
  return model
}

describe('normalizeKeypadAnswer', () => {
  it.each([
    ['21', '21'],
    ['-21', '-21'],
    ['3/4', '3/4'],
    ['-3/4', '-3/4'],
    ['3x', '3x'],
    ['x3', '3x'],
    ['-3x', '-3x'],
    ['11/2x', '11/2x'],
    ['x', 'x'],
  ])('reads %s as %s', (typed, expected) => {
    expect(normalizeKeypadAnswer(typed as string)).toBe(expected)
  })

  it.each(['', '-', '3/', '3/0', '3x4', 'x/0', '1/2/3'])('is not an answer yet: %s', typed => {
    expect(normalizeKeypadAnswer(typed as string)).toBeNull()
  })
})

describe('displayExpression', () => {
  it.each([
    ['14 + 7', '14 + 7'],
    ['x * -3 - x * 7', '−3x − 7x'],
    ['x * 1/2 + x * 3', '1/2x + 3x'],
    ['x * 5 - x / -2', '5x − x/(−2)'],
    ['x * 5 - x * -2', '5x − (−2)x'],
    ['x / 3 - x / 6', 'x/3 − x/6'],
    ['-x * 3 + x * 2', '−3x + 2x'],
    ['14 - -3', '14 − −3'],
    ['21 / 3', '21 / 3'],
    ['-3 * 4', '−3 · 4'],
    // The solver now writes coefficients first.
    ['5 * x + x / 2', '5x + x/2'],
    ['-3 * x - 7 * x', '−3x − 7x'],
    ['5 * x - -2 * x', '5x − (−2)x'],
  ])('shows %s as %s', (expression, shown) => {
    expect(displayExpression(expression as string)).toBe(shown)
  })
})

describe('keyboardKey', () => {
  it('maps keyboard keys to keypad keys', () => {
    expect(['7', 'X', '-', '/', 'Backspace', 'Escape', 'Enter', 'a'].map(keyboardKey))
      .toEqual(['7', 'x', '-', '/', '⌫', 'C', 'Enter', null])
  })
})

describe('answerText', () => {
  it('reads a solved equation either way round', () => {
    expect(answerText(load('x = 7'))).toBe('x = 7')
    expect(answerText(load('-3/4 = x'))).toBe('x = -3/4')
  })

  it('is empty while the equation is unsolved', () => {
    expect(answerText(load('x + 1 = 2'))).toBe('')
  })
})
