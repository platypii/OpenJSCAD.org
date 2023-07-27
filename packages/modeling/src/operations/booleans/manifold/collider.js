/*
 * Copyright 2021 The Manifold Authors
 * https://github.com/elalish/manifold
 * JS port by @platypii
 */

import * as bbox from './bbox.js'
import { createRadixTree } from './createRadixTree.js'
import { findCollisions } from './findCollisions.js'
import { SparseIndices } from './sparse.js'

export const internal2Node = (internal) => internal * 2 + 1
export const isLeaf = (node) => node % 2 === 0
export const isInternal = (node) => node % 2 === 1
export const leaf2Node = (leaf) => leaf * 2
export const node2Internal = (node) => (node - 1) / 2
export const node2Leaf = (node) => node / 2

// Fundamental constants
export const kRoot = 1

const selfCollision = false

/**
 * @typedef {{ min: Vec3, max: Vec3 }} BBox
 */
export class Collider {
  /**
   * Creates a Bounding Volume Hierarchy (BVH) from an input set of axis-aligned
   * bounding boxes and corresponding Morton codes. It is assumed these vectors
   * are already sorted by increasing Morton code.
   * @param {BBox[]} leafBB - face bounding boxes
   * @param {number[]} leafMorton - face morton codes
   */
  constructor (leafBB, leafMorton) {
    if (leafBB.length !== leafMorton.length) throw new Error('Vectors must be the same length')
    const numNodes = 2 * leafBB.length - 1
    console.log('Collider', leafBB.length, 'numNodes', numNodes)

    // assign and allocate members
    this.nodeBBox = new Array(numNodes).fill().map(() => bbox.create())
    this.nodeParent = new Array(numNodes).fill(-1)
    this.internalChildren = new Array(leafBB.length - 1).fill([-1, -1])

    // organize tree
    this.internalChildren.forEach((_, i) => {
      createRadixTree(i, this.nodeParent, this.internalChildren, leafMorton)
    })

    this.updateBoxes(leafBB)
  }

  /**
   * For a vector of query objects, this returns a sparse array of overlaps
   * between the queries and the bounding boxes of the collider. Queries are
   * normally axis-aligned bounding boxes. Points can also be used, and this case
   * overlaps are defined as lying in the XY projection of the bounding box. If
   * the query vector is the leaf vector, set selfCollision to true, which will
   * then not report any collisions between an index and itself.
   * @param {Array} queriesIn - array of queries
   */
  collisions (queriesIn) {
    // note that the length is 1 larger than the number of queries so the last
    // element can store the sum when using exclusive scan
    const counts = Array(queriesIn.length + 1).fill(0)

    // compute the number of collisions to determine the size for allocation and
    // offset, this avoids the need for atomic
    let fc = findCollisions(true, selfCollision, [], counts, this.nodeBBox)
    queriesIn.forEach((query, index) => {
      fc(this.internalChildren, query, index)
    })

    // compute start index for each query and total count
    let sum = 0
    counts.forEach((count, i) => {
      counts[i] = sum
      sum += count
    })

    const queryTri = new SparseIndices(counts[counts.length - 1])

    // actually recording collisions
    fc = findCollisions(false, selfCollision, queryTri, counts, this.nodeBBox)
    queriesIn.forEach((query, index) => {
      fc(this.internalChildren, query, index)
    })

    return queryTri
  }

  /**
   * Recalculate the collider's internal bounding boxes without changing the
   * hierarchy.
   * @param {BBox[]} leafBB - face bounding boxes
   */
  updateBoxes (leafBB) {
    if (leafBB.length !== this.numLeaves()) {
      throw new Error('must have the same number of updated boxes as original')
    }

    // copy in leaf nodes
    for (let i = 0; i < leafBB.length; i++) {
      this.nodeBBox[i * 2] = leafBB[i]
    }

    // create global counters
    this.counter = Array(this.numInternal()).fill(0)

    // iterate over leaves to save internal Boxes
    for (let i = 0; i < this.numLeaves(); i++) {
      this.buildInternalBoxes(i)
    }
  }

  /**
   * @param {number} leaf - leaf index
   */
  buildInternalBoxes (leaf) {
    let node = leaf2Node(leaf)
    do {
      if (this.nodeParent[node] === -1) {
        console.log(`ERROR nodeParent[${node}] == -1`, leaf)
        console.log('parents', this.nodeParent)
      }
      node = this.nodeParent[node]
      const internal = node2Internal(node)
      if (this.counter[internal]++ === 0) return
      const children = this.internalChildren[internal]
      this.nodeBBox[node] = bbox.union(this.nodeBBox[children[0]], this.nodeBBox[children[1]])
    } while (node !== kRoot)
  }

  numInternal () {
    return this.internalChildren.length
  }

  numLeaves () {
    return this.internalChildren.length + 1
  }
}
