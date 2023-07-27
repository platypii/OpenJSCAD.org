import * as vec2 from '../../../maths/vec2/index.js'
import * as vec3 from '../../../maths/vec3/index.js'

/**
 * Permutes an array according to a given permutation.
 * @param {Array} array - The array to permute.
 * @param {number[]} permutation - The permutation.
 */
export const permute = (array, permutation) => {
  const copy = [...array]
  permutation.forEach((_, i) => {
    array[i] = copy[permutation[i]]
  })
}

/**
 * @param {object} options
 * @param {number} options.startVert
 * @param {number} options.endVert
 * @returns {boolean}
 */
export const isForward = ({ startVert, endVert }) => startVert < endVert

/**
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export const absSum = (a, b) => Math.abs(a) + Math.abs(b)

/**
 * @param {Vec2} p0
 * @param {Vec2} p1
 * @param {Vec2} p2
 * @param {number} tol - tolerance value for colinearity
 * @returns {number} returns 1 for CCW, -1 for CW, and 0 if within tol of colinear
 */
export const CCW = (p0, p1, p2, tol) => {
  const v1 = vec2.subtract(vec2.create(), p1, p0)
  const v2 = vec2.subtract(vec2.create(), p2, p0)
  const area = v1[0] * v2[1] - v1[1] * v2[0]
  const base2 = Math.max(vec2.dot(v1, v1), vec2.dot(v2, v2))
  if (area * area * 4 <= base2 * tol * tol) return 0
  return area > 0 ? 1 : -1
}

/**
 * By using the closest axis-aligned projection to the normal instead of a
 * projection along the normal, we avoid introducing any rounding error.
 * @typedef {[[number, number], [number, number], [number, number]]} Mat3x2
 * @param {Vec3} normal
 * @returns {Mat3x2} a 3x2 matrix
 */
export const getAxisAlignedProjection = (normal) => {
  const absNormal = vec3.abs(vec3.create(), normal)
  let xyzMax
  /**
   * @type {Mat3x2}
   */
  const projection = [
    [0, 0],
    [0, 0],
    [0, 0]
  ]
  if (absNormal[2] > absNormal[0] && absNormal[2] > absNormal[1]) {
    projection[0][0] = 1
    projection[1][1] = 1
    xyzMax = normal[2]
  } else if (absNormal[1] > absNormal[0]) {
    projection[0][1] = 1
    projection[2][0] = 1
    xyzMax = normal[1]
  } else {
    projection[1][0] = 1
    projection[2][1] = 1
    xyzMax = normal[0]
  }
  if (xyzMax < 0) {
    projection[0][0] *= -1
    projection[1][0] *= -1
    projection[2][0] *= -1
  }
  return projection
}

/**
 * Mat3x2 dot Vec3 = Vec2
 * @param {Mat3x2} mat32
 * @param {Vec3} vec
 * @returns {Vec2}
 */
export const dot = (mat32, vec) => vec2.fromValues(
  mat32[0][0] * vec[0] + mat32[1][0] * vec[1] + mat32[2][0] * vec[2],
  mat32[0][1] * vec[0] + mat32[1][1] * vec[1] + mat32[2][1] * vec[2]
)
