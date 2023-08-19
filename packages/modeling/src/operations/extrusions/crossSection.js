import * as geom3 from '../../geometries/geom3/index.js'
import * as slice from '../../geometries/slice/index.js'
import * as plane from '../../maths/plane/index.js'
import * as vec3 from '../../maths/vec3/index.js'
import { measureEpsilon } from '../../measurements/measureEpsilon.js'
import { flatten } from '../../utils/flatten.js'

/**
 * Clip a Geom3 to a Plane.
 * @param {Plane} cutter
 * @param {Geom3} geometry
 * @returns {Slice}
 */
const crossSectionGeom3 = (cutter, geometry) => {
  // If epsilon is zero, return an empty 2D geometry
  const epsilon = measureEpsilon(geometry)
  if (epsilon === 0) return slice.create()

  const polygons = geom3.toPolygons(geometry)
  const lineMap = new Map() // remove dup edges

  for (const polygon of polygons) {
    const distances = polygon.vertices.map((v) => plane.signedDistanceToPoint(cutter, v))
    const onPlane = (i) => Math.abs(distances[i]) < epsilon
    let lastIntersection

    polygon.vertices.forEach((vert, i) => {
      const nextIndex = (i + 1) % polygon.vertices.length
      const next = polygon.vertices[nextIndex]

      if (onPlane(i) && onPlane(nextIndex)) {
        // edge lies on the plane, add whole segment
        const line = [vert, next]
        const reverse = [next, vert]
        // remove duplicate edges
        if (!lineMap.has(line.toString()) && !lineMap.has(reverse.toString())) {
          lineMap.set(line.toString(), line)
        }
        // if there are edge(s) on the plane, don't add another from lastIntersection
        lastIntersection = undefined
      } else if (distances[i] * distances[nextIndex] < 0) {
        // if both points are on different sides of the plane, calculate the intersection
        // make the intersection symmetric
        const t1 = distances[i] / (distances[i] - distances[nextIndex])
        const t2 = distances[nextIndex] / (distances[nextIndex] - distances[i])
        const intersection = t1 < t2 ?
          vec3.lerp(vec3.create(), vert, next, t1) :
          vec3.lerp(vec3.create(), next, vert, t2)

        // polygons are convex, so there can be only one in and one out point
        if (lastIntersection) {
          const line = [lastIntersection, intersection]
          lineMap.set(line.toString(), line)
        }
        lastIntersection = intersection
      }
    })
  }
  const lines = Array.from(lineMap.values())

  const output = slice.fromEdges(lines)
  if (geometry.color) output.color = geometry.color
  return output
}

/**
 * Slice the given 3D geometry with the given plane.
 * @param {object} options - options for slice
 * @param {Array} [options.plane=[0,0,1,0]] the axis of the plane (default is Z axis)
 * @param {...Object} objects - the list of 3D geometry to slice
 * @return {Slice|Array} the sliced geometry, or a list of sliced geometry
 * @alias module:modeling/extrusions.crossSection
 *
 * @example
 * let myshape = crossSection({}, cube())
 */
export const crossSection = (options, ...objects) => {
  const defaults = {
    plane: [0, 0, 1, 0] // Z axis
  }
  // the plane to cut with
  const cutter = Object.assign({}, defaults, options).plane

  if (cutter.length !== 4 || !cutter.every(Number.isFinite)) {
    throw new Error('crossSection: invalid plane')
  }

  objects = flatten(objects)

  const results = objects.map((object) => {
    if (geom3.isA(object)) return crossSectionGeom3(cutter, object)
    return object
  })
  return results.length === 1 ? results[0] : results
}
