const plane = require('../../maths/plane')
const vec2 = require('../../maths/vec2')

/**
 * Check whether the given polygon is convex.
 * @param {poly2} polygon - the polygon to interrogate
 * @returns {Boolean} true if convex
 * @alias module:modeling/geometries/poly2.isConvex
 */
const isConvex = (polygon) => {
  const points = polygon.points
  const numPoints = points.length
  if (numPoints > 2) {
    let prevPrev = points[numPoints - 2]
    let prev = points[numPoints - 1]
    for (let i = 0; i < numPoints; i++) {
      const point = points[i]
      if (!isConvexPoint(prevPrev, prev, point)) {
        return false
      }
      prevPrev = prev
      prev = point
    }
  }
  return true
}

// calculate whether three points form a convex corner
// prev, point, next: the 3 coordinates (Vector2 instances)
const isConvexPoint = (prev, point, next) => {
  const ab = vec2.subtract(vec2.create(), point, prev)
  const bc = vec2.subtract(vec2.create(), next, point)
  const crossProduct = vec2.cross(ab, ab, bc)
  return crossProduct[2] >= 0
}

module.exports = isConvex
