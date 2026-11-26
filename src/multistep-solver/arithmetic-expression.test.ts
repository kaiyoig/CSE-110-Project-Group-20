import { describe, expect, it } from 'vitest'

import { acceptableArithmeticAnswer, canonicalizeArithmeticExpression, equivalentArithmeticExpressions } from './arithmetic-expression'

describe('arithmetic expression canonicalization', () => {
  it.each([
    ['x * 3', '3 * x'],
    ['x * 3', '3*x'],
    ['x * 3', '3x'],
    ['3/2 * x', 'x * 1.5'],
    ['x / 2', '0.5x'],
    ['x + 7/4 * x', 'x + 1.75x'],
  ])('recognizes equivalent forms: %s and %s', (left, right) => {
    expect(equivalentArithmeticExpressions(left, right)).toBe(true)
  })

  it('canonicalizes multiplication order and numeric factors', () => {
    expect(canonicalizeArithmeticExpression(' 3 / 2 * x ')).toBe('3/2*x')
    expect(canonicalizeArithmeticExpression('3x + x')).toBe('4*x')
  })

  it.each(['', 'x / y', 'x +', 'x ** 3', 'x + unknown!'])('rejects unsupported or malformed input: %s', input => {
    expect(equivalentArithmeticExpressions(input, 'x')).toBe(false)
  })

  it('rejects an unsimplified replay of the prompt while accepting the reduced answer', () => {
    expect(acceptableArithmeticAnswer('-9 * -8', '-9 * -8', '72')).toBe(false)
    expect(acceptableArithmeticAnswer('72', '-9 * -8', '72')).toBe(true)
  })

  it('accepts an equivalent simple like-term result but rejects repeated signs', () => {
    expect(acceptableArithmeticAnswer('-x', '-3 * x + 2 * x', '-x')).toBe(true)
    expect(acceptableArithmeticAnswer('---x', '-3 * x + 2 * x', '-x')).toBe(false)
  })

  it.each(['4/-2', '4/2', '2/-1'])('rejects non-simplest numeric fractions: %s', answer => {
    expect(acceptableArithmeticAnswer(answer, '4 / -2', '-2')).toBe(false)
  })

  it('accepts a reduced fraction answer', () => {
    expect(acceptableArithmeticAnswer('-3/2', '6 / -4', '-3/2')).toBe(true)
  })

  it.each(['1/2', '-1/2'])('accepts a reduced unit-numerator fraction: %s', answer => {
    expect(acceptableArithmeticAnswer(answer, '4 / 8', answer)).toBe(true)
  })

  it('still rejects multiplication by an explicit unit factor', () => {
    expect(acceptableArithmeticAnswer('1 * x', '2 / 2 * x', 'x')).toBe(false)
  })

  it.each(['10 + 2', '-4/2', '4/-2'])('rejects typing the unsimplified numeric prompt: %s', answer => {
    expect(acceptableArithmeticAnswer(answer, answer, answer === '10 + 2' ? '12' : '-2')).toBe(false)
  })
})
