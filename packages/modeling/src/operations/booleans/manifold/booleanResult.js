/*
 * Copyright 2021 The Manifold Authors
 * https://github.com/elalish/manifold
 * JS port by @platypii
 */

/**
 * @typedef {import('./sparse.js').SparseIndices} SparseIndices
 * @typedef {import('./manifold.js').Halfedge} Halfedge
 * @typedef {{ vert: number, edgePos: number, isStart: boolean }} EdgePos
 */

import * as vec3 from '../../../maths/vec3/index.js'
import * as bbox from './bbox.js'
import { simplifyTopology } from './edgeOp.js'
import { face2Tri } from './faceOp.js'
import { Manifold } from './manifold.js'
import { absSum, isForward, meshIDCounter, reserveIDs } from './utils.js'

const intermediateChecks = true // TODO

/**
 * Construct the result manifold
 * @param {string} op - type of operation to perform
 * @param {Manifold} inP
 * @param {Manifold} inQ
 * @param {SparseIndices} p1q2
 * @param {SparseIndices} p2q1
 * @param {number[]} x12
 * @param {number[]} x21
 * @param {Vec3[]} v12
 * @param {Vec3[]} v21
 * @param {number[]} w03
 * @param {number[]} w30
 * @returns {Manifold}
 */
export const result = (op, inP, inQ, p1q2, p2q1, x12, x21, v12, v21, w03, w30) => {
  const c1 = op === 'intersect' ? 0 : 1
  const c2 = op === 'add' ? 1 : 0
  const c3 = op === 'intersect' ? 1 : -1

  if (inP.isEmpty()) {
    if (!inQ.isEmpty() && op === 'add') {
      return inQ
    }
    return new Manifold()
  } else if (inQ.isEmpty()) {
    if (op === 'intersect') {
      return new Manifold()
    }
    return inP
  }

  const invertQ = op === 'subtract'

  // Convert winding numbers to inclusion values based on operation type.
  const i12 = x12.map((x) => c3 * x)
  const i21 = x21.map((x) => c3 * x)
  const i03 = w03.map((x) => c1 + c3 * x)
  const i30 = w30.map((x) => c2 + c3 * x)

  let sum = 0
  const vP2R = []
  i03.forEach((x, i) => {
    vP2R[i] = sum
    sum = absSum(sum, x)
  })
  let numVertR = absSum(vP2R[vP2R.length - 1], i03[i03.length - 1])
  const nPv = numVertR // verts from inP

  sum = numVertR
  const vQ2R = []
  i30.forEach((x, i) => {
    vQ2R[i] = sum
    sum = absSum(sum, x)
  })
  numVertR = absSum(vQ2R[vQ2R.length - 1], i30[i30.length - 1])
  const nQv = numVertR - nPv // verts from inQ

  sum = numVertR
  const v12R = []
  if (v12.length > 0) {
    i12.forEach((x, i) => {
      v12R[i] = sum
      sum = absSum(sum, x)
    })
    numVertR = absSum(v12R[v12R.length - 1], i12[i12.length - 1])
  }
  const n12 = numVertR - nPv - nQv // new verts from edgesP -> facesQ

  sum = numVertR
  const v21R = []
  if (v21.length > 0) {
    i21.forEach((x, i) => {
      v21R[i] = sum
      sum = absSum(sum, x)
    })
    numVertR = absSum(v21R[v21R.length - 1], i21[i21.length - 1])
  }
  const n21 = numVertR - nPv - nQv - n12 // new verts from facesP -> edgesQ

  // Create the output Manifold
  const outR = new Manifold()

  if (numVertR === 0) return outR

  // outR.precision = Math.max(inP.precision, inQ.precision)

  // Add vertices, duplicating for inclusion numbers not in [-1, 1].
  // Retained vertices from P and Q:
  for (let i = 0; i < inP.vertPos.length; i++) {
    duplicateVerts(outR.vertPos, i03[i], vP2R[i], inP.vertPos[i])
  }
  for (let i = 0; i < inQ.vertPos.length; i++) {
    duplicateVerts(outR.vertPos, i30[i], vQ2R[i], inQ.vertPos[i])
  }

  // New vertices created from intersections:
  for (let i = 0; i < i12.length; i++) {
    duplicateVerts(outR.vertPos, i12[i], v12R[i], v12[i])
  }
  for (let i = 0; i < i21.length; i++) {
    duplicateVerts(outR.vertPos, i21[i], v21R[i], v21[i])
  }

  console.log(nPv, 'verts from inP')
  console.log(nQv, 'verts from inQ')
  console.log(n12, 'new verts from edgesP -> facesQ')
  console.log(n21, 'new verts from facesP -> edgesQ')

  // Build up new polygonal faces from triangle intersections. At this point the
  // calculation switches from parallel to serial.

  // Level 3

  // This key is the forward halfedge index of P or Q. Only includes intersected
  // edges.
  const edgesP = new Map()
  const edgesQ = new Map()
  // This key is the face index of <P, Q>
  const edgesNew = new Map()

  addNewEdgeVerts(edgesP, edgesNew, p1q2, i12, v12R, inP.halfedge, true)
  addNewEdgeVerts(edgesQ, edgesNew, p2q1, i21, v21R, inQ.halfedge, false)

  // Level 4
  const [faceEdge, facePQ2R] = sizeOutput(outR, inP, inQ, i03, i30, i12, i21, p1q2, p2q1, invertQ)

  // const numFaceR = faceEdge.length - 1
  // This gets incremented for each halfedge that's added to a face so that the
  // next one knows where to slot in.
  const facePtrR = [...faceEdge]

  // Intersected halfedges are marked false.
  const wholeHalfedgeP = Array(inP.halfedge.length).fill(true)
  const wholeHalfedgeQ = Array(inQ.halfedge.length).fill(true)
  // The halfedgeRef contains the data that will become triRef once the faces
  // are triangulated.
  const halfedgeRef = Array(2 * outR.numEdge()).fill().map(() => ({}))

  appendPartialEdges(outR, wholeHalfedgeP, facePtrR, edgesP, halfedgeRef, inP,
    i03, vP2R, facePQ2R.slice(0, inP.numTri()), true)
  appendPartialEdges(outR, wholeHalfedgeQ, facePtrR, edgesQ, halfedgeRef, inQ,
    i30, vQ2R, facePQ2R.slice(inP.numTri()), false)

  appendNewEdges(outR, facePtrR, edgesNew, halfedgeRef, facePQ2R, inP.numTri())

  appendWholeEdges(outR, facePtrR, halfedgeRef, inP, wholeHalfedgeP, i03, vP2R,
    facePQ2R.slice(0, inP.numTri()), true)
  appendWholeEdges(outR, facePtrR, halfedgeRef, inQ, wholeHalfedgeQ, i30, vQ2R,
    facePQ2R.slice(inP.numTri()), false)

  // Level 6

  if (intermediateChecks) {
    if (!outR.isManifold()) throw new Error('polygon mesh is not manifold!')
  }

  face2Tri(outR, faceEdge, halfedgeRef)

  if (intermediateChecks) {
    // if (!outR.isManifold()) throw new Error('triangulated mesh is not manifold!')
  }

  reserveIDs(1) // TODO: called elsewhere in manifold, but this lets ids match
  const refPQ = updateReference(outR, inP, inQ)

  simplifyTopology(outR)

  // createProperties(outR, refPQ, inP, inQ) // TODO

  if (intermediateChecks) {
    // if (!outR.is2Manifold()) throw new Error('simplified mesh is not 2-manifold!')
  }

  outR.finish()
  // outR.incrementMeshIDs()

  return outR
}

/**
 * @param {Vec3[]} vertPosR
 * @param {number} inclusion
 * @param {number} vertR
 * @param {Vec3} vertPosP
 */
const duplicateVerts = (vertPosR, inclusion, vertR, vertPosP) => {
  for (let i = 0; i < Math.abs(inclusion); ++i) {
    vertPosR[vertR + i] = vertPosP
  }
}

/**
 * @param {Map<number, EdgePos[]>} edgesP
 * @param {Map<string, EdgePos[]} edgesNew
 * @param {SparseIndices} p1q2
 * @param {number[]} i12
 * @param {number[]} v12R
 * @param {Halfedge[]} halfedgeP
 * @param {boolean} forward
 */
const addNewEdgeVerts = (edgesP, edgesNew, p1q2, i12, v12R, halfedgeP, forward) => {
  const p1 = p1q2.get(!forward)
  const q2 = p1q2.get(forward)

  p1q2.forEach((_, i) => {
    const edgeP = p1[i]
    const faceQ = q2[i]
    const vert = v12R[i]
    const inclusion = i12[i]

    if (!edgesP.has(edgeP)) {
      edgesP.set(edgeP, [])
    }
    const edgePosP = edgesP.get(edgeP)

    const halfedge = halfedgeP[edgeP]
    let keyPair = [halfedgeP[halfedge.pairedHalfedge].face, faceQ]
    if (!forward) keyPair = keyPair.reverse()
    let key = keyPair.join(',')
    if (!edgesNew.has(key)) {
      edgesNew.set(key, [])
    }
    const edgePosRight = edgesNew.get(key)

    keyPair = [halfedge.face, faceQ]
    if (!forward) keyPair = keyPair.reverse()
    key = keyPair.join(',')
    if (!edgesNew.has(key)) {
      edgesNew.set(key, [])
    }
    const edgePosLeft = edgesNew.get(key)

    const edgePos = { vert, edgePos: 0, isStart: inclusion < 0 }
    const edgePosRev = { ...edgePos, isStart: !edgePos.isStart }

    for (let j = 0; j < Math.abs(inclusion); j++) {
      edgePosP.push({ ...edgePos })
      edgePosRight.push(forward ? { ...edgePos } : { ...edgePosRev })
      edgePosLeft.push(forward ? { ...edgePosRev } : { ...edgePos })
      edgePos.vert++
      edgePosRev.vert++
    }
  })
}

/**
 * Each edge in the map is partially retained; for each of these, look up
 * their original verts and include them based on their winding number (i03),
 * while remapping them to the output using vP2R. Use the verts position
 * projected along the edge vector to pair them up, then distribute these
 * edges to their faces.
 *
 * @param {Manifold} outR
 * @param {boolean[]} wholeHalfedgeP - is each edge whole
 * @param {number[]} facePtrR
 * @param {Map<number, EdgePos[]>} edgesP
 * @param {Array} halfedgeRef
 * @param {Manifold} inP
 * @param {number[]} i03
 * @param {Array} vP2R
 * @param {number[]} faceP2R
 * @param {boolean} forward
 */
const appendPartialEdges = (outR, wholeHalfedgeP, facePtrR, edgesP, halfedgeRef, inP, i03, vP2R, faceP2R, forward) => {
  for (const [key, edgePosP] of edgesP.entries()) {
    const edgeP = Number(key)
    const halfedge = inP.halfedge[edgeP]
    wholeHalfedgeP[edgeP] = false
    wholeHalfedgeP[halfedge.pairedHalfedge] = false

    const vStart = halfedge.startVert
    const vEnd = halfedge.endVert
    const edgeVec = vec3.subtract(vec3.create(), inP.vertPos[vEnd], inP.vertPos[vStart])

    // Fill in the edge positions of the old points.
    edgePosP.forEach((edge) => {
      edge.edgePos = vec3.dot(outR.vertPos[edge.vert], edgeVec)
    })

    let inclusion = i03[vStart]
    let reversed = inclusion < 0
    let edgePos = {
      vert: vP2R[vStart],
      edgePos: vec3.dot(outR.vertPos[vP2R[vStart]], edgeVec),
      isStart: inclusion > 0
    }
    for (let j = 0; j < Math.abs(inclusion); ++j) {
      edgePosP.push({ ...edgePos })
      edgePos.vert++
    }

    inclusion = i03[vEnd]
    reversed ||= inclusion < 0
    edgePos = {
      vert: vP2R[vEnd],
      edgePos: vec3.dot(outR.vertPos[vP2R[vEnd]], edgeVec),
      isStart: inclusion < 0
    }
    for (let j = 0; j < Math.abs(inclusion); ++j) {
      edgePosP.push({ ...edgePos })
      edgePos.vert++
    }

    // sort edges into start/end pairs along length
    const edges = pairUp(edgePosP)

    // add halfedges to result
    const faceLeftP = halfedge.face
    const faceLeft = faceP2R[faceLeftP]
    const faceRightP = inP.halfedge[halfedge.pairedHalfedge].face
    const faceRight = faceP2R[faceRightP]

    // Negative inclusion means the halfedges are reversed, which means our
    // reference is now to the endVert instead of the startVert, which is one
    // position advanced CCW. This is only valid if this is a retained vert; it
    // will be ignored later if the vert is new.
    const forwardRef = { meshID: forward ? 0 : 1, originalID: -1, tri: faceLeftP }
    const backwardRef = { meshID: forward ? 0 : 1, originalID: -1, tri: faceRightP }

    edges.forEach((e) => {
      const forwardEdge = facePtrR[faceLeft]++
      const backwardEdge = facePtrR[faceRight]++

      outR.halfedge[forwardEdge] = {
        startVert: e.startVert,
        endVert: e.endVert,
        pairedHalfedge: backwardEdge,
        face: faceLeft
      }
      halfedgeRef[forwardEdge] = forwardRef

      outR.halfedge[backwardEdge] = {
        startVert: e.endVert,
        endVert: e.startVert,
        pairedHalfedge: forwardEdge,
        face: faceRight
      }
      halfedgeRef[backwardEdge] = backwardRef
    })
  }
}

/**
 * Pair start vertices with end vertices to form edges. The choice of pairing
 * is arbitrary for the manifoldness guarantee, but must be ordered to be
 * geometrically valid. If the order does not go start-end-start-end... then
 * the input and output are not geometrically valid and this algorithm becomes
 * a heuristic.
 * @param {EdgePos[]} edgePos
 * @returns {Halfedge[]}
 */
const pairUp = (edgePos) => {
  if (edgePos.length % 2 !== 0) {
    throw new Error('Non-manifold edge! Not an even number of points: ' + edgePos.length)
  }
  const nEdges = edgePos.length / 2

  // starts to the front
  const [starts, ends] = edgePos.reduce(
    (acc, val) => {
      const [starts, ends] = acc
      if (val.isStart) starts.push(val)
      else ends.push(val)
      return acc
    },
    [[], []]
  )

  if (starts.length !== nEdges) {
    throw new Error(`Non-manifold edge: ${starts.length} !== ${nEdges}`)
  }

  // sort partitions
  starts.sort((a, b) => a.edgePos - b.edgePos)
  ends.sort((a, b) => a.edgePos - b.edgePos)

  const edges = []
  for (let i = 0; i < nEdges; ++i) {
    edges.push({
      startVert: starts[i].vert,
      endVert: ends[i].vert,
      pairedHalfedge: -1,
      face: -1
    })
  }

  return edges
}

/**
 * @param {Manifold} outR
 * @param {number[]} facePtrR
 * @param {Map<string, EdgePos[]>} edgesNew
 * @param {Array} halfedgeRef
 * @param {number[]} facePQ2R
 * @param {number} numFaceP
 */
const appendNewEdges = (outR, facePtrR, edgesNew, halfedgeRef, facePQ2R, numFaceP) => {
  for (const [key, edgePos] of edgesNew.entries()) {
    // Pair up each edge's verts and distribute to faces based on indices in key.
    const faceP = Number(key.split(',')[0])
    const faceQ = Number(key.split(',')[1])

    const box = bbox.create()
    edgePos.forEach((edge) => bbox.expand(box, outR.vertPos[edge.vert]))
    const size = vec3.subtract(vec3.create(), box.max, box.min)

    // Order the points along their longest dimension.
    const i = (size[0] > size[1] && size[0] > size[2])
      ? 0
      : size[1] > size[2]
        ? 1
        : 2
    edgePos.forEach((edge) => {
      edge.edgePos = outR.vertPos[edge.vert][i]
    })

    // sort edges into start/end pairs along length.
    const edges = pairUp(edgePos)

    // add halfedges to result
    const faceLeft = facePQ2R[faceP]
    const faceRight = facePQ2R[numFaceP + faceQ]
    const forwardRef = { meshID: 0, originalID: -1, tri: faceP }
    const backwardRef = { meshID: 1, originalID: -1, tri: faceQ }

    edges.forEach((e) => {
      const forwardEdge = facePtrR[faceLeft]++
      const backwardEdge = facePtrR[faceRight]++

      outR.halfedge[forwardEdge] = {
        startVert: e.startVert,
        endVert: e.endVert,
        pairedHalfedge: backwardEdge,
        face: faceLeft
      }
      halfedgeRef[forwardEdge] = forwardRef

      outR.halfedge[backwardEdge] = {
        startVert: e.endVert,
        endVert: e.startVert,
        pairedHalfedge: forwardEdge,
        face: faceRight
      }
      halfedgeRef[backwardEdge] = backwardRef
    })
  }
}

/**
 * @param {Manifold} outR
 * @param {number[]} facePtrR
 * @param {Array} halfedgeRef
 * @param {Manifold} inP
 * @param {boolean[]} wholeHalfedgeP
 * @param {number[]} i03
 * @param {number[]} vP2R
 * @param {number[]} faceP2R
 * @param {boolean} forward
 */
const appendWholeEdges = (outR, facePtrR, halfedgeRef, inP, wholeHalfedgeP, i03, vP2R, faceP2R, forward) => {
  const dh = duplicateHalfedges(outR.halfedge, halfedgeRef, facePtrR, inP.halfedge, i03, vP2R, faceP2R, forward)
  for (let i = 0; i < inP.halfedge.length; i++) {
    dh(wholeHalfedgeP[i], inP.halfedge[i], i)
  }
}

/**
 * @param {Halfedge[]} halfedgesR
 * @param {Array} halfedgeRef
 * @param {number[]} facePtr
 * @param {Halfedge[]} halfedgesP
 * @param {number[]} i03
 * @param {number[]} vP2R
 * @param {number[]} faceP2R
 * @param {boolean} forward
 */
const duplicateHalfedges = (halfedgesR, halfedgeRef, facePtr, halfedgesP, i03, vP2R, faceP2R, forward) =>
  (wholeHalfedge, halfedge, edgeP) => {
    if (!wholeHalfedge) return
    if (!isForward(halfedge)) return

    const inclusion = i03[halfedge.startVert]
    if (inclusion === 0) return
    if (inclusion < 0) { // reverse
      const tmp = halfedge.startVert
      halfedge.startVert = halfedge.endVert
      halfedge.endVert = tmp
    }
    halfedge.startVert = vP2R[halfedge.startVert]
    halfedge.endVert = vP2R[halfedge.endVert]
    const faceLeftP = halfedge.face
    halfedge.face = faceP2R[faceLeftP]
    const faceRightP = halfedgesP[halfedge.pairedHalfedge].face
    const faceRight = faceP2R[faceRightP]

    // Negative inclusion means the halfedges are reversed, which means our
    // reference is now to the endVert instead of the startVert, which is one
    // position advanced CCW.
    const forwardRef = { meshID: forward ? 0 : 1, originalID: -1, tri: faceLeftP }
    const backwardRef = { meshID: forward ? 0 : 1, originalID: -1, tri: faceRightP }

    for (let i = 0; i < Math.abs(inclusion); i++) {
      const forwardEdge = facePtr[halfedge.face]++
      const backwardEdge = facePtr[faceRight]++
      halfedge.pairedHalfedge = backwardEdge

      halfedgesR[forwardEdge] = { ...halfedge }
      halfedgesR[backwardEdge] = {
        startVert: halfedge.endVert,
        endVert: halfedge.startVert,
        pairedHalfedge: forwardEdge,
        face: faceRight
      }

      halfedgeRef[forwardEdge] = forwardRef
      halfedgeRef[backwardEdge] = backwardRef

      halfedge.startVert++
      halfedge.endVert++
    }
  }

/**
 * @param {Manifold} outR
 * @param {Manifold} inP
 * @param {Manifold} inQ
 * @param {number[]} i03
 * @param {number[]} i30
 * @param {number[]} i12
 * @param {number[]} i21
 * @param {SparseIndices} p1q2
 * @param {SparseIndices} p2q1
 * @param {boolean} invertQ
 */
const sizeOutput = (outR, inP, inQ, i03, i30, i12, i21, p1q2, p2q1, invertQ) => {
  const sidesPerFaceP = Array(inP.numTri()).fill(0)
  const sidesPerFaceQ = Array(inQ.numTri()).fill(0)

  inP.halfedge.forEach(countVerts(sidesPerFaceP, i03))
  inQ.halfedge.forEach(countVerts(sidesPerFaceQ, i30))

  let cnv = countNewVerts(sidesPerFaceP, sidesPerFaceQ, inP.halfedge)
  for (let i = 0; i < i12.length; i++) {
    cnv(p1q2.p[i], p1q2.q[i], i12[i])
  }
  cnv = countNewVerts(sidesPerFaceQ, sidesPerFaceP, inQ.halfedge)
  for (let i = 0; i < i21.length; i++) {
    cnv(p2q1.q[i], p2q1.p[i], i21[i])
  }
  let sidesPerFacePQ = sidesPerFaceP.concat(sidesPerFaceQ)

  const keepFace = sidesPerFacePQ.map((x) => x !== 0)

  const facePQ2R = []
  let sum = 0
  keepFace.forEach((keep, i) => {
    facePQ2R[i] = sum
    if (keep) sum++
  })

  // copy faceNormals to outR
  const normP = inP.faceNormal.filter((_, i) => keepFace[i])
  let normQ = inQ.faceNormal.filter((_, i) => keepFace[inP.numTri() + i])
  if (invertQ) normQ = normQ.map((normal) => vec3.scale(vec3.create(), normal, -1))
  outR.faceNormal = normP.concat(normQ)

  // remove from sidesPerFacePQ
  sidesPerFacePQ = sidesPerFacePQ.filter((val) => val !== 0)

  // faceEdge = inclusive_scan(newEnd)
  const faceEdge = []
  sum = 0
  for (let i = 0; i <= sidesPerFacePQ.length; i++) {
    faceEdge[i] = sum
    sum += sidesPerFacePQ[i]
  }
  outR.halfedge.length = faceEdge[faceEdge.length - 1]

  return [faceEdge, facePQ2R]
}

/**
 * @param {number[]} count
 * @param {number[]} inclusion
 */
const countVerts = (count, inclusion) => (edge) => {
  count[edge.face] += Math.abs(inclusion[edge.startVert])
}

/**
 * @param {number[]} countP
 * @param {number[]} countQ
 * @param {Halfedge[]} halfedges
 */
const countNewVerts = (countP, countQ, halfedges) => (edgeP, faceQ, inclusion) => {
  inclusion = Math.abs(inclusion)
  countQ[faceQ] += inclusion
  const half = halfedges[edgeP]
  countP[half.face] += inclusion
  const pair = halfedges[half.pairedHalfedge]
  countP[pair.face] += inclusion
}

/**
 * @param {Manifold} outR
 * @param {Manifold} inP
 * @param {Manifold} inQ
 */
const updateReference = (outR, inP, inQ) => {
  const refPQ = outR.meshRelation.triRef
  const offsetQ = meshIDCounter

  refPQ.forEach((triRef) => {
    // MapTriRef
    const tri = triRef.tri
    const PQ = triRef.meshID === 0
    triRef = PQ ? inP.meshRelation.triRef[tri] : inQ.meshRelation.triRef[tri]
    if (!PQ) triRef.meshID += offsetQ
  })

  // TODO: meshIDtransform stuff?

  return refPQ
}
