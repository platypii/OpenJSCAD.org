import test from 'ava'
import { slice } from '../../geometries/index.js'
import { cube, sphere } from '../../primitives/index.js'
import { crossSection } from './index.js'
import { comparePolygonsAsPoints } from '../../../test/helpers/index.js'

test('crossSection: no intersection', (t) => {
  const geometry = cube()
  const cutter = [0, 1, 0, 10] // plane far from geometry
  const result = crossSection({ plane: cutter }, geometry)

  t.true(slice.isA(result))
  t.is(result.contours.length, 0) // no intersection, no contours
})

test('crossSection: intersect X axis', (t) => {
  const geometry = cube()
  const cutter = [1, 0, 0, 0] // cut through X axis
  const result = crossSection({ plane: cutter }, geometry)

  const exp = [[
    [0, -1, -1],
    [0, -1, 1],
    [0, 1, 1],
    [0, 1, -1]
  ]]
  t.notThrows(() => slice.validate(result))
  t.true(comparePolygonsAsPoints(result.contours, exp))
})

test('crossSection: coplanar with face', (t) => {
  const geometry = cube()
  const cutter = [0, 0, 1, 1] // top Z face plane
  const result = crossSection({ plane: cutter }, geometry)

  const exp = [[
    [-1, -1, 1],
    [-1, 1, 1],
    [1, 1, 1],
    [1, -1, 1]
  ]]
  t.notThrows(() => slice.validate(result))
  t.true(comparePolygonsAsPoints(result.contours, exp))
})

test('crossSection: sphere', (t) => {
  const geometry = sphere({ segments: 6 })
  const cutter = [0, 0, 1, 0.1]
  const result = crossSection({ plane: cutter }, geometry)
  // if intersections for opposing edges are not symmetric, there will be gaps
  t.notThrows(() => slice.validate(result))
})
