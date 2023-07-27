import test from 'ava'

import { intersect } from './intersect.js'

test('manifold: intersect() should return proper point', (t) => {
  t.deepEqual(intersect([0, 0, 0], [1, 1, 0], [0, 1, 0], [1, 0, 0]), [0.5, 0.5, 0, 0]) // z=0
  t.deepEqual(intersect([0, 0, 3], [1, 1, 3], [0, 1, 4], [1, 0, 4]), [0.5, 0.5, 3, 4]) // diff planes
  t.deepEqual(intersect([0, 0, 3], [2, 4, 3], [0, 1, 4], [2, 0, 4]), [0.4, 0.8, 3, 4])
  t.deepEqual(intersect([0, 0, 3], [2, 1, 3], [0, 2, 4], [2, -2, 4]), [0.8, 0.4, 3, 4]) // transpose
  t.deepEqual(intersect([0, 0, 3], [3, 10, 3], [0, 7, 4], [3, 0, 4]), [1.2352941176470589, 4.117647058823529, 3, 4])
  t.throws(() => intersect([0, 0, 0], [1, 1, 0], [0, 1, 0], [2, 0, 0])) // range doesn't match
})
