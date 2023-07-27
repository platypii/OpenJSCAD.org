import test from 'ava'

import * as bbox from './bbox.js'

test('manifold: bbox expand', (t) => {
  const box = bbox.create()
  bbox.expand(box, [0, 0, 0])
  bbox.expand(box, [2, 2, 2])
  t.deepEqual(box, { min: [0, 0, 0], max: [2, 2, 2] })
})

test('manifold: bbox doesOverlap bbox', (t) => {
  t.true(bbox.doesOverlap({ min: [0, 0, 0], max: [2, 2, 2] }, { min: [1, 1, 1], max: [3, 3, 3] }))
  t.false(bbox.doesOverlap({ min: [-4, -4, -4], max: [-4, 4, 4] }, { min: [-0.447585, -0.547419, 3.5], max: [-0.447585, -0.547419, 4.5] }))
  t.true(bbox.doesOverlap({ min: [-4, -4, 4], max: [4, 4, 4] }, { min: [-0.447585, -0.547419, 3.5], max: [-0.447585, -0.547419, 4.5] }))
})
