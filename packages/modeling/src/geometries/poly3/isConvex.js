const vec3 = require('../../maths/vec3')
const plane = require('./plane')

/**
 * Check whether the given polygon is convex.
 * @param {poly3} polygon - the polygon to interrogate
 * @returns {Boolean} true if convex
 * @alias module:modeling/geometries/poly3.isConvex
 */
const isConvex = (polygon) => {
  const vertices = polygon.vertices
  const numVertices = vertices.length
  if (numVertices > 2) {
    // note: plane ~= normal point
    const normal = plane(polygon)
    let prevPrev = vertices[numVertices - 2]
    let prev = vertices[numVertices - 1]
    for (let i = 0; i < numVertices; i++) {
      const point = vertices[i]
      if (!isConvexPoint(prevPrev, prev, point, normal)) {
        return false
      }
      prevPrev = prev
      prev = point
    }
  }
  return true
}

// calculate whether three points form a convex corner
//  prev, point, next: the 3 coordinates (Vector3D instances)
//  normal: the normal vector of the plane
const isConvexPoint = (prev, point, next, normal) => {
  const ab = vec3.subtract(vec3.create(), point, prev)
  const bc = vec3.subtract(vec3.create(), next, point)
  const crossProduct = vec3.cross(ab, ab, bc)
  const crossDotNormal = vec3.dot(crossProduct, normal)
  return crossDotNormal >= 0
}

module.exports = isConvex
