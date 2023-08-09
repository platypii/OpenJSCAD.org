
/**
 * This is the data structure of the polygons themselves. They are stored as a
 * list in sweep-line order. The left and right pointers form the polygons,
 * while the meshIdx describes the input indices that will be transferred to
 * the output triangulation. The edgeRight value represents an extra contraint
 * from the mesh Boolean algorithm.
 * @typedef {import('../../../../maths/vec2/index.js').Vec2} Vec2
 * @typedef {import('./edgePair.js').EdgePair} EdgePair
 */
export class VertAdj {
  /**
   * @param {Vec2} pos
   * @param {number} meshIdx
   * @param {number} [index]
   * @param {VertAdj} [left]
   * @param {VertAdj} [right]
   * @param {EdgePair} [eastPair]
   * @param {EdgePair} [westPair]
   */
  constructor (pos, meshIdx, index, left, right, eastPair, westPair) {
    this.pos = pos
    this.meshIdx = meshIdx // This is a global index into the manifold
    this.index = index
    this.left = left
    this.right = right
    this.eastPair = eastPair
    this.westPair = westPair
  }

  processed () {
    return this.index < 0
  }

  setSkip () {
    this.index = -2
  }

  /**
   * @param {boolean} processed
   */
  setProcessed (processed) {
    if (this.index === -2) return
    this.index = processed ? -1 : 0
  }

  isStart () {
    return (this.left.pos[1] >= this.pos[1] && this.right.pos[1] > this.pos[1]) ||
           (this.left.pos[1] === this.pos[1] && this.right.pos[1] === this.pos[1] &&
            this.left.pos[0] <= this.pos[0] && this.right.pos[0] < this.pos[0])
  }

  /**
   * @param {VertAdj} other
   * @param {number} precision
   * @returns {boolean}
   */
  isPast (other, precision) {
    return this.pos[1] > other.pos[1] + precision
  }

  copy () {
    return new VertAdj(
      this.pos,
      this.meshIdx,
      this.index,
      this.left,
      this.right,
      this.eastPair,
      this.westPair
    )
  }
}
