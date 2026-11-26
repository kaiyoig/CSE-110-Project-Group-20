/**
 * How maths is shown to players. Meant to be shared by every puzzle so all
 * Rooms look the same (the Power Box uses it; the multistep puzzle can too). Questions and answers are stored with "*" and "/" (that's what
 * the QuestionGenerator and the multistep solver use); only the screen
 * changes "*" to "·", the multiplication dot 7th–8th graders see in class.
 * "/" and "-" are shown as they are.
 */
export const MULTIPLY_SYMBOL = "·";

/**
 * Shows maths the way it's written in class: a number times x is written
 * number first (`x * 3` reads `3x`, `x * -17` reads `-17x`), and any other
 * `*` becomes `·`. Division stays as it is (`x / 4`).
 */
export function formatMath(text: string): string {
  return text
    .replace(/\bx \* (-?\d+(?:\/\d+)?)(?![\d/])/g, "$1x")
    .replace(/\*/g, MULTIPLY_SYMBOL);
}
