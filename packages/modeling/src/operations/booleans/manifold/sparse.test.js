import test from 'ava'

import { SparseIndices } from './sparse.js'

test('manifold: SparseIndices data structure', (t) => {
  const sparse = new SparseIndices(1)
  sparse.set(0, 1, 2)
  t.is(sparse.length, 1)
})

test('manifold: SparseIndices unique()', (t) => {
  const sparse = new SparseIndices(4)
  sparse.set(0, 1, 2)
  sparse.set(1, 10, 20)
  sparse.set(2, 10, 20)
  sparse.set(3, 50, 100)
  t.is(sparse.length, 4)
  sparse.unique()
  t.is(sparse.length, 3)
})

test('manifold: SparseIndices binarySearch()', (t) => {
  const p1q1 = new SparseIndices(0)
  t.is(p1q1.binarySearch([0, 0]), -1)
})
