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
    '5 = x',
  ])('starts solved equations in Finished state: %s', equation => {
    const controller = new MultistepSolverController(new MultistepSolverModel(), fakeView())

    controller.setEquation(equation)

    expect(controller.getState()).toBe('Finished')
  })

  it('does not treat a negative variable equation as solved', () => {
    const controller = new MultistepSolverController(new MultistepSolverModel(), fakeView())

    controller.setEquation('-x = -5')

    expect(controller.getState()).not.toBe('Finished')
  })

  describe('isLastStep', () => {
    const solveWithSubmissions = (equation: string) => {
      const submissions: Array<[string, string, boolean]> = []
      const model = new MultistepSolverModel()
      const controller = new MultistepSolverController(model, fakeView())
      controller.onAnswerSubmit = (_q, playerAnswer, correctAnswer, isLastStep) => {
        submissions.push([playerAnswer, correctAnswer, isLastStep])
        if (playerAnswer === correctAnswer) controller.step()
      }
      controller.setEquation(equation)
      return { controller, submissions }
    }

    it('is true only for the arithmetic that leaves x = n', () => {
      const { controller, submissions } = solveWithSubmissions('x * 5 + 3 = 8')

      controller.operation(3, true) // + 3
      controller.moveRequest('-')
      controller.arithmetic('5') // 8 - 3
      controller.operation(2, true) // * 5
      controller.moveRequest('/')
      controller.arithmetic('1') // 5 / 5

      expect(submissions).toEqual([
        ['-', '-', false],
        ['5', '5', false],
        ['/', '/', false],
        ['1', '1', true],
      ])
      expect(controller.getState()).toBe('Finished')
    })

    it('reports the last Step the same way when the Answer is wrong', () => {
      const { controller, submissions } = solveWithSubmissions('x * 5 = 10')

      controller.operation(2, true)
      controller.moveRequest('/')
      controller.arithmetic('3')

      expect(submissions.at(-1)).toEqual(['3', '2', true])
      expect(controller.getState()).toBe('Arithmetic')
    })

    it('is false for removing a negative sign, which still leaves a product', () => {
      const { controller, submissions } = solveWithSubmissions('-x * 5 = -10')

      controller.removeNegativeSign(true)
      controller.moveRequest('*')

      expect(submissions).toEqual([['*', '*', false]])
      expect(controller.getState()).not.toBe('Finished')
    })

    it('does not change the real equation while checking', () => {
      const model = new MultistepSolverModel()
      const controller = new MultistepSolverController(model, fakeView())
      controller.setEquation('x * 5 + 3 = 8')
      const before = JSON.stringify([model.getLeftSide(), model.getRightSide()])

      controller.operation(3, true)
      controller.moveRequest('-')

      expect(JSON.stringify([model.getLeftSide(), model.getRightSide()])).toBe(before)
    })
  })
})
