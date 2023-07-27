import test from 'ava'

import { nearlyEqual } from '../../../../test/helpers/nearlyEqual.js'
import { geom3 } from '../../../geometries/index.js'
import { measureArea, measureVolume } from '../../../measurements/index.js'
import { cube } from '../../../primitives/index.js'
import { rotateZ, translate } from '../../../operations/transforms/index.js'
import { boolean } from './boolean3.js'

test('union of cubes should produce manifold geometry', (t) => {
  const cube1 = cube({ size: 8 })
  const cube2 = rotateZ(0.1, cube({ size: 1, center: [0, 0, 4] }))
  const result = boolean(cube2, cube1, 'add')

  t.is(measureVolume(result), 512.5)
  t.is(measureArea(result), 386)
  t.is(geom3.toPoints(result).flat().length, 16)
  t.is(geom3.toPolygons(result).length, 28)
  // t.notThrows(() => geom3.validate(result)) // TODO: fails
})

test('union of disjoint geom3 should produce manifold geometry', (t) => {
  const cube1 = cube({ size: 8 })
  const cube2 = rotateZ(0.1, cube({ size: 1, center: [0, 0, 10] }))
  const result = boolean(cube1, cube2, 'add')

  nearlyEqual(t, measureVolume(result), 513)
  nearlyEqual(t, measureArea(result), 392)
  t.is(geom3.toPoints(result).flat().length, 16)
  t.is(geom3.toPolygons(result).length, 28)
  t.notThrows(() => geom3.validate(result))
})

test('union of tetrahedron should produce manifold geometry', (t) => {
  const tetra1 = geom3.fromPoints([
    [[-1, -1, 1], [-1, 1, -1], [1, -1, -1]],
    [[1, 1, 1], [-1, 1, -1], [-1, -1, 1]],
    [[1, 1, 1], [-1, -1, 1], [1, -1, -1]],
    [[1, -1, -1], [-1, 1, -1], [1, 1, 1]]
  ])
  const tetra2 = translate([-1, -1, -1], tetra1)
  const result = boolean(tetra2, tetra1, 'add')

  nearlyEqual(t, measureVolume(result), 5.2916)
  nearlyEqual(t, measureArea(result), 26.8467)
  t.is(geom3.toPoints(result).flat().length, 30)
  t.is(geom3.toPolygons(result).length, 10)
  // t.notThrows(() => geom3.validate(result)) // TODO: fails
})
