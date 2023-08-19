/**
 * Find connected points from a list of sides. Works for 2D and 3D.
 *
 * @template Vec - a 2D or 3D vector
 * @param {[Vec, Vec][]} sides - list of sides to create outlines from
 * @returns {Vec[][]} list of connected points
 */
export const connectedComponents = (sides) => {
  const pointMap = toPointMap(sides) // {point: [neighbors]}
  const components = []
  while (true) {
    // Find a starting point
    const startPoint = pointMap.keys().next().value
    if (startPoint === undefined) break // all starting sides have been visited

    // Build a set of connected points from the start point
    const connectedPoints = []
    let point = startPoint
    while (true) {
      connectedPoints.push(point)
      const nextPossibleSides = pointMap.get(point)
      if (!nextPossibleSides) {
        throw new Error(`geometry is not closed at point ${point}`)
      }
      const nextPoint = pointMap.get(point).pop()
      if (nextPossibleSides.length === 0) {
        pointMap.delete(point)
      }
      point = nextPoint
      if (point === startPoint) break
    } // inner loop

    components.push(connectedPoints)
  } // outer loop
  return components
}

/*
 * Create a list of edges which SHARE points.
 * This allows the edges to be traversed in order.
 */
const toSharedPoints = (sides) => {
  const unique = new Map() // {key: point}
  const getUniquePoint = (point) => {
    const key = point.toString()
    if (unique.has(key)) {
      return unique.get(key)
    } else {
      unique.set(key, point)
      return point
    }
  }

  return sides.map((side) => side.map(getUniquePoint))
}

/*
 * Convert a list of sides into a map from point to neighbors.
 */
const toPointMap = (sides) => {
  const pointMap = new Map()
  // first map to edges with shared vertices
  const edges = toSharedPoints(sides)
  // construct adjacent edges map
  edges.forEach((edge) => {
    if (pointMap.has(edge[0])) {
      pointMap.get(edge[0]).push(edge[1])
    } else {
      pointMap.set(edge[0], [edge[1]])
    }
  })
  return pointMap
}
