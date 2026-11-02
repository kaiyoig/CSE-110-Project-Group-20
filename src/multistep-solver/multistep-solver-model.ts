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

    // The first term in a statement must be a value, not an operator
    if (topIndex < 0 && isTermOperator)
      return false;
    else if (topIndex < 0)
      return true;

    let top = side.at(topIndex);

    if (typeof top == "string" && isTermOperator) return false;
    if (typeof top != "string" && !isTermOperator) return false;

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

  // TODO: If there is only single term on side with - sign prefix, then allow user to drag -
  //       and 
  private moveFromSide(current: Array<Term>, index: number, newSide: Array<Term>) {
    if (current.length == 0) {
      throw Error("Unable to move left term at specified index.");
    }

    if (current.length == 1) {
      let value = current.pop() as TermValue;

      if (value.term == '0') {
        current.push(value);
        return;
      }

      const op: TermOp = value.positive ? '-' : '+';
      value.positive = !value.positive;

      this.pushSide(newSide, op);
      this.pushSide(newSide, value);

      return;
    }

    if (index == 0) {
      let terms = current.splice(index, 1);
      let value = terms[0] as TermValue;

      let op: TermOp = value.positive ? '-' : '+';
      value.positive = !value.positive;

      this.pushSide(newSide, op);
      this.pushSide(newSide, value);

      // If coefficient was attached to variable, move it too
      if (current[0] == '*' || current[0] == '/') {
        let terms = current.splice(0, 2);
        this.pushSide(newSide, terms[0]);
        this.pushSide(newSide, terms[1]);
      }

      return;
    }

    let terms = current.splice(index - 1, 2);

    let op = terms[0] as TermOp;
    let value = terms[1] as TermValue;
    let oppositeOp = this.getOppositeOp(op);

    if (op == '+' || op == '-') {
      value.positive = !value.positive;
      this.pushSide(newSide, oppositeOp);
      this.pushSide(newSide, value);

      if (current[index - 1] == '*' || current[index - 1] == '/') {
        let terms = current.splice(index - 1, 2);
        this.pushSide(newSide, terms[0]);
        this.pushSide(newSide, terms[1]);
      }

      return;
    }

    // Distribute multiplication/division to 'new side'
    let newArray = newSide.flatMap(term => {
      // Skip operators
      if (typeof term == 'string') return term;

      // Distribute multiplication or division to terms
      return [term, oppositeOp, value];
    });
    newSide.splice(0, newSide.length, ...newArray);

    // Distribute multiplication/division to 'current side'
    newArray = current.flatMap((term, i) => {
      // If the number multiplied or divided on both sides was a coefficient to some term,
      // no need to apply the opposite operation to that term
      if (i == index - 2) return term;

      if (typeof term == 'string') return term;
      return [term, oppositeOp, value];
    });
    current.splice(0, current.length, ...newArray);
  }

  private cleanSide(side: Array<Term>) {
    // remove trailing positive sign
    if (side[0] === '+') {
      side.splice(0, 1);
    }

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
    if (!previousOp) {
      return term.positive ? '-' : '+';
    }

    previousOp = previousOp as TermOp;

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
    let sign = 1;

    while (index < side.length) {
      const first = side[index];
      if (typeof first === 'string') {
        throw Error('Expected a value while parsing an equation side.');
      }

      const start = index;
      let variable: string | null = first.constant ? null : first.term;
      let coefficient = first.constant ? this.parseFraction(first.term) : { numerator: 1, denominator: 1 };
      // A value after + or - gets its sign from that operator. The model also
      // flips positive when a value is moved across the equals sign, so using
      // the flag here would turn `8 - 3` into `8 - -3`.
      let valueSign = start === 0 && !first.positive ? -sign : sign;
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

      if (index >= side.length) break;
      const nextOperation = side[index];
      if (nextOperation !== '+' && nextOperation !== '-') {
        throw Error('Expected an addition or subtraction operator.');
      }
      sign = nextOperation === '+' ? 1 : -1;
      index++;
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
    const hasPreviousSign = start > 0 && (side[start - 1] === '+' || side[start - 1] === '-');
    return side.slice(start, end + 1).map((term, index) => {
      if (typeof term === 'string') return term;
      const value = !term.positive && index === 0 && !hasPreviousSign
        ? `-${term.term}`
        : term.term;
      return value;
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
      const hasPreviousTerm = left.start > 0 &&
        (side[left.start - 1] === '+' || side[left.start - 1] === '-');
      const replacement = hasPreviousTerm
        ? [
          combined.sign < 0 ? '-' : '+',
          ...this.replacementTerms(combined.variable, combined.coefficient, 1),
        ] as Array<Term>
        : this.replacementTerms(combined.variable, combined.coefficient, combined.sign);

      problems.push({
        side,
        start: hasPreviousTerm ? left.start - 1 : left.start,
        end: right.end,
        text: `${this.formatTerm(side, left.start, left.end)} ${side[left.end + 1]} ${this.formatTerm(side, right.start, right.end)}`,
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
