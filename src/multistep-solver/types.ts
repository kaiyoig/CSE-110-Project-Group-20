export type TermOp = '+' | '-' | '*' | '/';

export interface TermValue {
  term: string
  positive: boolean
  constant: boolean
}

export type Term = TermValue | TermOp;

export function constantTerm(value: number): Term {
  return {
    term: `${value}`,
    positive: value === 0 || Math.sign(value) > 0,
    constant: true
  };
}

export function variableTerm(variable: string, positive: boolean): Term {
  return {
    term: variable,
    positive,
    constant: false
  };
}
