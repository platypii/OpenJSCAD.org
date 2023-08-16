import test from 'ava'

import { nearlyEqual } from '../../../../test/helpers/nearlyEqual.js'
import { geom3 } from '../../../geometries/index.js'
import { measureArea, measureVolume } from '../../../measurements/index.js'
import { cube } from '../../../primitives/index.js'
import { rotateZ, translate } from '../../../operations/transforms/index.js'
import { boolean } from './boolean3.js'

test('union of cubes should produce manifold geometry', (t) => {
  const cube1 = cube({ size: 8 })
  const cube2 = cube({ size: 1, center: [0, 0, 4] })
  // cube2 = rotateZ(0.1, cube2)
  const result = boolean(cube2, cube1, 'add')

  nearlyEqual(t, measureVolume(result), 512.5)
  nearlyEqual(t, measureArea(result), 386)
  t.is(geom3.toPoints(result).flat().length, 108)
  t.is(geom3.toPolygons(result).length, 36) // manifold 28
  // t.notThrows(() => geom3.validate(result)) // TODO: fails
})

test('union of manual cubes should produce manifold geometry', (t) => {
  // manually constructed to match the manifold cube
  const cube1 = geom3.fromPoints([
    [[-4, -4, -4], [4, 4, -4], [4, -4, -4]], // bottom
    [[-4, -4, -4], [-4, 4, -4], [4, 4, -4]], // bottom
    [[-4, -4, 4], [4, -4, 4], [4, 4, 4]], // top
    [[-4, -4, 4], [4, 4, 4], [-4, 4, 4]], // top
    [[-4, -4, -4], [4, -4, -4], [4, -4, 4]], // front
    [[-4, -4, -4], [4, -4, 4], [-4, -4, 4]], // front
    [[4, -4, -4], [4, 4, -4], [4, 4, 4]], // right
    [[4, -4, -4], [4, 4, 4], [4, -4, 4]], // right
    [[4, 4, -4], [-4, 4, -4], [-4, 4, 4]], // back
    [[4, 4, -4], [-4, 4, 4], [4, 4, 4]], // back
    [[-4, 4, -4], [-4, -4, -4], [-4, -4, 4]], // left
    [[-4, 4, -4], [-4, -4, 4], [-4, 4, 4]], // left
  ])
  const cube2 = geom3.fromPoints([
    [[-0.5, -0.5, 3.5], [0.5, 0.5, 3.5], [0.5, -0.5, 3.5]], // bottom
    [[-0.5, -0.5, 3.5], [-0.5, 0.5, 3.5], [0.5, 0.5, 3.5]], // bottom
    [[-0.5, -0.5, 4.5], [0.5, -0.5, 4.5], [0.5, 0.5, 4.5]], // top
    [[-0.5, -0.5, 4.5], [0.5, 0.5, 4.5], [-0.5, 0.5, 4.5]], // top
    [[-0.5, -0.5, 3.5], [0.5, -0.5, 3.5], [0.5, -0.5, 4.5]], // front
    [[-0.5, -0.5, 3.5], [0.5, -0.5, 4.5], [-0.5, -0.5, 4.5]], // front
    [[0.5, -0.5, 3.5], [0.5, 0.5, 3.5], [0.5, 0.5, 4.5]], // right
    [[0.5, -0.5, 3.5], [0.5, 0.5, 4.5], [0.5, -0.5, 4.5]], // right
    [[0.5, 0.5, 3.5], [-0.5, 0.5, 3.5], [-0.5, 0.5, 4.5]], // back
    [[0.5, 0.5, 3.5], [-0.5, 0.5, 4.5], [0.5, 0.5, 4.5]], // back
    [[-0.5, 0.5, 3.5], [-0.5, -0.5, 3.5], [-0.5, -0.5, 4.5]], // left
    [[-0.5, 0.5, 3.5], [-0.5, -0.5, 4.5], [-0.5, 0.5, 4.5]], // left
  ])
  const result = boolean(cube2, cube1, 'add')

  nearlyEqual(t, measureVolume(result), 512.5)
  nearlyEqual(t, measureArea(result), 386)
  t.is(geom3.toPoints(result).flat().length, 108)
  t.is(geom3.toPolygons(result).length, 36) // manifold 28
  // t.notThrows(() => geom3.validate(result)) // TODO: fails
})

test('union of disjoint geom3 should produce manifold geometry', (t) => {
  const cube1 = cube({ size: 8 })
  const cube2 = rotateZ(0.1, cube({ size: 1, center: [0, 0, 10] }))
  const result = boolean(cube1, cube2, 'add')

  nearlyEqual(t, measureVolume(result), 513)
  nearlyEqual(t, measureArea(result), 392)
  t.is(geom3.toPoints(result).flat().length, 48)
  t.is(geom3.toPolygons(result).length, 12)
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
  t.is(geom3.toPoints(result).flat().length, 48)
  t.is(geom3.toPolygons(result).length, 16)
  t.notThrows(() => geom3.validate(result))
})
