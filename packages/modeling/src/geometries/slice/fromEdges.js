import { connectedComponents } from '../../utils/connectedComponents.js'
import { create } from './create.js'

/**
 * Create a new slice geometry from a list of edges.
 * @param {[Vec3, Vec3][]} edges - list of edges to create outlines from
 * @returns {Slice} a new geometry
 *
 * @example
 * let geometry = fromEdges([[[0, 0, 0], [1, 0, 0]], [[1, 0, 0], [1, 1, 0]], [[1, 1, 0], [0, 0, 0]]])
 */
export const fromEdges = (edges) => {
  const components = connectedComponents(edges)
  return create(components)
}
