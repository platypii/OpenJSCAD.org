import test from 'ava'

import { interpolate } from './interpolate.js'

test('manifold: interpolate() should return proper point', (t) => {
  t.deepEqual(interpolate([0, 2, 0], [1, 3, 0], 0.5), [2.5, 0]) // z=0
  t.deepEqual(interpolate([0, 2, 4], [1, 3, 5], 0.5), [2.5, 4.5])
  t.throws(() => interpolate([0, 2, 0], [1, 3, 0], 8)) // out of domain
})
