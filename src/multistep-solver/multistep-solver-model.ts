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

  private moveFromSide(current: Array<Term>, index: number, newSide: Array<Term>) {
    if (current.length === 0 || index < 0 || index >= current.length) {
      throw Error("Unable to move term at specified index.");
    }

    const selected = current[index];
    if (typeof selected === 'string') throw Error("Can only move a value term.");
    if (selected.term === '0' && current.length === 1) return;

    const previous = current[index - 1];
    if (previous === '*' || previous === '/') {
      const oppositeOp = this.getOppositeOp(previous);
      const value = current[index];
      current.splice(index - 1, 2);

      const newSideArray = newSide.flatMap(term => {
        if (typeof term === 'string') return term;
        return [term, oppositeOp, value];
      });
      newSide.splice(0, newSide.length, ...newSideArray);

      const currentArray = current.flatMap((term, i) => {
        if (typeof term === 'string') return term;
        if (i === index - 2) return term;
        return [term, oppositeOp, value];
      });
      current.splice(0, current.length, ...currentArray);
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

  addLeft(term: Term) {
    this.pushSide(this.leftSide, term);
  }

  addRight(term: Term) {
    this.pushSide(this.rightSide, term);
  }

  removeNegativeSign(isLeftSide: boolean): void {
    const side = isLeftSide ? this.leftSide : this.rightSide;
    const hasLeadingMinusOperator = side[0] === '-';
    const variableIndex = hasLeadingMinusOperator ? 1 : 0;
    const multiplicationIndex = variableIndex + 1;
    const coefficientIndex = variableIndex + 2;
    if (side.length !== coefficientIndex + 1 || side[multiplicationIndex] !== '*') {
      throw Error('A negative sign can only be removed from a sole negative variable term.')
    }

    const variable = side[variableIndex];
    const coefficient = side[coefficientIndex];
    if (typeof variable === 'string' || variable.constant ||
      (!hasLeadingMinusOperator && variable.positive) ||
      typeof coefficient === 'string' || !coefficient.constant) {
      throw Error('A negative sign can only be removed from a sole negative variable term.')
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

  reset() {
    this.leftSide.splice(0, this.leftSide.length);
    this.rightSide.splice(0, this.rightSide.length);
  }

  moveLeftTerm(index: number) {
    this.moveFromSide(this.leftSide, index, this.rightSide);
    this.cleanSide(this.leftSide);
  }

  moveRightTerm(index: number) {
    this.moveFromSide(this.rightSide, index, this.leftSide);
    this.cleanSide(this.rightSide);
  }

  getLeftSide(): Array<Term> {
    return this.leftSide;
  }

  getRightSide(): Array<Term> {
    return this.rightSide;
  }

  correctOperation(index: number, left: boolean): TermOp {
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
    if (previousOp !== '*' && previousOp !== '/') {
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
      const valueSign = hasLeadingSign && start === 1
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

        const nextValue = this.parseFraction(next.term);
        if (next.constant) {
          coefficient = operation === '*'
            ? this.multiplyFractions(coefficient, nextValue)
            : this.divideFractions(coefficient, nextValue);
        } else if (variable === null && operation === '*') {
          variable = next.term;
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

  private formatTerm(side: Array<Term>, start: number, end: number): string {
    return side.slice(start, end + 1).map((term, index) => {
      if (typeof term === 'string') return term;
      const value = !term.positive && index === 0
        ? `-${term.term}`
        : term.term;
      return value;
    }).join(' ');
  }

  private formatMagnitude(side: Array<Term>, start: number, end: number): string {
    return side.slice(start, end + 1).map(term => {
      if (typeof term === 'string') return term;
      return term.term;
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

      let leftValue = this.parseFraction(left.term);
      let rightValue = this.parseFraction(right.term);
      if (!left.positive) leftValue.numerator *= -1;
      if (!right.positive) rightValue.numerator *= -1;

      const result = operation === '*'
        ? this.multiplyFractions(leftValue, rightValue)
        : this.divideFractions(leftValue, rightValue);
      const sign = result.numerator < 0 ? -1 : 1;
      const magnitude = this.absoluteFraction(result);
      const replacement: TermValue = {
        term: this.fractionText(magnitude),
        positive: sign >= 0,
        constant: true,
      };

      problems.push({
        side,
        start: index,
        end: index + 2,
        text: this.formatTerm(side, index, index + 2),
        answer: `${sign < 0 ? '-' : ''}${this.fractionText(magnitude)}`,
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
        text: `${this.formatTerm(side, left.start, left.end)} ${right.sign < 0 ? '-' : '+'} ${this.formatMagnitude(side, right.start, right.end)}`,
        answer: `${combined.sign < 0 ? '-' : ''}${combined.variable === null ? this.fractionText(combined.coefficient) : `${combined.variable} * ${this.fractionText(combined.coefficient)}`}`,
        replacement,
      });
    }

    return problems.sort((left, right) => left.start - right.start);
  }

  // Returns Array<[problem string, answer string]>
  arithmeticProblems(): Array<[string, string]> {
    return [...this.collectProblems(this.leftSide), ...this.collectProblems(this.rightSide)]
      .map(problem => [problem.text, problem.answer]);
  }

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
