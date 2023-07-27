/*
 * Copyright 2021 The Manifold Authors
 * https://github.com/elalish/manifold
 * JS port by @platypii
 */

import { internal2Node, leaf2Node } from './collider.js'

// Adjustable parameters
const kInitialLength = 128
const kLengthMultiple = 4

/**
 * @param {number} internal
 * @param {number[]} nodeParent
 * @param {[number, number][]} internalChildren
 * @param {number[]} leafMorton
 */
export const createRadixTree = (internal, nodeParent, internalChildren, leafMorton) => {
  /**
   * Returns the number of identical highest-order bits
   * @param {number} i
   * @param {number} j
   */
  const prefixLength = (i, j) => {
    if (j < 0 || j >= leafMorton.length) {
      return -1
    } else if (leafMorton[i] === leafMorton[j]) {
      // use index to disambiguate
      return Math.clz32(i ^ j)
    } else {
      // count-leading-zeros returns the number of identical highest-order bits
      return Math.clz32(leafMorton[i] ^ leafMorton[j])
    }
  }

  /**
   * @param {number} i
   * @returns {number}
   */
  const rangeEnd = (i) => {
    // Determine direction of range (+1 or -1)
    let dir = prefixLength(i, i + 1) - prefixLength(i, i - 1)
    dir = (dir > 0) - (dir < 0)

    // Compute conservative range length with exponential increase
    const commonPrefix = prefixLength(i, i - dir)
    let maxLength = kInitialLength
    while (prefixLength(i, i + dir * maxLength) > commonPrefix) {
      maxLength *= kLengthMultiple
    }

    // Compute precise range length with binary search
    let length = 0
    for (let step = maxLength / 2; step >= 1; step /= 2) {
      if (prefixLength(i, i + dir * (length + step)) > commonPrefix) {
        length += step
      }
    }
    return i + dir * length
  }

  /**
   * @param {number} first
   * @param {number} last
   * @returns {number}
   */
  const findSplit = (first, last) => {
    const commonPrefix = prefixLength(first, last)

    // Find the furthest object that shares more than commonPrefix bits with the first one, using binary search.
    let split = first
    let step = last - first
    do {
      step = (step + 1) >> 1 // divide by 2, rounding up
      const newSplit = split + step
      if (newSplit < last) {
        const splitPrefix = prefixLength(first, newSplit)
        if (splitPrefix > commonPrefix) split = newSplit
      }
    } while (step > 1)
    return split
  }

  // Find the range of objects with a common prefix
  let first = internal
  let last = rangeEnd(first)
  if (first > last) [first, last] = [last, first]

  // Determine where the next-highest difference occurs
  let split = findSplit(first, last)
  const child1 = split === first ? leaf2Node(split) : internal2Node(split)
  split++
  const child2 = split === last ? leaf2Node(split) : internal2Node(split)

  if (child1 >= nodeParent.length) {
    console.log('ERROR child1 >= nodeParent.length')
  }
  if (child2 >= nodeParent.length) {
    console.log('ERROR child2 >= nodeParent.length')
  }

  // Record parent child relationships
  internalChildren[internal] = [child1, child2]
  const node = internal2Node(internal)
  nodeParent[child1] = node
  nodeParent[child2] = node
}
