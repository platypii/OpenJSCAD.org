import { CCW } from '../utils.js'

/**
 * The EdgePairs form the two active edges of a monotone polygon as they are
 * being constructed. The sweep-line is horizontal and moves from -y to +y, or
 * South to North. The West edge is a backwards edge while the East edge is
 * forwards, a topological constraint. If the polygon is geometrically valid,
 * then the West edge will also be to the -x side of the East edge, hence the
 * name.
 *
 * The purpose of the certainty booleans is to represent if we're sure the
 * pairs (or monotones) are in the right order. This is uncertain if they are
 * degenerate, for instance if several active edges are colinear (within
 * tolerance). If the order is uncertain, then as each vert is processed, if
 * it yields new information, it can cause the order to be updated until
 * certain.
 * @typedef {import('./vertAdj.js').VertAdj} VertAdj
 */
export class EdgePair {
  /**
   * @param {VertAdj} vWest index into monotones
   * @param {VertAdj} vEast index into monotones
   * @param {VertAdj} vMerge index into monotones
   * @param {EdgePair} nextPair
   * @param {boolean} westCertain
   * @param {boolean} eastCertain
   * @param {boolean} startCertain
   */
  constructor (vWest, vEast, vMerge, nextPair, westCertain, eastCertain, startCertain) {
    this.vWest = vWest
    this.vEast = vEast
    this.vMerge = vMerge
    this.nextPair = nextPair
    this.westCertain = westCertain
    this.eastCertain = eastCertain
    this.startCertain = startCertain
  }

  /**
   * @param {VertAdj} vert
   * @param {number} precision
   * @returns {number}
   */
  westOf (vert, precision) {
    let westOf = CCW(this.vEast.right.pos, this.vEast.pos, vert.pos, precision)
    if (westOf === 0 && !vert.right.processed()) {
      westOf = CCW(this.vEast.right.pos, this.vEast.pos, vert.right.pos, precision)
    }
    if (westOf === 0 && !vert.left.processed()) {
      westOf = CCW(this.vEast.right.pos, this.vEast.pos, vert.left.pos, precision)
    }
    return westOf
  }

  /**
   * @param {VertAdj} vert
   * @param {number} precision
   * @returns {number}
   */
  eastOf (vert, precision) {
    let eastOf = CCW(this.vWest.pos, this.vWest.left.pos, vert.pos, precision)
    if (eastOf === 0 && !vert.right.processed()) {
      eastOf = CCW(this.vWest.pos, this.vWest.left.pos, vert.right.pos, precision)
    }
    if (eastOf === 0 && !vert.left.processed()) {
      eastOf = CCW(this.vWest.pos, this.vWest.left.pos, vert.left.pos, precision)
    }
    return eastOf
  }
}
