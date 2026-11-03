import { describe, expect, it } from 'vitest'

import MultistepSolverController from './multistep-solver-controller'
import MultistepSolverModel from './multistep-solver-model'
import { Term } from './types'

const numberTerm = (term: string, positive = true): Term => ({
  term,
  positive,
  constant: true,
})

const fakeView = () => ({
  update: () => undefined,
  showDropzone: () => undefined,
  hideDropzone: () => undefined,
  clearDropzone: () => undefined,
}) as any

describe('MultistepSolverController', () => {
  it.each([
    [
      'x * 5 + 3 = 8',
      [
        { term: 'x', positive: true, constant: false }, '*',
        numberTerm('5'), numberTerm('3'),
      ],
      [numberTerm('8')],
    ],
    [
      '-x * 5 = -5',
      [
        { term: 'x', positive: false, constant: false }, '*', numberTerm('5'),
      ],
      [numberTerm('5', false)],
    ],
    [
      '3 - 8 = -x * 5',
      [numberTerm('3'), numberTerm('8', false)],
      [
        { term: 'x', positive: false, constant: false }, '*', numberTerm('5'),
      ],
    ],
    [
      'x / 2 - 3/5 = 4',
      [
        { term: 'x', positive: true, constant: false }, '/', numberTerm('2'),
        numberTerm('3/5', false),
      ],
      [numberTerm('4')],
    ],
  ])('parses %s into normalized model sides', (equation, expectedLeft, expectedRight) => {
    const model = new MultistepSolverModel()
    const controller = new MultistepSolverController(model, fakeView())

    controller.setEquation(equation)

    expect(model.getLeftSide()).toEqual(expectedLeft)
    expect(model.getRightSide()).toEqual(expectedRight)
  })

  it.each([
    '',
    'x * 5',
    'x =',
    '= 5',
    'x ** 5 = 5',
    'x + = 5',
    'x * 5a = 5',
    'x * 5 = 5 = 5',
  ])('rejects invalid equation %s', equation => {
    const model = new MultistepSolverModel()
    const controller = new MultistepSolverController(model, fakeView())

    expect(() => controller.setEquation(equation)).toThrow()
  })

  it.each([
    'x = 5',
    '-x = -5',
    '5 = x',
  ])('starts solved equations in Finished state: %s', equation => {
    const controller = new MultistepSolverController(new MultistepSolverModel(), fakeView())

    controller.setEquation(equation)

    expect(controller.getState()).toBe('Finished')
  })
})
