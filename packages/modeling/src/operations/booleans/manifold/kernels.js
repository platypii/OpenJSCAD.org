/*
 * Copyright 2021 The Manifold Authors
 * https://github.com/elalish/manifold
 * JS port by @platypii
 */

import * as vec3 from '../../../maths/vec3/index.js'
import { interpolate } from './interpolate.js'
import { intersect } from './intersect.js'
import { SparseIndices } from './sparse.js'
import { isForward } from './utils.js'

/**
 * @typedef {import('./manifold.js').Halfedge} Halfedge
 * @typedef {import('./manifold.js').Manifold} Manifold
 */

/**
 * Returns true if q shadows point p in direction dir.
 * @param {number} p
 * @param {number} q
 * @param {number} dir
 */
const Shadows = (p, q, dir) => p === q ? dir < 0 : p < q

/**
 * @param {Vec3[]} vertPosP
 * @param {Manifold} inQ
 * @param {boolean} forward
 * @param {number} expandP
 * @param {Vec3[]} vertNormalP
 */
const Kernel02 = (vertPosP, inQ, forward, expandP, vertNormalP) => (p0, q2) => {
  let k = 0
  const yzzRL = [null, null]
  let shadows = false
  let closestVert = -1
  let minMetric = Infinity
  let s02 = 0
  let z02

  const posP = vertPosP[p0]
  for (let i = 0; i < 3; i++) {
    const q1 = 3 * q2 + i
    const edge = inQ.halfedge[q1]
    if (!edge) {
      throw new Error('edge is undefined')
    }
    const q1F = isForward(edge) ? q1 : edge.pairedHalfedge

    if (!forward) {
      const qVert = inQ.halfedge[q1F].startVert
      const diff = vec3.subtract(vec3.create(), posP, inQ.vertPos[qVert])
      const metric = vec3.dot(diff, diff)
      if (metric < minMetric) {
        minMetric = metric
        closestVert = qVert
      }
    }

    const syz01 = Shadow01(p0, q1F, vertPosP, inQ, expandP, vertNormalP, !forward)
    const s01 = syz01[0]
    const yz01 = syz01[1]

    if (Number.isFinite(yz01[0])) {
      s02 += s01 * (forward === isForward(edge) ? -1 : 1)
      if (k < 2 && (k === 0 || (s01 !== 0) !== shadows)) {
        shadows = s01 !== 0
        yzzRL[k++] = [yz01[0], yz01[1], yz01[1]]
      }
    }
  }

  if (s02 === 0) {
    z02 = NaN
  } else {
    const vertPos = vertPosP[p0]
    z02 = interpolate(yzzRL[0], yzzRL[1], vertPos[1])[1]
    if (forward) {
      if (!Shadows(vertPos[2], z02, expandP * vertNormalP[p0][2])) s02 = 0
    } else {
      if (!Shadows(z02, vertPos[2], expandP * vertNormalP[closestVert][2])) s02 = 0
    }
  }

  return [s02, z02]
}

/**
 * @param {Manifold} inP
 * @param {Manifold} inQ
 * @param {number} expandP
 */
const Kernel11 = (inP, inQ, expandP) => {
  const normalP = inP.vertNormal
  return (xyzz11, s11, p1, q1) => {
    let k = 0
    const pRL = [vec3.create(), vec3.create()]
    const qRL = [vec3.create(), vec3.create()]
    let shadows = false
    s11 = 0

    const p0 = [inP.halfedge[p1].startVert, inP.halfedge[p1].endVert]

    for (let i = 0; i < 2; i++) {
      const [s01, yz01] = Shadow01(p0[i], q1, inP.vertPos, inQ, expandP, normalP, false)

      if (Number.isFinite(yz01[0])) {
        s11 += s01 * (i === 0 ? -1 : 1)
        if (k < 2 && (k === 0 || (s01 !== 0) !== shadows)) {
          shadows = s01 !== 0
          pRL[k] = inP.vertPos[p0[i]]
          qRL[k] = [pRL[k][0], ...yz01]
          k++
        }
      }
    }

    const q0 = [inQ.halfedge[q1].startVert, inQ.halfedge[q1].endVert]

    for (let i = 0; i < 2; i++) {
      const [s10, yz10] = Shadow01(q0[i], p1, inQ.vertPos, inP, expandP, normalP, true)

      // If the value is NaN, then these do not overlap.
      if (Number.isFinite(yz10[0])) {
        s11 += s10 * (i === 0 ? -1 : 1)
        if (k < 2 && (k === 0 || (s10 !== 0) !== shadows)) {
          shadows = s10 !== 0
          qRL[k] = inQ.vertPos[q0[i]]
          pRL[k] = [qRL[k][0], ...yz10]
          k++
        }
      }
    }

    if (s11 === 0) { // No intersection
      xyzz11 = [NaN, NaN, NaN, NaN]
    } else {
      xyzz11 = intersect(pRL[0], pRL[1], qRL[0], qRL[1])

      const p1s = inP.halfedge[p1].startVert
      const p1e = inP.halfedge[p1].endVert

      let diff = vec3.subtract(vec3.create(), inP.vertPos[p1s], xyzz11)
      const start2 = vec3.dot(diff, diff)

      diff = vec3.subtract(vec3.create(), inP.vertPos[p1e], xyzz11)
      const end2 = vec3.dot(diff, diff)

      const dir = start2 < end2 ? normalP[p1s][2] : normalP[p1e][2]

      if (!Shadows(xyzz11[2], xyzz11[3], expandP * dir)) s11 = 0
    }

    return [xyzz11, s11]
  }
}

/**
 * @param {SparseIndices} p0q2
 * @param {number[]} s02
 * @param {number[]} z02
 * @param {SparseIndices} p1q1
 * @param {number[]} s11
 * @param {Vec4[]} xyzz11
 * @param {Manifold} inP
 * @param {Manifold} inQ
 * @param {boolean} forward
 */
const Kernel12 = (p0q2, s02, z02, p1q1, s11, xyzz11, inP, inQ, forward) => (p1, q2) => {
  // For xzyLR-[k], k==0 is the left and k==1 is the right.
  let k = 0
  const xzyLR0 = [vec3.create(), vec3.create()]
  const xzyLR1 = [vec3.create(), vec3.create()]

  // Either the left or right must shadow, but not both. This ensures the
  // intersection is between the left and right.
  let shadows = false
  let x12 = 0
  let v12 = vec3.create()

  const edge = inP.halfedge[p1]
  if (!edge) throw new Error('edge is undefined')

  for (const vert of [edge.startVert, edge.endVert]) {
    const key = forward ? [vert, q2] : [q2, vert]
    const idx = p0q2.binarySearch(key)

    if (idx !== -1) {
      const s = s02[idx]
      x12 += s * ((vert === edge.startVert) === forward ? 1 : -1)

      if (k < 2 && (k === 0 || (s !== 0) !== shadows)) {
        shadows = s !== 0
        xzyLR0[k] = [...inP.vertPos[vert]]
        ;[xzyLR0[k][1], xzyLR0[k][2]] = [xzyLR0[k][2], xzyLR0[k][1]]
        xzyLR1[k] = [...xzyLR0[k]]
        xzyLR1[k][1] = z02[idx]
        k++
      }
    }
  }

  for (let i = 0; i < 3; i++) {
    const q1 = 3 * q2 + i
    const edge = inQ.halfedge[q1]
    const q1F = isForward(edge) ? q1 : edge.pairedHalfedge
    const key = forward ? [p1, q1F] : [q1F, p1]
    const idx = p1q1.binarySearch(key)

    if (idx !== -1) { // s is implicitly zero for anything not found
      const s = s11[idx]
      x12 -= s * (isForward(edge) ? 1 : -1)

      if (k < 2 && (k === 0 || (s !== 0) !== shadows)) {
        shadows = s !== 0
        const xyzz = xyzz11[idx]
        xzyLR0[k][0] = xyzz[0]
        xzyLR0[k][1] = xyzz[2]
        xzyLR0[k][2] = xyzz[1]
        xzyLR1[k] = [...xzyLR0[k]]
        xzyLR1[k][1] = xyzz[3]

        if (!forward) {
          [xzyLR0[k][1], xzyLR1[k][1]] = [xzyLR1[k][1], xzyLR0[k][1]]
        }
        k++
      }
    }
  }

  if (x12 === 0) {
    v12 = [NaN, NaN, NaN]
  } else {
    const xzyy = intersect(xzyLR0[0], xzyLR0[1], xzyLR1[0], xzyLR1[1])
    v12[0] = xzyy[0]
    v12[1] = xzyy[2]
    v12[2] = xzyy[1]
  }

  return [x12, v12]
}

/**
 * Since this function is called from two different places, it is necessary that
 * it returns identical results for identical input to keep consistency.
 * Normally this is trivial as computers make floating-point errors, but are
 * at least deterministic. However, in the case of CUDA, these functions can be
 * compiled by two different compilers (for the CPU and GPU). We have found that
 * the different compilers can cause slightly different rounding errors, so it
 * is critical that the two places this function is called both use the same
 * compiled function (they must agree on CPU or GPU). This is now taken care of
 * by the shared policy member.
 * @param {number} p0
 * @param {number} q1
 * @param {Vec3[]} vertPosP
 * @param {Manifold} inQ
 * @param {number} expandP
 * @param {Vec3[]} normalP
 * @param {boolean} reverse
 * @returns {[number, Vec2]}
 */
const Shadow01 = (p0, q1, vertPosP, inQ, expandP, normalP, reverse) => {
  const q1s = inQ.halfedge[q1].startVert
  const q1e = inQ.halfedge[q1].endVert
  const p0x = vertPosP[p0][0]
  const q1sx = inQ.vertPos[q1s][0]
  const q1ex = inQ.vertPos[q1e][0]

  let s01 = reverse
    ? Shadows(q1sx, p0x, expandP * normalP[q1s][0]) -
                      Shadows(q1ex, p0x, expandP * normalP[q1e][0])
    : Shadows(p0x, q1ex, expandP * normalP[p0][0]) -
                      Shadows(p0x, q1sx, expandP * normalP[p0][0])

  let yz01 = [NaN, NaN]

  if (s01 !== 0) {
    yz01 = interpolate(inQ.vertPos[q1s], inQ.vertPos[q1e], vertPosP[p0][0])
    if (reverse) {
      let diff = vec3.subtract(vec3.create(), inQ.vertPos[q1s], vertPosP[p0])
      const start2 = vec3.dot(diff, diff)
      diff = vec3.subtract(vec3.create(), inQ.vertPos[q1e], vertPosP[p0])
      const end2 = vec3.dot(diff, diff)
      const dir = start2 < end2 ? normalP[q1s][1] : normalP[q1e][1]
      if (!Shadows(yz01[0], vertPosP[p0][1], expandP * dir)) s01 = 0
    } else {
      if (!Shadows(vertPosP[p0][1], yz01[0], expandP * normalP[p0][1])) s01 = 0
    }
  }

  return [s01, yz01]
}

/**
 * @param {Manifold} inP
 * @param {Manifold} inQ
 * @param {SparseIndices} p0q2
 * @param {boolean} forward
 * @param {number} expandP
 */
export const Shadow02 = (inP, inQ, p0q2, forward, expandP) => {
  const s02 = new Array(p0q2.length)
  const z02 = new Array(p0q2.length)

  const vertNormalP = forward ? inP.vertNormal : inQ.vertNormal

  const kernel = Kernel02(inP.vertPos, inQ, forward, expandP, vertNormalP)
  p0q2.forEach(([p0, q2], index) => {
    const result = forward ? kernel(p0, q2) : kernel(q2, p0)
    s02[index] = result[0]
    z02[index] = result[1]
  })

  p0q2.keepFinite(z02, s02)

  return [s02, z02]
}

/**
 * @param {SparseIndices} p1q1
 * @param {Manifold} inP
 * @param {Manifold} inQ
 * @param {number} expandP
 */
export const Shadow11 = (p1q1, inP, inQ, expandP) => {
  const s11 = new Array(p1q1.length)
  const xyzz11 = new Array(p1q1.length)

  const kernel = Kernel11(inP, inQ, expandP)

  p1q1.forEach(([p1, q1], index) => {
    const result = kernel(xyzz11[index], s11[index], p1, q1)
    xyzz11[index] = result[0]
    s11[index] = result[1]
  })

  p1q1.keepFinite(xyzz11, s11)

  return [s11, xyzz11]
}

/**
 * @param {Manifold} inP
 * @param {Manifold} inQ
 * @param {SparseIndices} p1q2
 * @param {SparseIndices} p2q1
 */
export const Filter11 = (inP, inQ, p1q2, p2q1) => {
  const p1q1 = new SparseIndices(3 * p1q2.length + 3 * p2q1.length)

  p1q2.forEach(([p, q], index) => {
    copyFaceEdges(p1q1, inQ.halfedge, p, q, index)
  })

  p1q1.swapPQ()

  p2q1.forEach(([p, q], index) => {
    copyFaceEdges(p1q1, inP.halfedge, q, p, p1q2.length + index)
  })

  p1q1.swapPQ()
  p1q1.unique()

  return p1q1
}

/**
 * @param {SparseIndices} pXq1
 * @param {Halfedge[]} halfedgesQ
 * @param {number} pX
 * @param {number} q2
 * @param {number} index
 */
const copyFaceEdges = (pXq1, halfedgesQ, pX, q2, index) => {
  const idx = 3 * index
  for (let i = 0; i < 3; i++) {
    const q1 = 3 * q2 + i
    const edge = halfedgesQ[q1]
    if (!edge) {
      console.log('edge not found', q1, q2, i, halfedgesQ.length)
    }
    if (idx + i >= pXq1.length) {
      console.log('edge out of bounds', idx, i, pXq1.length)
    }
    const pY = isForward(edge) ? q1 : edge.pairedHalfedge
    pXq1.set(idx + i, pX, pY)
  }
}

/**
 * @param {Manifold} inP
 * @param {Manifold} inQ
 * @param {number[]} s02
 * @param {SparseIndices} p0q2
 * @param {number[]} s11
 * @param {SparseIndices} p1q1
 * @param {number[]} z02
 * @param {Vec4[]} xyzz11
 * @param {SparseIndices} p1q2
 * @param {boolean} forward
 */
export const Intersect12 = (inP, inQ, s02, p0q2, s11, p1q1, z02, xyzz11, p1q2, forward) => {
  const x12 = []
  const v12 = []

  const kernel = Kernel12(p0q2, s02, z02, p1q1, s11, xyzz11, inP, inQ, forward)
  p1q2.forEach(([p1, q2], index) => {
    const result = forward ? kernel(p1, q2) : kernel(q2, p1)
    x12[index] = result[0]
    v12[index] = result[1]
  })

  p1q2.keepFinite(v12, x12)

  return [x12, v12]
}

/**
 * @param {Manifold} inP
 * @param {SparseIndices} p0q2
 * @param {number[]} s02
 * @param {boolean} reverse
 */
export const Winding03 = (inP, p0q2, s02, reverse) => {
  // verts that are not shadowed (not in p0q2) have winding number zero.
  let w03 = new Array(inP.vertPos.length).fill(0)

  // sort p0q2 by key
  if (!p0q2.isSorted()) {
    p0q2.sort(s02)
  }

  // generate winding numbers
  const [w03vert, w03val] = p0q2.reduceByKey(reverse, s02)

  // scatter from w03val by map w03vert into w03
  w03vert.forEach((index, i) => {
    w03[index] = w03val[i]
  })

  if (reverse) {
    w03 = w03.map((val) => -val)
  }

  return w03
}
