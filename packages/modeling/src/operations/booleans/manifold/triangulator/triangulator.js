import { CCW } from '../utils.js'

export class Triangulator {
  constructor (vert, precision) {
    this.reflexChain = [vert]
    this.otherSide = vert
    this.onRight = undefined
    this.trianglesOutput = 0
    this.precision = precision
  }

  numTriangles () {
    return this.trianglesOutput
  }

  /**
   * The vert, vi, must attach to the free end (specified by onRight) of the
   * polygon that has been input so far. The verts must also be processed in
   * sweep-line order to get a geometrically valid result. If not, then the
   * polygon is not monotone, as the result should be topologically valid, but
   * not geometrically. The parameter, last, must be set true only for the
   * final point, as this ensures the last triangle is output.
   */
  processVert (vi, onRight, last, triangles) {
    let vTop = this.reflexChain.slice(-1)[0]
    if (this.reflexChain.length < 2) {
      this.reflexChain.push(vi)
      this.onRight = onRight
      return
    }
    this.reflexChain.pop()
    let vj = this.reflexChain.slice(-1)[0]
    if (this.onRight === onRight && !last) {
      console.log('same chain')
      let ccw = CCW(vi.pos, vj.pos, vTop.pos, this.precision)
      while (ccw === (this.onRight ? 1 : -1) || ccw === 0) {
        this.addTriangle(triangles, vi, vj, vTop)
        vTop = vj
        this.reflexChain.pop()
        if (this.reflexChain.length === 0) break
        vj = this.reflexChain.slice(-1)[0]
        ccw = CCW(vi.pos, vj.pos, vTop.pos, this.precision)
      }
      this.reflexChain.push(vTop)
      this.reflexChain.push(vi)
    } else {
      console.log('different chain')
      this.onRight = !this.onRight
      let vLast = vTop
      while (this.reflexChain.length > 0) {
        vj = this.reflexChain.slice(-1)[0]
        this.addTriangle(triangles, vi, vLast, vj)
        vLast = vj
        this.reflexChain.pop()
      }
      this.reflexChain.push(vTop)
      this.reflexChain.push(vi)
      this.otherSide = vTop
    }
  }

  addTriangle (triangles, v0, v1, v2) {
    if (!this.onRight) [v1, v2] = [v2, v1]
    const tri = [v0.meshIdx, v1.meshIdx, v2.meshIdx]
    triangles.push(tri)
    this.trianglesOutput++
    console.log('addTri', tri)
  }
}
