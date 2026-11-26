import { Term, TermValue, TermOp, constantTerm, variableTerm } from './types'

interface Fraction {
  numerator: number
  denominator: number
}

interface ExpressionTerm {
  start: number
  end: number
  variable: string | null
  coefficient: Fraction
  sign: number
}

interface ArithmeticProblem {
  side: Array<Term>
  start: number
  end: number
  text: string
  answer: string
  replacement: Array<Term>
}

export interface DisplayTerm {
  term: Term
  /** Index of the corresponding term in the model side. */
  modelIndex: number
  isCoefficient?: boolean
  displayText?: string
}

/** Stores and transforms the normalized terms of a multistep equation. */
class MultistepSolverModel {
  private leftSide: Array<Term> = []
  private rightSide: Array<Term> = []

  // You cannot push two operators in a row into an
  // equation. 
  //
  // Ex: "3 + -" is not a valid statement.
  private validPush(side: Array<Term>, term: Term): boolean {
    let topIndex = side.length - 1;

    let isTermOperator = typeof term == "string";

    if (isTermOperator && (term === '+' || term === '-')) return false;

    // The first term in a statement must be a value, not an operator
    if (topIndex < 0 && isTermOperator)
      return false;
    else if (topIndex < 0)
      return true;

    let top = side.at(topIndex);

    if (typeof top == "string" && isTermOperator) return false;
    if (typeof top == "string" && !isTermOperator && top !== '*' && top !== '/') return false;
    if (typeof top != "string" && !isTermOperator) return true;

    return true;
  }

  private pushSide(side: Array<Term>, term: Term) {
    let sideStr = side == this.leftSide ? "left" : "right";
    if (!this.validPush(side, term)) {
      throw Error(`Invalid push to ${sideStr} side of equation!`);
    }
    // Keep the model in the same form the view presents. Dividing by a unit
    // reciprocal is multiplication by its reciprocal (x / 1/3 -> x * 3).
    if (typeof term !== 'string' && term.constant && side.at(-1) === '/') {
      const parts = term.term.split('/')
      if (parts.length === 2 && Math.abs(Number(parts[0])) === 1 && Number(parts[1]) !== 0) {
        side[side.length - 1] = '*'
        side.push({
          term: `${Math.abs(Number(parts[1]))}`,
          positive: term.positive === (Number(parts[0]) > 0),
          constant: true,
        })
        return
      }
    }
    side.push(term);
  }

  private getOppositeOp(op: TermOp): TermOp {
    switch (op) {
      case '+':
        return '-';
      case '-':
        return '+';
      case '*':
        return '/';
      case '/':
        return '*';
    }
  }

  private distributeFactor(side: Array<Term>, operation: TermOp, value: TermValue, skipFirst: boolean): void {
    const expressions = this.expressionTerms(side)
    const distributed = expressions.flatMap((expression, expressionIndex) => {
      const terms = side.slice(expression.start, expression.end + 1)
      if (skipFirst && expressionIndex === 0) return terms
      return [...terms, operation, value]
    })
    side.splice(0, side.length, ...distributed)
  }

  private moveLeadingCoefficient(current: Array<Term>, index: number, newSide: Array<Term>): void {
    const value = current[index]
    if (typeof value === 'string' || current[index + 1] !== '*') {
      throw Error('Cannot move the selected coefficient.')
    }

    // Transfer a leading coefficient's sign with the coefficient. Otherwise
    // `-9 * x` becomes `-x / -9`, representing the negative sign twice.
    const movesNegativeSign = !value.positive

    current.splice(index, 2)
    if (movesNegativeSign) {
      const variable = current.find(term => typeof term !== 'string' && !term.constant)
      if (variable && typeof variable !== 'string') variable.positive = true
    }
    const operation = this.getOppositeOp('*')
    this.distributeFactor(current, operation, value, true)
    this.distributeFactor(newSide, operation, value, false)
  }

  /** Puts a multiplier before a divisor so the raw model matches its display. */
  private normalizeMovedFactors(side: Array<Term>): void {
    for (let index = 0; index + 4 < side.length; ++index) {
      const divisor = side[index + 2]
      const multiplier = side[index + 4]
      if (side[index + 1] !== '/' || side[index + 3] !== '*' ||
        typeof side[index] === 'string' || typeof divisor === 'string' ||
        typeof multiplier === 'string' || !divisor.constant || !multiplier.constant) continue

      side.splice(index + 1, 4, '*', multiplier, '/', divisor)
      index += 2
    }
  }

  private moveNegativeTrailingFactorBeforeVariable(side: Array<Term>): void {
    for (let index = 0; index + 4 < side.length; ++index) {
      const leading = side[index]
      const variable = side[index + 2]
      const trailing = side[index + 4]
      if (side[index + 1] === '*' && side[index + 3] === '*' &&
        typeof leading !== 'string' && leading.constant &&
        typeof variable !== 'string' && !variable.constant &&
        typeof trailing !== 'string' && trailing.constant && !trailing.positive) {
        side.splice(index, 5, leading, '*', trailing, '*', variable)
        index += 4
      }
    }
  }

  private moveFromSide(current: Array<Term>, index: number, newSide: Array<Term>, isCoefficient = false) {
    if (current.length === 0 || index < 0 || index >= current.length) {
      throw Error("Unable to move term at specified index.");
    }

    const selected = current[index];
    if (typeof selected === 'string') throw Error("Can only move a value term.");
    if (selected.term === '0' && current.length === 1) return;

    const previous = current[index - 1];
    let value: TermValue = selected;
    if (isCoefficient) {
      const expression = this.expressionTerms(current).find(candidate =>
        index >= candidate.start && index <= candidate.end,
      );
      if (expression) {
        // A displayed coefficient belongs to the complete signed term. Thus
        // the 4 in -x / 4 is dragged as -4, not as an unsigned divisor.
        value = {
          ...value,
          positive: this.expressionSign(expression) >= 0,
        };
      }
    }
    if (isCoefficient && previous !== '*' && previous !== '/') {
      this.moveLeadingCoefficient(current, index, newSide)
      return
    }
    if (previous === '*' || previous === '/') {
      const oppositeOp = this.getOppositeOp(previous);
      current.splice(index - 1, 2);

      // When the selected coefficient represents the complete signed
      // variable term, its sign moves with it. Clear that sign from the
      // variable left behind, otherwise `-9 * x` can become `-x / -9`.
      if (isCoefficient && !value.positive) {
        const variable = current.find(term => typeof term !== 'string' && !term.constant)
        if (variable && typeof variable !== 'string') variable.positive = true
      }

      const newSideArray = newSide.flatMap((term, i) => {
        if (typeof term === 'string' || newSide[i + 1] === '*' || newSide[i + 1] === '/') return term;
        return [term, oppositeOp, value];
      });
      newSide.splice(0, newSide.length, ...newSideArray);

      const currentArray = current.flatMap((term, i) => {
        if (typeof term === 'string' || current[i + 1] === '*' || current[i + 1] === '/') return term;
        if (i === index - 2) return term;
        return [term, oppositeOp, value];
      });
      current.splice(0, current.length, ...currentArray);
      if (!value.positive && oppositeOp === '*') {
        this.moveNegativeTrailingFactorBeforeVariable(newSide);
      }
      this.normalizeMovedFactors(current);
      this.normalizeMovedFactors(newSide);
      return;
    }

    let end = index;
    while (end + 2 < current.length &&
      (current[end + 1] === '*' || current[end + 1] === '/')) {
      end += 2;
    }

    const movedTerms = current.splice(index, end - index + 1);
    const firstMovedValue = movedTerms[0] as TermValue;
    firstMovedValue.positive = !firstMovedValue.positive;
    newSide.push(...movedTerms);
  }

  private cleanSide(side: Array<Term>) {
    // prevent empty side
    if (side.length == 0) {
      side.push(constantTerm(0));
      return;
    }
  }

  /** Adds a normalized term to the left side. @param term Term to add. */
  addLeft(term: Term): void {
    this.pushSide(this.leftSide, term);
  }

  /** Adds a normalized term to the right side. @param term Term to add. */
  addRight(term: Term): void {
    this.pushSide(this.rightSide, term);
  }

  /** Multiplies both sides by -1 for a sole negative variable product. @param isLeftSide Whether the selected term is on the left. */
  removeNegativeSign(isLeftSide: boolean): void {
    const side = isLeftSide ? this.leftSide : this.rightSide;
    const hasLeadingMinusOperator = side[0] === '-';
    const variableIndex = hasLeadingMinusOperator ? 1 : 0;
    const multiplicationIndex = variableIndex + 1;
    const coefficientIndex = variableIndex + 2;
    const variable = side[variableIndex];
    const isNegativeVariable = variable !== undefined && typeof variable !== 'string' &&
      !variable.constant && (hasLeadingMinusOperator || !variable.positive);

    // A lone `-x` (no coefficient) is allowed too: `-x = -9` becomes `x = 9`.
    const isLoneVariable = side.length === variableIndex + 1;
    if (!(isLoneVariable && isNegativeVariable)) {
      if (side.length !== coefficientIndex + 1 || side[multiplicationIndex] !== '*') {
        throw Error('A negative sign can only be removed from a sole negative variable term.')
      }

      const coefficient = side[coefficientIndex];
      if (!isNegativeVariable || typeof coefficient === 'string' || !coefficient.constant) {
        throw Error('A negative sign can only be removed from a sole negative variable term.')
      }
    }

    for (const equationSide of [this.leftSide, this.rightSide]) {
      let leadingSignRemoved = false;
      if (equationSide[0] === '-') {
        equationSide.splice(0, 1);
        leadingSignRemoved = true;
        const firstValue = equationSide[0] as unknown as TermValue | undefined;
        if (firstValue && typeof firstValue !== 'string') firstValue.positive = true;
      }

      for (let index = 0; index < equationSide.length; ++index) {
        const term = equationSide[index];
        if (typeof term !== 'string' &&
          !(leadingSignRemoved && index === 0) &&
          (index === 0 || (equationSide[index - 1] !== '*' && equationSide[index - 1] !== '/'))) {
          term.positive = !term.positive;
        }
      }
    }
  }

  /** An independent copy of this equation, for trying changes without touching it. */
  clone(): MultistepSolverModel {
    const copy = (term: Term): Term => (typeof term === 'string' ? term : { ...term });
    const scratch = new MultistepSolverModel();
    this.leftSide.forEach(term => scratch.addLeft(copy(term)));
    this.rightSide.forEach(term => scratch.addRight(copy(term)));
    return scratch;
  }

  /** True for `x = n` or `n = x` (a lone positive variable against a lone constant). */
  isSolved(): boolean {
    const isVariable = (side: Array<Term>): boolean => {
      if (side.length !== 1) return false;
      const term = side[0];
      return typeof term !== 'string' && !term.constant && term.positive;
    };
    const isConstant = (side: Array<Term>): boolean => {
      if (side.length !== 1) return false;
      const term = side[0];
      return typeof term !== 'string' && term.constant;
    };
    return (isVariable(this.leftSide) && isConstant(this.rightSide)) ||
      (isConstant(this.leftSide) && isVariable(this.rightSide));
  }

  /** Removes all terms from both sides. */
  reset(): void {
    this.leftSide.splice(0, this.leftSide.length);
    this.rightSide.splice(0, this.rightSide.length);
  }

  /** Moves a term from the left side to the right side. @param index Model-term index. */
  moveLeftTerm(index: number, isCoefficient = false): void {
    this.moveFromSide(this.leftSide, index, this.rightSide, isCoefficient);
    this.cleanSide(this.leftSide);
  }

  /** Moves a term from the right side to the left side. @param index Model-term index. */
  moveRightTerm(index: number, isCoefficient = false): void {
    this.moveFromSide(this.rightSide, index, this.leftSide, isCoefficient);
    this.cleanSide(this.rightSide);
  }

  /** Returns the normalized left-side terms. @returns Left-side terms. */
  getLeftSide(): Array<Term> {
    return this.leftSide;
  }

  /** Returns the normalized right-side terms. @returns Right-side terms. */
  getRightSide(): Array<Term> {
    return this.rightSide;
  }

  /** Gets the operation required to move a term across the equals sign. @param index Model-term index. @param left Whether the term is on the left. @returns Required operation. */
  correctOperation(index: number, left: boolean, isCoefficient = false): TermOp {
    let side = left ? this.leftSide : this.rightSide;
    let term = side.at(index);

    if (!term) {
      throw Error("Index is not valid for specified side.");
    }

    if (typeof term == 'string') {
      throw Error("Can only gather correct operation for value term!");
    }

    term = term as TermValue;

    let previousOp = side[index - 1];
    if (isCoefficient) {
      if (previousOp === '*' || previousOp === '/') return this.getOppositeOp(previousOp)
      if (side[index + 1] === '*') return '/'
      throw Error('The selected value is not a movable coefficient.')
    }
    if (previousOp !== '*' && previousOp !== '/') {
      const expression = this.expressionTerms(side)
        .find(candidate => index >= candidate.start && index <= candidate.end);
      if (expression && expression.variable !== null) {
        // Use the sign of the complete term: it may come from the variable
        // (`-x / 2`) or from a coefficient (`-2 * x`, `x * -2`).
        const coefficientSign = expression.coefficient.numerator < 0 ? -1 : 1;
        return expression.sign * coefficientSign < 0 ? '+' : '-';
      }
      return term.positive ? '-' : '+';
    }

    return this.getOppositeOp(previousOp);
  }

  private gcd(a: number, b: number): number {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b !== 0) {
      const remainder = a % b;
      a = b;
      b = remainder;
    }
    return a || 1;
  }

  private simplifyFraction(numerator: number, denominator: number): Fraction {
    if (denominator === 0) {
      throw Error('Cannot divide by zero.');
    }

    if (denominator < 0) {
      numerator = -numerator;
      denominator = -denominator;
    }

    const divisor = this.gcd(numerator, denominator);
    return {
      numerator: numerator / divisor,
      denominator: denominator / divisor,
    };
  }

  private parseFraction(value: string): Fraction {
    const parts = value.split('/');
    if (parts.length === 1) {
      const number = Number(parts[0]);
      if (!Number.isFinite(number)) throw Error(`Invalid numeric term: ${value}`);

      const decimalPlaces = parts[0].split('.')[1]?.length ?? 0;
      const denominator = 10 ** decimalPlaces;
      return this.simplifyFraction(Math.round(number * denominator), denominator);
    }

    if (parts.length !== 2) throw Error(`Invalid fraction term: ${value}`);
    return this.simplifyFraction(Number(parts[0]), Number(parts[1]));
  }

  private addFractions(left: Fraction, right: Fraction): Fraction {
    return this.simplifyFraction(
      left.numerator * right.denominator + right.numerator * left.denominator,
      left.denominator * right.denominator,
    );
  }

  private subtractFractions(left: Fraction, right: Fraction): Fraction {
    return this.simplifyFraction(
      left.numerator * right.denominator - right.numerator * left.denominator,
      left.denominator * right.denominator,
    );
  }

  private multiplyFractions(left: Fraction, right: Fraction): Fraction {
    return this.simplifyFraction(
      left.numerator * right.numerator,
      left.denominator * right.denominator,
    );
  }

  private divideFractions(left: Fraction, right: Fraction): Fraction {
    return this.simplifyFraction(
      left.numerator * right.denominator,
      left.denominator * right.numerator,
    );
  }

  private fractionText(value: Fraction): string {
    if (value.denominator === 1) return `${value.numerator}`;
    return `${value.numerator}/${value.denominator}`;
  }

  private absoluteFraction(value: Fraction): Fraction {
    return {
      numerator: Math.abs(value.numerator),
      denominator: value.denominator,
    };
  }

  /**
   * Formats a variable term in the notation used by the solver.
   * A unit reciprocal remains a division (`x / 2`), while every other
   * coefficient is placed before the variable (`3/2 * x`).
   */
  private variableText(variable: string, coefficient: Fraction, sign: number): string {
    const signedNumerator = coefficient.numerator * sign;
    const magnitude = this.absoluteFraction(coefficient)
    if (magnitude.numerator === 0) return '0'
    if (magnitude.numerator === 1 && magnitude.denominator === 1) {
      return signedNumerator < 0 ? `-${variable}` : variable
    }
    if (magnitude.numerator === 1) {
      return `${signedNumerator < 0 ? '-' : ''}${variable} / ${magnitude.denominator}`
    }
    const coefficientText = `${signedNumerator < 0 ? '-' : ''}${this.fractionText(magnitude)}`
    return `${coefficientText} * ${variable}`
  }

  private expressionText(expression: ExpressionTerm): string {
    if (expression.variable === null) {
      const value = expression.coefficient.numerator * expression.sign
      return this.fractionText(this.simplifyFraction(value, expression.coefficient.denominator))
    }
    return this.variableText(expression.variable, expression.coefficient, expression.sign)
  }

  private expressionSign(expression: ExpressionTerm): number {
    return expression.sign * (expression.coefficient.numerator < 0 ? -1 : 1)
  }

  private expressionMagnitudeText(expression: ExpressionTerm): string {
    if (expression.variable === null) {
      return this.fractionText(this.absoluteFraction(expression.coefficient))
    }
    return this.variableText(
      expression.variable,
      this.absoluteFraction(expression.coefficient),
      1,
    )
  }

  /** Returns the side in display order without changing its operational indices. */
  getDisplaySide(isLeftSide: boolean): Array<DisplayTerm> {
    const side = isLeftSide ? this.leftSide : this.rightSide
    const expressions = this.expressionTerms(side)
    const display: Array<DisplayTerm> = []

    for (const expression of expressions) {
      // Preserve a divisor chain created by a previous solver step. Folding
      // x / 9 / 8 into x / 72 reveals the next answer in the equation.
      const rawExpression = side.slice(expression.start, expression.end + 1)
      const divisionCount = rawExpression.filter(term => term === '/').length
      const multiplicationCount = rawExpression.filter(term => term === '*').length
      const variableIndex = rawExpression.findIndex(term =>
        typeof term !== 'string' && !term.constant,
      )
      const hasConstantBeforeVariable = rawExpression
        .slice(0, variableIndex)
        .some(term => typeof term !== 'string' && term.constant)
      const hasConstantAfterVariable = rawExpression
        .slice(variableIndex + 1)
        .some(term => typeof term !== 'string' && term.constant)
      if (expression.variable !== null && divisionCount === 0 && multiplicationCount > 1) {
        // A multiplication chain is an operation history, not a finished
        // coefficient. Render its raw factors so b * x * a never becomes
        // (a*b) * x in the view.
        for (let index = expression.start; index <= expression.end; ++index) {
          display.push({ term: side[index], modelIndex: index })
        }
        continue
      }
      if (expression.variable !== null && divisionCount === 0 && multiplicationCount > 1 &&
        hasConstantBeforeVariable && (hasConstantAfterVariable ||
          rawExpression.filter(term => typeof term !== 'string' && term.constant).length > 1)) {
        const factors = rawExpression
          .map((term, index) => ({ term, index }))
          .filter(({ term }) => typeof term !== 'string' && term.constant)
        const orderedFactors = hasConstantAfterVariable ? factors.reverse() : factors
        for (const factor of orderedFactors) {
          display.push({
            term: factor.term as TermValue,
            modelIndex: expression.start + factor.index,
            isCoefficient: true,
            displayText: typeof factor.term !== 'string' && !factor.term.positive
              ? `-${factor.term.term}`
              : undefined,
          })
          display.push({ term: '*', modelIndex: expression.start + factor.index })
        }
        const variable = rawExpression[variableIndex]
        if (typeof variable !== 'string') {
          display.push({ term: variable, modelIndex: expression.start + variableIndex })
        }
        continue
      }
      if (expression.variable !== null && divisionCount > 1) {
        for (let index = expression.start; index <= expression.end; ++index) {
          display.push({ term: side[index], modelIndex: index })
        }
        continue
      }

      // Keep an unreduced coefficient visible while the user is working out
      // the arithmetic. For example, 5 * x / 10 should be shown as 5/10 * x
      // rather than x / 2. The model still evaluates the coefficient as 1/2
      // when the arithmetic answer is submitted.
      if (expression.variable !== null && divisionCount > 0) {
        const variableIndex = rawExpression.findIndex(term =>
          typeof term !== 'string' && !term.constant,
        )
        const denominatorIndex = rawExpression.findIndex((term, index) =>
          index > variableIndex && term === '/',
        )
        const leadingNumerator = variableIndex > 0 ? rawExpression[0] : undefined
        const trailingNumerator = variableIndex >= 0 && rawExpression[variableIndex + 1] === '*'
          ? rawExpression[variableIndex + 2]
          : undefined
        const numerator = leadingNumerator && typeof leadingNumerator !== 'string' && leadingNumerator.constant
          ? leadingNumerator
          : trailingNumerator && typeof trailingNumerator !== 'string' && trailingNumerator.constant
            ? trailingNumerator
            : undefined
        const denominator = numerator && rawExpression[denominatorIndex + 1]
        if (numerator && denominator && typeof denominator !== 'string') {
          const variable = rawExpression[variableIndex] as TermValue
          const numeratorIsPositive = numerator.positive === variable.positive
          const numeratorText = `${numeratorIsPositive ? '' : '-'}${numerator.term}`
          const denominatorText = `${denominator.positive ? '' : '-'}${denominator.term}`
          display.push({
            term: {
              term: `${numeratorText}/${denominatorText}`,
              positive: true,
              constant: true,
            },
            modelIndex: expression.start,
            isCoefficient: true,
          })
          display.push({ term: '*', modelIndex: expression.start })
          display.push({
            term: { term: expression.variable, positive: true, constant: false },
            modelIndex: expression.start,
          })
          continue
        }
      }

      if (expression.variable === null) {
        // Display division by a unit-numerator fraction as multiplication by
        // its reciprocal, including for constant-only expressions such as
        // `5 / 1/3`.
        if (expression.start + 2 === expression.end &&
          side[expression.start + 1] === '/' &&
          typeof side[expression.start + 2] !== 'string') {
          const divisorTerm = side[expression.start + 2]
          if (typeof divisorTerm === 'string') throw Error('Expected a divisor term.')
          const divisor = this.parseFraction(divisorTerm.term)
          if (Math.abs(divisor.numerator) === 1 && divisor.denominator !== 1) {
            display.push({ term: side[expression.start], modelIndex: expression.start })
            display.push({ term: '*', modelIndex: expression.start + 1 })
            display.push({
              term: {
                term: `${divisor.denominator}`,
                positive: divisorTerm.positive === (divisor.numerator > 0),
                constant: true,
              },
              modelIndex: expression.start + 2,
            })
            continue
          }
        }
        for (let index = expression.start; index <= expression.end; ++index) {
          display.push({ term: side[index], modelIndex: index })
        }
        continue
      }

      const coefficient = this.absoluteFraction(expression.coefficient)
      const signed = expression.sign * (expression.coefficient.numerator < 0 ? -1 : 1)
      const variable: TermValue = {
        term: expression.variable,
        positive: signed >= 0,
        constant: false,
      }

      if (coefficient.numerator === 1 && coefficient.denominator === 1) {
        display.push({ term: variable, modelIndex: expression.start })
      } else if (coefficient.numerator === 1) {
        display.push({ term: variable, modelIndex: expression.start })
        display.push({ term: '/', modelIndex: expression.start })
        display.push({
          term: { term: `${coefficient.denominator}`, positive: true, constant: true },
          modelIndex: expression.end,
          isCoefficient: true,
        })
      } else {
        const firstTerm = side[expression.start]
        const coefficientIndex = typeof firstTerm !== 'string' &&
          !firstTerm.constant ? expression.end : expression.start
        display.push({
          term: {
            term: this.fractionText(coefficient),
            positive: signed >= 0,
            constant: true,
          },
          modelIndex: coefficientIndex,
          isCoefficient: true,
        })
        display.push({ term: '*', modelIndex: expression.start })
        // Every factor represents the same movable additive term. Point the
        // variable block at the term's first raw value so selecting `x` in
        // `-2 * x` moves the whole product and preserves the coefficient sign.
        display.push({
          term: { ...variable, positive: true },
          modelIndex: expression.start,
        })
      }
    }

    return display
  }

  private expressionTerms(side: Array<Term>): Array<ExpressionTerm> {
    const terms: Array<ExpressionTerm> = [];
    let index = 0;
    let leadingSign = 1;
    const hasLeadingSign = side[0] === '+' || side[0] === '-';

    // A leading sign is unary. It is not an operation between two values,
    // so consume it before parsing the first expression term.
    if (side[0] === '+' || side[0] === '-') {
      leadingSign = side[0] === '+' ? 1 : -1;
      index = 1;
    }

    while (index < side.length) {
      const first = side[index];
      if (typeof first === 'string') {
        throw Error('Expected a value while parsing an equation side.');
      }

      const start = index;
      let variable: string | null = first.constant ? null : first.term;
      let coefficient = first.constant ? this.parseFraction(first.term) : { numerator: 1, denominator: 1 };
      let valueSign = hasLeadingSign && start === 1
        ? leadingSign
        : first.positive ? 1 : -1;
      index++;

      while (index < side.length) {
        const operation = side[index];
        if (typeof operation !== 'string' || (operation !== '*' && operation !== '/')) break;

        const next = side[index + 1];
        if (!next || typeof next === 'string') {
          throw Error('Expected a value after a multiplication or division operator.');
        }

        if (next.constant) {
          const nextValue = this.parseFraction(next.term);
          if (!next.positive) nextValue.numerator *= -1;
          coefficient = operation === '*'
            ? this.multiplyFractions(coefficient, nextValue)
            : this.divideFractions(coefficient, nextValue);
        } else if (variable === null && operation === '*') {
          variable = next.term;
          if (!next.positive) valueSign *= -1;
        } else {
          throw Error('Unsupported combination of variable terms.');
        }

        index += 2;
      }

      terms.push({
        start,
        end: index - 1,
        variable,
        coefficient,
        sign: valueSign,
      });

      if (index < side.length && typeof side[index] === 'string') {
        throw Error('Expected a value after an arithmetic term.');
      }
    }

    return terms;
  }

  private canCombine(left: ExpressionTerm, right: ExpressionTerm): boolean {
    return left.variable === right.variable;
  }

  private combine(left: ExpressionTerm, right: ExpressionTerm): { variable: string | null, coefficient: Fraction, sign: number } {
    if (!this.canCombine(left, right)) {
      throw Error('Cannot combine the selected terms.');
    }

    const leftCoefficient = left.sign < 0
      ? { numerator: -left.coefficient.numerator, denominator: left.coefficient.denominator }
      : left.coefficient;
    const rightCoefficient = right.sign < 0
      ? { numerator: -right.coefficient.numerator, denominator: right.coefficient.denominator }
      : right.coefficient;
    const coefficient = this.addFractions(leftCoefficient, rightCoefficient);

    return {
      variable: left.variable,
      coefficient: this.absoluteFraction(coefficient),
      sign: coefficient.numerator < 0 ? -1 : 1,
    };
  }

  private replacementTerms(variable: string | null, coefficient: Fraction, sign: number): Array<Term> {
    const positive = sign >= 0;
    const magnitude: TermValue = {
      term: this.fractionText(coefficient),
      positive: true,
      constant: true,
    };

    if (variable === null) {
      magnitude.positive = positive;
      return [magnitude];
    }

    return [variableTerm(variable, positive), '*', magnitude];
  }

  /** Formats a term with every value's sign, e.g. `-x * -30`. */
  private formatTerm(side: Array<Term>, start: number, end: number): string {
    return side.slice(start, end + 1).map(term => {
      if (typeof term === 'string') return term;
      return term.positive ? term.term : `-${term.term}`;
    }).join(' ');
  }

  /**
   * Formats a term that follows a `+` or `-`, which already shows the sign of
   * its first value. Negative factors after `*` or `/` keep their sign.
   */
  private formatMagnitude(side: Array<Term>, start: number, end: number): string {
    return side.slice(start, end + 1).map((term, index) => {
      if (typeof term === 'string') return term;
      return term.positive || index === 0 ? term.term : `-${term.term}`;
    }).join(' ');
  }

  private collectConstantFactorProblems(side: Array<Term>): Array<ArithmeticProblem> {
    const problems: Array<ArithmeticProblem> = [];

    for (let index = 0; index < side.length - 2; index++) {
      const left = side[index];
      const operation = side[index + 1];
      const right = side[index + 2];

      if (typeof left === 'string' || typeof right === 'string') continue;
      if (!left.constant || !right.constant) continue;
      if (operation !== '*' && operation !== '/') continue;

      // When `left` is a divisor, the next factor should combine with the opposite operator, e.g.
      // x / a / b = x / (a * b)
      // x / a * b = x / (a / b)
      const foldOperation = side[index - 1] === '/' ? this.getOppositeOp(operation) : operation;

      let leftValue = this.parseFraction(left.term);
      let rightValue = this.parseFraction(right.term);
      if (!left.positive) leftValue.numerator *= -1;
      if (!right.positive) rightValue.numerator *= -1;

      const result = foldOperation === '*'
        ? this.multiplyFractions(leftValue, rightValue)
        : this.divideFractions(leftValue, rightValue);
      const sign = result.numerator < 0 ? -1 : 1;
      const magnitude = this.absoluteFraction(result);
      const containingExpression = this.expressionTerms(side).find(expression =>
        index >= expression.start && index + 2 <= expression.end,
      );
      const hasVariableCoefficient = containingExpression?.variable !== null && containingExpression &&
        side[index - 1] === '*'
      const displayedSign = hasVariableCoefficient
        ? this.expressionSign(containingExpression)
        : sign;
      const replacement: TermValue = {
        term: this.fractionText(magnitude),
        positive: sign >= 0,
        constant: true,
      };

      const rightIsUnitNumeratorFraction = operation === '/' &&
        Math.abs(rightValue.numerator) === 1 && rightValue.denominator !== 1;
      const displayedOperation = rightIsUnitNumeratorFraction ? '*' : foldOperation;
      const displayedRight = rightIsUnitNumeratorFraction
        ? `${rightValue.numerator < 0 ? '-' : ''}${rightValue.denominator}`
        : this.formatTerm(side, index + 2, index + 2);
      const displayedLeft = this.formatTerm(side, index, index);
      const signedDisplayedLeft = hasVariableCoefficient && displayedSign < 0 &&
        !displayedLeft.trim().startsWith('-') && !displayedRight.trim().startsWith('-')
        ? `-${displayedLeft}`
        : displayedLeft;

      problems.push({
        side,
        start: index,
        end: index + 2,
        // Preserve the containing variable's sign when neither operand shows
        // it, but do not duplicate a sign already shown by an operand.
        text: `${signedDisplayedLeft} ${displayedOperation} ${displayedRight}`,
        answer: `${displayedSign < 0 ? '-' : ''}${this.fractionText(magnitude)}`,
        replacement: [replacement],
      });
    }

    return problems;
  }

  private collectProblems(side: Array<Term>): Array<ArithmeticProblem> {
    const terms = this.expressionTerms(side);
    const problems: Array<ArithmeticProblem> = this.collectConstantFactorProblems(side);

    for (let index = 0; index < terms.length - 1; index++) {
      const left = terms[index];
      const right = terms[index + 1];
      if (!this.canCombine(left, right)) continue;

      const combined = this.combine(left, right);
      const replacement = this.replacementTerms(combined.variable, combined.coefficient, combined.sign);

      problems.push({
        side,
        start: left.start,
        end: right.end,
        text: `${this.expressionText(left)} ${this.expressionSign(right) < 0 ? '-' : '+'} ${this.expressionMagnitudeText(right)}`,
        answer: combined.variable === null
          ? `${combined.sign < 0 ? '-' : ''}${this.fractionText(combined.coefficient)}`
          : this.variableText(combined.variable, combined.coefficient, combined.sign),
        replacement,
      });
    }

    return problems.sort((left, right) => left.start - right.start);
  }

  /** Finds the next arithmetic problems on both sides. @returns Problem and answer pairs. */
  arithmeticProblems(): Array<[string, string]> {
    return [...this.collectProblems(this.leftSide), ...this.collectProblems(this.rightSide)]
      .map(problem => [problem.text, problem.answer]);
  }

  /** Merges one arithmetic problem into a normalized term. @param problemIndex Problem index. */
  solve(problemIndex = 0): void {
    const problems = [...this.collectProblems(this.leftSide), ...this.collectProblems(this.rightSide)];
    if (problems.length === 0) {
      throw Error('Cannot solve an equation with no arithmetic problems.');
    }

    const problem = problems[problemIndex];
    if (!problem) {
      throw Error('Arithmetic problem index is out of range.');
    }

    problem.side.splice(
      problem.start,
      problem.end - problem.start + 1,
      ...problem.replacement,
    );
    this.cleanSide(problem.side);
  }
}

export default MultistepSolverModel;
