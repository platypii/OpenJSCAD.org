/**
 * Calculates the Euclidian distance between the given vectors.
 *
 * @param {Vec4} a - first operand
 * @param {Vec4} b - second operand
 * @returns {number} distance
 * @alias module:modeling/maths/vec4.distance
 */
export const distance = (a, b) => {
  const x = b[0] - a[0]
  const y = b[1] - a[1]
  const z = b[2] - a[2]
  const w = b[3] - a[3]
  return Math.sqrt(x * x + y * y + z * z + w * w)
}
