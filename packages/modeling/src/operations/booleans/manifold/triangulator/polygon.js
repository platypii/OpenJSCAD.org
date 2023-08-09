import { Monotones } from './monotones.js'

/**
 * Triangulates a set of &epsilon;-valid polygons. If the input is not
 * &epsilon;-valid, the triangulation may overlap, but will always return a
 * manifold result that matches the input edge directions.
 *
 * @param {Array} polys the set of polygons, wound CCW and representing multiple
 * polygons and/or holes. These have 2D-projected positions as well as
 * references back to the original vertices.
 * @param {number} precision the value of &epsilon;, bounding the uncertainty of the
 * input.
 * @return {Vec3[]} the triangles, referencing the original vertex indicies.
 */
export const triangulateIdx = (polys, precision) => {
  const monotones = new Monotones(polys, precision)
  return monotones.triangulate()
}
