import * as geom3 from '../../geometries/geom3/index.js'

import { boolean } from './manifold/boolean3.js'

import { mayOverlap } from './mayOverlap.js'

/*
 * Return a new 3D geometry representing the space in the first geometry but not
 * in the second geometry. None of the given geometries are modified.
 * @param {Geom3} geometry1 - a geometry
 * @param {Geom3} geometry2 - a geometry
 * @returns {Geom3} new 3D geometry
 */
export const subtractGeom3Sub = (geometry1, geometry2) => {
  if (!mayOverlap(geometry1, geometry2)) {
    return geom3.clone(geometry1)
  }

  return boolean(geometry1, geometry2, 'subtract')
}
