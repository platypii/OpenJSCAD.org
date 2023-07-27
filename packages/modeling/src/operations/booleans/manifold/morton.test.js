import test from 'ava'

import { morton } from './morton.js'

test('manifold: generate morton codes', (t) => {
  const bbox = { min: [0, 0, 0], max: [1, 1, 1] }
  t.deepEqual(morton([0, 0, 0], bbox), 0)
  t.deepEqual(morton([1, 0, 0], bbox), 613566756)
  t.deepEqual(morton([1, 1, 0], bbox), 920350134)
  t.deepEqual(morton([0, 1, 0], bbox), 306783378)
  t.deepEqual(morton([0, 0.333333, 0.333333], bbox), 51130563)
  t.deepEqual(morton([0.666666, 0.333333, 0], bbox), 579479714)
  t.deepEqual(morton([0, 0.333333, 0.333333], bbox), 51130563)
})
