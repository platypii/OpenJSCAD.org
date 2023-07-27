import test from 'ava'

import * as geom3 from '../../../geometries/geom3/index.js'
import { cube } from '../../../primitives/index.js'

import { Manifold } from './manifold.js'

test('manifold: convert a geometry to manifold and back', (t) => {
  const geometry = cube({ size: 8 })
  const manifold = new Manifold(geometry)
  const result = manifold.toGeometry()
  t.notThrows(() => geom3.validate(result))
})
