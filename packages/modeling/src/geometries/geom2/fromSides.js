import { connectedComponents } from '../../utils/connectedComponents.js'
import { create } from './create.js'

/**
 * Create a new 2D geometry from a list of sides.
 * @param {[Vec2, Vec2][]} sides - list of sides to create outlines from
 * @returns {Geom2} a new geometry
 *
 * @example
 * let geometry = fromSides([[[0, 0], [1, 0]], [[1, 0], [1, 1]], [[1, 1], [0, 0]]])
 */
export const fromSides = (sides) => {
  const components = connectedComponents(sides)
  return create(components)
}
