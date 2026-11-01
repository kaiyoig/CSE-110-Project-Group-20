import { Term, TermValue, TermOp, constantTerm } from './types'

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
}

export default MultistepSolverModel;
