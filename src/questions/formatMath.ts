/**
 * How maths is shown to players. Meant to be shared by every puzzle so all
 * Rooms look the same (the Power Box uses it; the multistep puzzle can too). Questions and answers are stored with "*" and "/" (that's what
 * the QuestionGenerator and the multistep solver use); only the screen
 * changes "*" to "·", the multiplication dot 7th–8th graders see in class.
 * "/" and "-" are shown as they are.
 */
export const MULTIPLY_SYMBOL = "·";

export function formatMath(text: string): string {
  return text.replace(/\*/g, MULTIPLY_SYMBOL);
}
