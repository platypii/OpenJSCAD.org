
/*
 * Copyright 2021 The Manifold Authors
 * https://github.com/elalish/manifold
 * JS port by @platypii
 */

import { doesOverlap } from './bbox.js'
import { isInternal, isLeaf, kRoot, node2Leaf, node2Internal } from './collider.js'

/**
 * @typedef {import('./sparse.js').SparseIndices} SparseIndices
 */

/**
 * @param {boolean} allocateOnly
 * @param {boolean} selfCollision
 * @param {SparseIndices} queryTri
 * @param {object} counts
 * @param {Array} nodeBBox
 * @param {Array} internalChildren
 * @param {Array} query
 * @param {number} index
 */
export const findCollisions = (allocateOnly, selfCollision, queryTri, counts, nodeBBox) => (internalChildren, query, queryIdx) => {
  // stack cannot overflow because radix tree has max depth 30 (Morton code) + 32 (index).
  const stack = new Array(64).fill(0)
  let top = -1
  // Depth-first search
  let node = kRoot

  // same implies that this query do not have any collision
  if (!allocateOnly && counts[queryIdx] === counts[queryIdx + 1]) return

  while (true) {
    const internal = node2Internal(node)
    const child1 = internalChildren[internal][0]
    const child2 = internalChildren[internal][1]

    const traverse1 = recordCollision(allocateOnly, selfCollision, child1, query, queryIdx, queryTri, counts, nodeBBox)
    const traverse2 = recordCollision(allocateOnly, selfCollision, child2, query, queryIdx, queryTri, counts, nodeBBox)

    if (!traverse1 && !traverse2) {
      if (top < 0) break // done
      node = stack[top--] // get a saved node
    } else {
      node = traverse1 ? child1 : child2 // go here next
      if (traverse1 && traverse2) {
        stack[++top] = child2 // save the other for later
      }
    }
  }
}

/**
 * @param {boolean} allocateOnly
 * @param {boolean} selfCollision
 * @param {number} node
 * @param {object} queryObj
 * @param {number} queryIdx
 * @param {object} counts
 * @param {Array} nodeBBox
 */
const recordCollision = (allocateOnly, selfCollision, node, queryObj, queryIdx, queryTri, counts, nodeBBox) => {
  if (typeof queryObj !== 'object') throw new Error('queryObj should be a bbox')

  const overlaps = doesOverlap(nodeBBox[node], queryObj)
  if (overlaps && isLeaf(node)) {
    const leafIdx = node2Leaf(node)
    if (!selfCollision || leafIdx !== queryIdx) {
      if (allocateOnly) {
        counts[queryIdx]++
      } else {
        const pos = counts[queryIdx]++
        queryTri.p[pos] = queryIdx
        queryTri.q[pos] = leafIdx
      }
    }
  }
  return overlaps && isInternal(node) // Should traverse into node
}
