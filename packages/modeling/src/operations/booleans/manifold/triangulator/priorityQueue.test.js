import test from 'ava'

import { PriorityQueue } from './priorityQueue.js'

test('manifold: PriorityQueue matches std priority_queue behavior', (t) => {
  const pq = new PriorityQueue()
  pq.push(20)
  t.deepEqual(pq.heap, [20])
  pq.push(30)
  t.deepEqual(pq.heap, [20, 30])
  pq.push(15)
  t.deepEqual(pq.heap, [15, 30, 20])
  pq.push(40)
  t.deepEqual(pq.heap, [15, 30, 20, 40])
  pq.push(5)
  t.deepEqual(pq.heap, [5, 15, 20, 40, 30])
  t.is(pq.pop(), 5)
  t.deepEqual(pq.heap, [15, 30, 20, 40])
  t.is(pq.pop(), 15)
  t.deepEqual(pq.heap, [20, 30, 40])
  t.is(pq.pop(), 20)
  t.deepEqual(pq.heap, [30, 40])
  t.is(pq.pop(), 30)
  t.deepEqual(pq.heap, [40])
  t.is(pq.pop(), 40)
  t.deepEqual(pq.heap, [])
})

test('manifold: PriorityQueue nextAttached behavior', (t) => {
  const cmp = (a, b) => b.pos[1] < a.pos[1] // compare y values
  const pq = new PriorityQueue(cmp)
  pq.push({ pos: [-1, 1], meshIdx: 21 })
  pq.push({ pos: [1, 1], meshIdx: 2 })
  pq.push({ pos: [1, 1], meshIdx: 28 })
  t.deepEqual(pq.heap, [
    { pos: [-1, 1], meshIdx: 21 },
    { pos: [1, 1], meshIdx: 2 },
    { pos: [1, 1], meshIdx: 28 }
  ])
  t.deepEqual(pq.pop(), {pos: [-1, 1], meshIdx: 21 })
  t.deepEqual(pq.heap, [
    { pos: [1, 1], meshIdx: 2 },
    { pos: [1, 1], meshIdx: 28 }
  ])
  t.deepEqual(pq.top(), {pos: [1, 1], meshIdx: 2 })
  t.deepEqual(pq.pop(), {pos: [1, 1], meshIdx: 2 })
  t.deepEqual(pq.pop(), {pos: [1, 1], meshIdx: 28 })
  t.deepEqual(pq.heap, [])
})
