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
    it.each<[Term[], string]>([
      [[variableTerm('x', true), '*', numberTerm('1')], 'x'],
      [[variableTerm('x', true), '/', numberTerm('1')], 'x'],
      [[variableTerm('x', true), '/', numberTerm('1/3')], '3 * x'],
      [[variableTerm('x', true), '*', numberTerm('3/2')], '3/2 * x'],
    ])('uses canonical coefficient notation for %#', (left, expected) => {
      const model = new MultistepSolverModel()
      addSide(model, left, [constantTerm(0)])

      // The first problem is only present when the term can be combined;
      // inspect the display-side representation for standalone terms below.
      expect(model.getDisplaySide(true).map(({ term }) =>
        typeof term === 'string' ? term : `${term.positive ? '' : '-'}${term.term}`,
      ).join(' ')).toBe(expected)
    })

    it('normalizes a reciprocal divisor in the model, not only in the display', () => {
      const model = new MultistepSolverModel()
      addSide(model, [variableTerm('x', true), '/', numberTerm('1/3')], [constantTerm(1)])

      expect(model.getLeftSide()).toEqual([variableTerm('x', true), '*', numberTerm('3')])
      expect(model.correctOperation(2, true, true)).toBe('/')
    })

    it('keeps a divisor chain visible instead of folding it into the next answer', () => {
      const model = new MultistepSolverModel()
      addSide(model, [variableTerm('x', true), '/', numberTerm('9'), '/', numberTerm('8')], [constantTerm(1)])

      expect(model.getDisplaySide(true).map(({ term }) =>
        typeof term === 'string' ? term : `${term.positive ? '' : '-'}${term.term}`,
      ).join(' ')).toBe('x / 9 / 8')
    })

    it('keeps an unreduced coefficient visible while evaluating it', () => {
      const model = new MultistepSolverModel()
      addSide(model,
        [numberTerm('5'), '*', variableTerm('x', true), '/', numberTerm('10')],
        [constantTerm(1)],
      )

      expect(model.getDisplaySide(true).map(({ term }) =>
        typeof term === 'string' ? term : `${term.positive ? '' : '-'}${term.term}`,
      ).join(' ')).toBe('5/10 * x')
      expect(model.arithmeticProblems()).toEqual([])
    })

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
        [numberTerm('5'), '/', numberTerm('1/3')],
        [['5 * 3', '15']],
      ],
      [
        [variableTerm('x', true), '*', numberTerm('5'), variableTerm('x', true), '*', numberTerm('2')],
        [['5 * x + 2 * x', '7 * x']],
      ],
      [
        [variableTerm('x', true), '*', numberTerm('5'), variableTerm('x', false), '*', numberTerm('2')],
        [['5 * x - 2 * x', '3 * x']],
      ],
      [
        [variableTerm('x', true), variableTerm('x', true), '*', numberTerm('7/4')],
        [['x + 7/4 * x', '11/4 * x']],
      ],
      [
        [variableTerm('x', true), '*', numberTerm('5'), numberTerm('3')],
        [],
      ],
      [
        [variableTerm('x', false), '*', numberTerm('5'), variableTerm('x', true), '*', numberTerm('2')],
        [['-5 * x + 2 * x', '-3 * x']],
      ],
    ])('returns expected problems for %#', (left, expected) => {
      const model = new MultistepSolverModel()
      addSide(model, left, [constantTerm(0)])

      expect(model.arithmeticProblems()).toEqual(expected)
    })

    // Issue #44: a negative factor after `*` or `/` is stored as its magnitude
    // with positive: false, and its sign must count toward the coefficient.
    it.each<[string, Term[], string]>([
      [
        'x * (-99) - x',
        [variableTerm('x', true), '*', numberTerm('99', false), variableTerm('x', false)],
        '-100 * x',
      ],
      [
        'x / (-4) - x * (-7)',
        [variableTerm('x', true), '/', numberTerm('4', false), variableTerm('x', false), '*', numberTerm('7', false)],
        '27/4 * x',
      ],
    ])('keeps the sign of a negative factor when combining %s', (_name, left, answer) => {
      const model = new MultistepSolverModel()
      addSide(model, left, [constantTerm(0)])

      expect(model.arithmeticProblems().map(([, a]) => a)).toEqual([answer])
    })

    // The expression labels the arithmetic input, so a negative factor after
    // `*` or `/` must keep its sign in the text.
    it.each<[string, Term[], [string, string]]>([
      [
        'x * 9 / (-8)',
        [variableTerm('x', true), '*', numberTerm('9'), '/', numberTerm('8', false)],
        ['9 / -8', '-9/8'],
      ],
      [
        'x * (-30) - x',
        [variableTerm('x', true), '*', numberTerm('30', false), variableTerm('x', false)],
        ['-30 * x - x', '-31 * x'],
      ],
      [
        'x - x * (-7)',
        [variableTerm('x', true), variableTerm('x', false), '*', numberTerm('7', false)],
        ['x + 7 * x', '8 * x'],
      ],
      [
        'x / (-4) - x * (-7)',
        [variableTerm('x', true), '/', numberTerm('4', false), variableTerm('x', false), '*', numberTerm('7', false)],
        ['-x / 4 + 7 * x', '27/4 * x'],
      ],
    ])('shows the sign of a negative factor in the expression for %s', (_name, left, problem) => {
      const model = new MultistepSolverModel()
      addSide(model, left, [constantTerm(0)])

      expect(model.arithmeticProblems()).toEqual([problem])
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

    // A constant after `/` is a divisor, so the next factor folds into it with
    // the opposite operator: x / a / b = x / (a * b) and x / a * b = x / (a / b).
    it.each<[string, Term[], string, Term[]]>([
      [
        'x / 2 / (-4)',
        [variableTerm('x', true), '/', numberTerm('2'), '/', numberTerm('4', false)],
        '-8',
        [variableTerm('x', true), '/', numberTerm('8', false)],
      ],
      [
        'x / 2 * 4',
        [variableTerm('x', true), '/', numberTerm('2'), '*', numberTerm('4')],
        '1/2',
        [variableTerm('x', true), '/', numberTerm('1/2')],
      ],
    ])('folds constants that follow a division in %s', (_name, right, answer, expected) => {
      const model = new MultistepSolverModel()
      addSide(model, [variableTerm('y', true)], right)

      expect(model.arithmeticProblems().map(([, a]) => a)).toEqual([answer])
      model.solve()

      expect(model.getRightSide()).toEqual(expected)
    })

    it('folds a divisor chain of constants to the same value from either end', () => {
      const fromStart = new MultistepSolverModel()
      addSide(fromStart, [variableTerm('y', true)], [numberTerm('12'), '/', numberTerm('4'), '/', numberTerm('2')])
      fromStart.solve(0)
      fromStart.solve(0)

      const fromEnd = new MultistepSolverModel()
      addSide(fromEnd, [variableTerm('y', true)], [numberTerm('12'), '/', numberTerm('4'), '/', numberTerm('2')])
      fromEnd.solve(1)
      fromEnd.solve(0)

      expect(fromStart.getRightSide()).toEqual([numberTerm('3/2')])
      expect(fromEnd.getRightSide()).toEqual([numberTerm('3/2')])
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

    it('does not keep a variable negative after moving a negative leading coefficient', () => {
      const model = new MultistepSolverModel()
      addSide(model,
        [numberTerm('9', false), '*', variableTerm('x', true)],
        [numberTerm('144', false)],
      )

      model.moveLeftTerm(0, true)

      expect(model.getLeftSide()).toEqual([variableTerm('x', true)])
      expect(model.getRightSide()).toEqual([
        numberTerm('144', false), '/', numberTerm('9', false),
      ])
    })
  })

  describe('removeNegativeSign', () => {
    it('turns a lone -x = -9 into x = 9', () => {
      const model = new MultistepSolverModel()
      addSide(model, [variableTerm('x', false)], [numberTerm('9', false)])

      model.removeNegativeSign(true)

      expect(model.getLeftSide()).toEqual([variableTerm('x', true)])
      expect(model.getRightSide()).toEqual([numberTerm('9')])
    })

    it('still turns -x * 3 = 6 into x * 3 = -6', () => {
      const model = new MultistepSolverModel()
      addSide(model, [variableTerm('x', false), '*', constantTerm(3)], [constantTerm(6)])

      model.removeNegativeSign(true)

      expect(model.getLeftSide()).toEqual([variableTerm('x', true), '*', constantTerm(3)])
      expect(model.getRightSide()).toEqual([numberTerm('6', false)])
    })

    it('refuses a positive x or a side with more than the x term', () => {
      const positive = new MultistepSolverModel()
      addSide(positive, [variableTerm('x', true)], [constantTerm(9)])
      expect(() => positive.removeNegativeSign(true)).toThrow()

      const longer = new MultistepSolverModel()
      addSide(longer, [variableTerm('x', false), constantTerm(2)], [constantTerm(9)])
      expect(() => longer.removeNegativeSign(true)).toThrow()
    })
  })
})
