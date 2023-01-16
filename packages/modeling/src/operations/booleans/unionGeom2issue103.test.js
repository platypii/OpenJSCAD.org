import test from 'ava'

import { comparePoints } from '../../../test/helpers/index.js'

import { geom2 } from '../../geometries/index.js'

import { circle, rectangle } from '../../primitives/index.js'

import { center, translate } from '../transforms/index.js'

import { union } from './index.js'

test('union of geom2 with colinear edge (martinez issue #103)', (t) => {
  // This test is a minimal example extracted from:
  // project({ axis: [0, 1, 0], origin: [0, -1, 0] }, torus({ innerSegments: 8, outerSegments: 4 }))
  const g1 = geom2.create([[
    [400, 200], // I
    [400, 75], // H opt
    [400, 0], // G
    [310, 40], // F
    // [304.10646839831827, 87.1482528134537], // E diff bug
    [300, 120], // J
    [157.0231603224197, 105.78147219020022], // D
    // [133.6345063121441, 108.1970243647632], // C presplit no bug
    [120.44771878596228, 109.55893998720018], // B
    [100, 200], // A
  ]])
  const g2 = geom2.create([[
    [400, 200], // I
    [400, 75], // H
    [304.10646839831827, 87.1482528134537], // E opt
    [157.0231603224197, 105.78147219020022], // D
    [133.6345063121441, 108.1970243647632], // C
    [100, 200], // A
  ]])
  const exp = [
    [100, 200], // A
    [120.44771878596228, 109.55893998720018], // B
    [157.0231603224197, 105.78147219020022], // D
    [304.10646839831827, 87.1482528134537], // E
    [310, 40], // F
    [400, 0], // G
    // [400, 75], // H
    [400, 200], // I
    [100, 200], // A
  ]
  const result = union(g1, g2)
  const pts = geom2.toPoints(result)
  t.notThrows(() => geom2.validate(result))
  t.is(pts.length, 8)
  t.true(comparePoints(pts, exp))
})
