/** Convert a feet + inches height to whole centimetres (rounded). */
export function ftInToCm(ft: number, inches: number): number {
  return Math.round((ft * 12 + inches) * 2.54)
}
