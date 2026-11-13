import { describe, expect, it } from 'vitest'

import MultistepSolverModel from './multistep-solver-model'
import { constantTerm, Term, variableTerm } from './types'

const numberTerm = (value: string, positive = true): Term => ({
  term: value,
  positive,
  constant: true,
})

const addSide = (model: MultistepSolverModel, left: Term[], right: Term[]) => {
  left.forEach(term => model.addLeft(term))
  right.forEach(term => model.addRight(term))
}

describe('MultistepSolverModel', () => {
  describe('model representation and validation', () => {
    it.each<[Term[], Term[]]>([
      [
        [variableTerm('x', true), '*', constantTerm(5), constantTerm(3)],
        [constantTerm(8)],
      ],
      [
        [variableTerm('x', true), '/', constantTerm(2), numberTerm('3', false)],
        [numberTerm('4', false), variableTerm('y', true)],
      ],
    ])('accepts normalized sides %#', (left, right) => {
      const model = new MultistepSolverModel()
      addSide(model, left, right)

      expect(model.getLeftSide()).toEqual(left)
      expect(model.getRightSide()).toEqual(right)
    })

    it.each<[string, (model: MultistepSolverModel) => void]>([
      ['operator at the beginning', (model: MultistepSolverModel) => model.addLeft('*')],
      ['addition operator in the model', (model: MultistepSolverModel) => {
        model.addLeft(constantTerm(1))
        model.addLeft('+')
      }],
      ['subtraction operator in the model', (model: MultistepSolverModel) => {
        model.addLeft(constantTerm(1))
        model.addLeft('-')
      }],
      ['two multiplicative operators', (model: MultistepSolverModel) => {
        model.addLeft(constantTerm(1))
        model.addLeft('*')
        model.addLeft('/')
      }],
    ])('rejects %s', (_name, action) => {
      expect(() => action(new MultistepSolverModel())).toThrow()
    })
  })

  describe('arithmeticProblems', () => {
    it.each<[Term[], Array<[string, string]>]>([
      [
        [numberTerm('8'), numberTerm('3', false)],
        [['8 - 3', '5']],
      ],
      [
        [numberTerm('3'), '/', numberTerm('5')],
        [['3 / 5', '3/5']],
      ],
      [
        [numberTerm('6'), '/', numberTerm('2')],
        [['6 / 2', '3']],
      ],
      [
        [variableTerm('x', true), '*', numberTerm('5'), variableTerm('x', true), '*', numberTerm('2')],
        [['x * 5 + x * 2', 'x * 7']],
      ],
      [
        [variableTerm('x', true), '*', numberTerm('5'), variableTerm('x', false), '*', numberTerm('2')],
        [['x * 5 - x * 2', 'x * 3']],
      ],
      [
        [variableTerm('x', true), '*', numberTerm('5'), numberTerm('3')],
        [],
      ],
      [
        [variableTerm('x', false), '*', numberTerm('5'), variableTerm('x', true), '*', numberTerm('2')],
        [['-x * 5 + x * 2', '-x * 3']],
      ],
    ])('returns expected problems for %#', (left, expected) => {
      const model = new MultistepSolverModel()
      addSide(model, left, [constantTerm(0)])

      expect(model.arithmeticProblems()).toEqual(expected)
    })

    it('finds problems on both sides in left-to-right order', () => {
      const model = new MultistepSolverModel()
      addSide(model,
        [numberTerm('8'), numberTerm('3', false)],
        [numberTerm('6'), '/', numberTerm('2')],
      )

      expect(model.arithmeticProblems()).toEqual([
        ['8 - 3', '5'],
        ['6 / 2', '3'],
      ])
    })
  })

  describe('solve', () => {
    it('solves the first constant problem and preserves normalized terms', () => {
      const model = new MultistepSolverModel()
      addSide(model,
        [variableTerm('x', true), '*', constantTerm(5)],
        [numberTerm('8'), numberTerm('3', false)],
      )

      model.solve()

      expect(model.getRightSide()).toEqual([numberTerm('5')])
      expect(model.arithmeticProblems()).toEqual([])
    })

    it('solves like-variable problems', () => {
      const model = new MultistepSolverModel()
      addSide(model,
        [variableTerm('x', true), '*', numberTerm('5'), variableTerm('x', false), '*', numberTerm('2')],
        [constantTerm(9)],
      )

      model.solve()

      expect(model.getLeftSide()).toEqual([variableTerm('x', true), '*', numberTerm('3')])
    })

    it('reduces a fractional problem to a single term', () => {
      const model = new MultistepSolverModel()
      addSide(model, [numberTerm('3'), '/', numberTerm('5')], [constantTerm(1)])

      model.solve()

      expect(model.getLeftSide()).toEqual([numberTerm('3/5')])
    })

    it('throws when solve is called with no problems', () => {
      const model = new MultistepSolverModel()
      addSide(model, [variableTerm('x', true), '*', constantTerm(5)], [constantTerm(8)])

      expect(() => model.solve()).toThrow()
    })
  })

  // Regression tests for issue #40. Both start from a generated Hard
  // question (x * 4 - 14 = x / 14 + 41) and follow moves a player can make.
  describe('moving a multiplicative factor', () => {
    const hardQuestion = (): MultistepSolverModel => {
      const model = new MultistepSolverModel()
      addSide(model,
        [variableTerm('x', true), '*', numberTerm('4'), numberTerm('14', false)],
        [variableTerm('x', true), '/', numberTerm('14'), numberTerm('41')],
      )
      return model
    }

    it('applies the operation once to a multi-factor term on the other side', () => {
      const model = hardQuestion()
      model.moveLeftTerm(3) // add 14: x * 4 = x / 14 + 41 + 14
      model.solve() // 41 + 14 = 55

      model.moveRightTerm(2) // multiply by 14

      expect(model.getLeftSide()).toEqual([
        variableTerm('x', true), '*', numberTerm('4'), '*', numberTerm('14'),
      ])
      expect(model.getRightSide()).toEqual([
        variableTerm('x', true), numberTerm('55'), '*', numberTerm('14'),
      ])
    })

    it('applies the operation once to a multi-factor term on the same side', () => {
      const model = hardQuestion()
      model.moveRightTerm(0) // x * 4 - 14 - x / 14 = 41
      expect(model.arithmeticProblems()).toEqual([])

      model.moveLeftTerm(2) // divide by 4

      expect(model.getLeftSide()).toEqual([
        variableTerm('x', true),
        numberTerm('14', false), '/', numberTerm('4'),
        variableTerm('x', false), '/', numberTerm('14'), '/', numberTerm('4'),
      ])
      expect(model.getRightSide()).toEqual([numberTerm('41'), '/', numberTerm('4')])
    })
  })
})
