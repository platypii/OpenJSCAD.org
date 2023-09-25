import * as vec2 from '../../../../maths/vec2/index.js'
import { CCW, kTolerance } from '../utils.js'
import { EdgePair } from './edgePair.js'
import { Triangulator } from './triangulator.js'
import { VertAdj } from './vertAdj.js'

/**
 * The class first turns input polygons into monotone polygons, then
 * triangulates them using the above class.
 */
export class Monotones {
  constructor (polys, precision) {
    this.precision = precision || 0
    /**
     * sweep-line list of verts
     * @type {VertAdj[]}
     */
    this.monotones = []
    /**
     * west to east monotone edges
     * @type {EdgePair[]}
     */
    this.activePairs = []
    /**
     * completed monotones
     * @type {EdgePair[]}
     */
    this.inactivePairs = []
    let bound = 0

    polys.forEach((poly) => {
      let start, last, current
      poly.forEach((point, i) => {
        this.monotones.push(new VertAdj(
          point.pos,
          point.idx
        ))
        bound = Math.max(bound, Math.abs(point[0]), Math.abs(point[1]))

        current = this.monotones[this.monotones.length - 1]
        if (i === 0) {
          start = current
        } else {
          this.link(last, current)
        }
        last = current
      })
      this.link(current, start)
    })

    if (this.precision < 0) this.precision = bound * kTolerance

    if (this.sweepForward()) return
    // this.check()

    if (this.sweepBack()) return
    // this.check()
  }

  /**
   * @returns {Vec3[]}
   */
  triangulate () {
    const triangles = []
    // Save the sweep-line order in the vert to check further down.
    let i = 1
    this.monotones.forEach((vert) => {
      vert.index = i++
    })
    let trianglesLeft = this.monotones.length
    let start = this.monotones[0]
    while (start !== undefined) {
      const triangulator = new Triangulator(start, this.precision)
      start.setProcessed(true)
      let vR = start.right
      let vL = start.left
      while (vR !== vL) {
        // Process the neighbor vert that is next in the sweep-line.
        if (vR.index < vL.index) {
          triangulator.processVert(vR, true, false, triangles)
          vR.setProcessed(true)
          vR = vR.right
        } else {
          triangulator.processVert(vL, false, false, triangles)
          vL.setProcessed(true)
          vL = vL.left
        }
      }
      triangulator.processVert(vR, true, true, triangles)
      vR.setProcessed(true)
      // validation
      if (triangulator.numTriangles() <= 0) {
        throw new Error('Monotone produced no triangles.')
      }
      trianglesLeft -= 2 + triangulator.numTriangles()
      // Find next monotone
      start = this.monotones.find((v) => !v.processed())
    }
    if (trianglesLeft !== 0) {
      throw new Error('Triangulation produced the wrong number of triangles.')
    }
    return triangles
  }

  /**
   * @param {VertAdj} left
   * @param {VertAdj} right
   */
  link (left, right) {
    left.right = right
    right.left = left
  }

  /**
   * @param {EdgePair} pair
   * @param {VertAdj} vert
   */
  setVWest (pair, vert) {
    pair.vWest = vert
    vert.eastPair = pair
  }

  /**
   * @param {EdgePair} pair
   * @param {VertAdj} vert
   */
  setVEast (pair, vert) {
    pair.vEast = vert
    vert.westPair = pair
  }

  /**
   * @param {EdgePair} westPair
   * @param {EdgePair} nextWestPair
   * @param {boolean} certain
   */
  setEastCertainty (westPair, nextWestPair, certain) {
    westPair.eastCertain = certain
    nextWestPair.westCertain = certain
  }

  /**
   * @param {VertAdj} vert
   * @param {string} type
   * @returns {EdgePair}
   */
  getPair (vert, type) {
    // merge returns westPair, as this is the one that will be removed
    return type === 'WestSide' ? vert.eastPair : vert.westPair
  }

  /**
   * @param {Vec2} p0
   * @param {Vec2} p1
   * @returns {boolean}
   */
  coincident (p0, p1) {
    const sep = vec2.subtract(vec2.create(), p0, p1)
    return vec2.dot(sep, sep) < this.precision * this.precision
  }

  /**
   * @param {VertAdj} vert
   */
  closeEnd (vert) {
    const eastPair = vert.right.eastPair
    const westPair = vert.left.westPair
    this.setVWest(eastPair, vert)
    this.setVEast(westPair, vert)
    westPair.westCertain = true
    eastPair.eastCertain = true
  }

  /**
   * This function is shared between the forward and backward sweeps and
   * determines the topology of the vertex relative to the sweep line.
   * @param {VertAdj} vert
   */
  processVert (vert) {
    const eastPair = vert.right.eastPair
    const westPair = vert.left.westPair
    if (vert.right.processed()) {
      if (vert.left.processed()) {
        const westIndex = this.activePairs.indexOf(westPair)
        if (westPair === eastPair) {
          // facing in
          this.closeEnd(vert)
          return 'End'
        } else if (westIndex !== this.activePairs.length - 1 && this.activePairs[westIndex + 1] === eastPair) {
          // facing out
          this.closeEnd(vert)
          // westPair will be removed and eastPair takes over.
          this.setVWest(eastPair, westPair.vWest)
          return 'Merge'
        } else { // not neighbors
          return 'Skip'
        }
      } else {
        if (!vert.isPast(vert.right, this.precision) &&
            !eastPair.vEast.right.isPast(vert, this.precision) &&
            vert.isPast(eastPair.vEast, this.precision) &&
            vert.pos[0] > eastPair.vEast.right.pos[0] + this.precision) {
          return 'Skip'
        }
        this.setVWest(eastPair, vert)
        return 'WestSide'
      }
    } else {
      if (vert.left.processed()) {
        if (!vert.isPast(vert.left, this.precision) &&
            !westPair.vWest.left.isPast(vert, this.precision) &&
            vert.isPast(westPair.vWest, this.precision) &&
            vert.pos[0] < westPair.vWest.left.pos[0] - this.precision) {
          return 'Skip'
        }
        this.setVEast(westPair, vert)
        return 'EastSide'
      } else {
        return 'Start'
      }
    }
  }

  /**
   * This function sweeps forward (South to North) keeping track of the
   * monotones and reordering degenerates (monotone ordering in the x-direction
   * and sweep line ordering in the y-direction). The input polygons
   * (this.monotones) is not changed during this process.
   */
  sweepForward () {
    // Reversed so that minimum element is at queue.top() / vector.back()
    const cmp = (a, b) => b.pos[1] - a.pos[1] // compare y values
    const nextAttached = [] // TODO: should be a priority queue

    const starts = this.monotones.filter((v) => v.isStart())

    starts.sort(cmp)

    const skipped = []
    let insertAt = 0

    while (insertAt < this.monotones.length) {
      // fallback for completely degenerate polygons that have no starts
      let vert = this.monotones[insertAt]

      // TODO: Use a priority queue instead of sorting
      nextAttached.sort(cmp)

      const lastStart = starts[starts.length - 1]
      if (nextAttached.length &&
          (starts.length === 0 ||
            !nextAttached[nextAttached.length - 1].isPast(lastStart, this.precision))) {
        // Prefer neighbors, which may process starts without needing a new pair
        vert = nextAttached.pop()
      } else if (starts.length > 0) {
        // Create a new pair with the next vert from the sorted list of starts
        vert = starts.pop()
      } else {
        insertAt++
      }

      if (vert.processed()) continue

      if (skipped.length !== 0 && vert.isPast(skipped[skipped.length - 1], this.precision)) {
        throw new Error('not geometrically valid, none of the skipped verts is valid')
      }

      let type = this.processVert(vert)

      let newPair = this.activePairs[this.activePairs.length - 1]
      let isHole = false
      if (type === 'Start') {
        newPair = new EdgePair(
          vert,
          vert,
          undefined,
          undefined,
          false,
          false,
          false
        )
        this.activePairs.unshift(newPair)
        this.setVWest(newPair, vert)
        this.setVEast(newPair, vert)
        const hole = this.isHole(vert)
        if (hole === 0 && this.isColinearPoly(vert)) {
          this.skipPoly(vert)
          this.activePairs.shift() // delete first element
          continue
        }
        isHole = hole > 0
      }

      const pair = this.getPair(vert, type)
      if (type !== 'Skip' && pair === undefined) {
        throw new Error('no active pair')
      }

      if (type !== 'Skip' && this.shiftEast(vert, pair, isHole)) type = 'Skip'
      if (type !== 'Skip' && this.shiftWest(vert, pair, isHole)) type = 'Skip'

      if (type === 'Skip') {
        if (insertAt >= this.monotones.length) {
          throw new Error('not geometrically valid, tried to skip final vert')
        }
        if (nextAttached.length === 0 && starts.length === 0) {
          throw new Error('not geometrically valid, tried to skip last queued vert')
        }

        skipped.push(vert)

        // If a new pair was added, remove it
        if (newPair !== undefined) {
          const newPairIndex = this.activePairs.indexOf(newPair)
          this.activePairs.splice(newPairIndex, 1)
          vert.westPair = undefined // TODO this.activePairs[this.activePairs.length - 1]
          vert.eastPair = undefined // TODO this.activePairs[this.activePairs.length - 1]
        }
        continue
      }

      if (vert === this.monotones[insertAt]) {
        insertAt++
      } else {
        // move vert to insertAt
        this.monotones.splice(insertAt, 0, ...this.monotones.splice(this.monotones.indexOf(vert), 1))
        insertAt++ // increment insertAt since we just inserted the vert before it
      }

      switch (type) {
        case 'WestSide':
          nextAttached.unshift(vert.left)
          break
        case 'EastSide':
          nextAttached.unshift(vert.right)
          break
        case 'Start':
          nextAttached.unshift(vert.left)
          nextAttached.unshift(vert.right)
          break
        case 'Merge':
          // mark merge as hole for sweep-back
          pair.vMerge = vert
        case 'End':
          this.removePair(pair)
          break
        case 'Skip':
          break
      }

      vert.setProcessed(true)

      while (skipped.length > 0) {
        starts.push(skipped.pop())
      }
    }

    return false
  }

  /**
   * This is the only function that actually changes monotones; all the rest is
   * bookkeeping. This divides polygons by connecting two verts. It duplicates
   * these verts to break the polygons, then attaches them across to each other
   * with two new edges.
   * @param {VertAdj} north
   * @param {VertAdj} south
   * @returns {VertAdj}
   */
  splitVerts (north, south) {
    // at split events, add duplicate vertices to end of list and reconnect
    // console.log(`split from ${north.meshIdx} to ${south.meshIdx}`)

    // Insert a duplicate of north at the position of north
    const northIndex = this.monotones.indexOf(north)
    const northEast = north.copy()
    this.monotones.splice(northIndex, 0, northEast)
    this.link(north.left, northEast)
    northEast.setProcessed(true)

    // Insert a duplicate of south at the next position after south
    const southIndex = this.monotones.indexOf(south)
    const southEast = south.copy()
    this.monotones.splice(southIndex + 1, 0, southEast)
    this.link(southEast, south.right)
    southEast.setProcessed(true)

    // Link the vertices
    this.link(south, north)
    this.link(northEast, southEast)

    return northEast
  }

  /**
   * This function sweeps back, splitting the input polygons
   * into monotone polygons without doing a single geometric calculation.
   * Instead everything is based on the topology saved from the forward sweep,
   * primarily the relative ordering of new monotones. Even though the sweep is
   * going back, the polygon is considered rotated, so we still refer to
   * sweeping from South to North and the pairs as ordered from West to East
   * (though this is now the opposite order from the forward sweep).
   */
  sweepBack () {
    this.monotones.forEach((vert) => vert.setProcessed(false))

    let vert
    let vertIndex = this.monotones.length
    while (vertIndex > 0) {
      if (this.monotones[vertIndex] !== vert) {
        console.log('ERROR: vertIndex mismatch', vertIndex)
      }
      vertIndex--
      vert = this.monotones[vertIndex]

      if (vert.processed()) continue

      const type = this.processVert(vert)
      if (type === 'Skip') {
        throw new Error('skip should not happen on reverse sweep')
      }

      let westPair = this.getPair(vert, type)
      if (type !== 'Start' && westPair === undefined) {
        throw new Error('no active pair')
      }

      let eastPair
      switch (type) {
        case 'Merge':
          eastPair = this.activePairs[this.activePairs.indexOf(westPair) + 1]
          if (eastPair.vMerge !== undefined) {
            vert = this.splitVerts(vert, eastPair.vMerge)
            vertIndex = this.monotones.indexOf(vert)
          }
          eastPair.vMerge = vert
          // fallthrough
        case 'End':
          this.removePair(westPair)
          // fallthrough
        case 'WestSide':
        case 'EastSide':
          if (westPair.vMerge !== undefined) {
            const eastVert = this.splitVerts(vert, westPair.vMerge)
            if (type === 'WestSide') westPair.vWest = eastVert
            westPair.vMerge = undefined
          }
          break
        case 'Start':
          // Due to sweeping in the opposite direction, east and west are
          // swapped and what was the next pair is now the previous pair and
          // begin and end are swapped.
          eastPair = westPair
          westPair = eastPair.nextPair
          const westIsLast = westPair === undefined
          const westIndex = this.activePairs.indexOf(westPair)
          // move from inactive to active
          const removed = this.inactivePairs.splice(this.inactivePairs.indexOf(eastPair), 1)
          this.activePairs.splice(westIsLast ? 0 : westIndex + 1, 0, ...removed)

          if (eastPair.vMerge === vert) { // hole
            const split = westPair.vMerge !== undefined
              ? westPair.vMerge
              : westPair.vWest.pos[1] < westPair.vEast.pos[1]
                ? westPair.vWest
                : westPair.vEast
            const eastVert = this.splitVerts(vert, split)
            // caution: after splitVerts, indices may have changed
            vertIndex = this.monotones.indexOf(vert) // TODO remove me?
            westPair.vMerge = undefined
            eastPair.vMerge = undefined
            this.setVWest(eastPair, eastVert)
            this.setVEast(eastPair, split === westPair.vEast ? eastVert.right : westPair.vEast)
            this.setVEast(westPair, vert)
          } else { // start
            this.setVWest(eastPair, vert)
            this.setVEast(eastPair, vert)
          }
          break
      }

      vert.setProcessed(true)
    }

    return false
  }

  /**
   * Remove this pair, but save it and mark the pair it was next to. When the
   * reverse sweep happens, it will be placed next to its last neighbor instead
   * of using geometry.
   * @param {EdgePair} pair
   */
  removePair (pair) {
    const pairIndex = this.activePairs.indexOf(pair)
    pair.nextPair = this.activePairs[pairIndex + 1]
    // move from active to inactive
    const removed = this.activePairs.splice(pairIndex, 1)[0]
    this.inactivePairs.push(removed)
  }

  /**
   * When vert is a Start, this determines if it is backwards (forming a void or
   * hole). Usually the first return is adequate, but if it is degenerate, the
   * function will continue to search up the neighbors until the degeneracy is
   * broken and a certain answer is returned. Like CCW, this function returns 1
   * for a hole, -1 for a start, and 0 only if the entire polygon degenerates to
   * a line.
   * @param {VertAdj} vert
   */
  isHole (vert) {
    let left = vert.left
    let right = vert.right
    let center = vert

    // TODO: if left or right is Processed(), determine from east/west
    while (left !== right) {
      if (this.coincident(left.pos, center.pos)) {
        left = left.left
        continue
      }
      if (this.coincident(right.pos, center.pos)) {
        right = right.right
        continue
      }
      if (this.coincident(left.pos, right.pos)) {
        vert = center
        center = left
        left = left.left
        if (left === right) break
        right = right.right
        continue
      }
      let isHole = CCW(right.pos, center.pos, left.pos, this.precision)
      if (center !== vert) {
        isHole += CCW(left.pos, center.pos, vert.pos, this.precision) +
                  CCW(vert.pos, center.pos, right.pos, this.precision)
      }
      if (isHole !== 0) return isHole

      const edgeLeft = vec2.subtract(vec2.create(), left.pos, center.pos)
      const edgeRight = vec2.subtract(vec2.create(), right.pos, center.pos)
      if (vec2.dot(edgeLeft, edgeRight) > 0) {
        if (vec2.dot(edgeLeft, edgeLeft) < vec2.dot(edgeRight, edgeRight)) {
          center = left
          left = left.left
        } else {
          center = right
          right = right.right
        }
      } else {
        if (left.pos[1] < right.pos[1]) {
          left = left.left
        } else {
          right = right.right
        }
      }
    }
    return 0
  }

  /**
   * If the simple polygon connected to the input vert degenerates to a single
   * line (more strict than IsHole==0), then any triangulation is admissible,
   * since every possible triangle will be degenerate.
   * @param {VertAdj} start
   * @return {boolean}
   */
  isColinearPoly (start) {
    let vert = start
    let left = start
    let right = left.right
    // Find the longest edge to improve error
    let length2 = 0
    while (right !== start) {
      const edge = vec2.subtract(vec2.create(), left.pos, right.pos)
      const l2 = vec2.dot(edge, edge)
      if (l2 > length2) {
        length2 = l2
        vert = left
      }
      left = right
      right = right.right
    }

    right = vert.right
    left = vert.left
    while (left !== vert) {
      if (CCW(left.pos, vert.pos, right.pos, this.precision) !== 0) return false
      left = left.left
    }
    return true
  }

  /**
   * Causes the verts of the simple polygon attached to the input vert to be
   * skipped during the forward and backward sweeps, causing this polygon to be
   * triangulated as though it is monotone.
   * @param {VertAdj} vert
   */
  skipPoly (vert) {
    vert.setSkip()
    let right = vert.right
    while (right !== vert) {
      right.setSkip()
      right = right.right
    }
  }

  /**
   * A backwards pair (hole) must be interior to a forwards pair for geometric
   * validity. In this situation, this function is used to swap their east edges
   * such that they become forward neighbor pairs. The outside becomes westPair
   * and inside becomes eastPair.
   * @param {EdgePair} outside
   * @param {EdgePair} inside
   */
  swapHole (outside, inside) {
    const tmp = outside.vEast
    this.setVEast(outside, inside.vEast)
    this.setVEast(inside, tmp)
    inside.eastCertain = outside.eastCertain

    let outsideIndex = this.activePairs.indexOf(outside)
    const insideIndex = this.activePairs.indexOf(inside)
    this.activePairs.splice(outsideIndex + 1, 0, ...this.activePairs.splice(insideIndex, 1))
    outsideIndex = this.activePairs.indexOf(outside) // TODO: can be determined by comparing insideIndex to outsideIndex
    this.setEastCertainty(outside, this.activePairs[outsideIndex + 1], true)
  }

  /**
   * This is the key function for handling east-west degeneracies, and is the
   * purpose of running the sweep-line forwards and backwards. If the ordering
   * of inputPair is uncertain, this function uses the edge ahead of vert to
   * check if this new bit of geometric information is enough to place the pair
   * with certainty. It can also invert the pair if it is determined to be a
   * hole, in which case the inputPair becomes the eastPair while the pair it is
   * inside of becomes the westPair.
   *
   * This function normally returns false, but will instead return true if the
   * certainties conflict, indicating this vertex is not yet geometrically valid
   * and must be skipped.
   *
   * @param {VertAdj} vert
   * @param {EdgePair} inputPair
   * @param {boolean} isHole
   */
  shiftEast (vert, inputPair, isHole) {
    if (inputPair.eastCertain) return false

    let potentialPairIndex = this.activePairs.indexOf(inputPair) + 1
    while (potentialPairIndex < this.activePairs.length) {
      const potentialPair = this.activePairs[potentialPairIndex]
      const eastOf = potentialPair.eastOf(vert, this.precision)

      // This does not trigger a skip because ShiftWest may still succeed, and
      // if not it will mark the skip.
      if (eastOf > 0 && isHole) return false

      if (eastOf >= 0 && !isHole) { // in the right place
        // move inputPair in front of potentialPair
        const inputPairIndex = this.activePairs.indexOf(inputPair)
        this.activePairs.splice(inputPairIndex, 1)
        potentialPairIndex = this.activePairs.indexOf(potentialPair) // TODO: compute deterministically
        this.activePairs.splice(potentialPairIndex, 0, inputPair)

        this.setEastCertainty(inputPair, this.activePairs[potentialPairIndex + 1], eastOf !== 0)
        return false
      }

      const outside = potentialPair.westOf(vert, this.precision)
      if (outside <= 0 && isHole) { // certainly a hole
        this.swapHole(potentialPair, inputPair)
        return false
      }
      potentialPairIndex++
    }
    if (isHole) return true

    this.activePairs.splice(this.activePairs.length, 0, ...this.activePairs.splice(this.activePairs.indexOf(inputPair), 1))
    inputPair.eastCertain = true
    return false
  }

  /**
   * Identical to the above function, but swapped to search westward instead.
   *
   * @param {VertAdj} vert
   * @param {EdgePair} inputPair
   * @param {boolean} isHole
   */
  shiftWest (vert, inputPair, isHole) {
    if (inputPair.westCertain) return false

    let potentialPairIndex = this.activePairs.indexOf(inputPair)
    while (potentialPairIndex !== 0) {
      potentialPairIndex--
      const potentialPair = this.activePairs[potentialPairIndex]
      const westOf = potentialPair.westOf(vert, this.precision)
      if (westOf > 0 && isHole) return true

      if (westOf >= 0 && !isHole) { // in the right place
        this.setEastCertainty(potentialPair, this.activePairs[potentialPairIndex + 1], westOf !== 0)
        if (potentialPairIndex + 1 !== this.activePairs.indexOf(inputPair)) {
          this.activePairs.splice(potentialPairIndex + 1, 0, ...this.activePairs.splice(this.activePairs.indexOf(inputPair), 1))
        }
        return false
      }

      const outside = potentialPair.eastOf(vert, this.precision)
      if (outside <= 0 && isHole) { // certainly a hole
        this.swapHole(potentialPair, inputPair)
        return false
      }
    }
    if (isHole) return true

    if (this.activePairs.indexOf(inputPair) !== 0) {
      this.activePairs.splice(0, 0, ...this.activePairs.splice(this.activePairs.indexOf(inputPair), 1))
    }
    inputPair.westCertain = true
    return false
  }
}
