/*
 * Copyright 2021 The Manifold Authors
 * https://github.com/elalish/manifold
 * JS port by @platypii
 */

/**
 * @typedef {{ startVert: number, endVert: number, pairedHalfedge: number, face: number }} Halfedge
 */

import * as vec3 from '../../../maths/vec3/index.js'
import { CCW, dot, getAxisAlignedProjection, nextHalfedge } from './utils.js'

/**
 * @param {number} edge
 * @returns {Vec3}
 */
const triOf = (edge) => {
  const triEdge = vec3.create()
  triEdge[0] = edge
  triEdge[1] = nextHalfedge(triEdge[0])
  triEdge[2] = nextHalfedge(triEdge[1])
  return triEdge
}

/**
 * @param {Vec2} v0
 * @param {Vec2} v1
 * @param {Vec2} v2
 * @returns {boolean}
 */
const is01Longest = (v0, v1, v2) => {
  const e = [
    vec3.subtract(vec3.create(), v1, v0),
    vec3.subtract(vec3.create(), v2, v1),
    vec3.subtract(vec3.create(), v0, v2)
  ]
  const l = e.map((v) => vec3.dot(v, v))
  return l[0] > l[1] && l[0] > l[2]
}

/**
 * @param {number} edge
 * @returns {boolean}
 */
const shortEdge = (inP, edge) => {
  // Flag short edges
  const delta = vec3.subtract(
    vec3.create(),
    inP.vertPos[inP.halfedge[edge].endVert],
    inP.vertPos[inP.halfedge[edge].startVert]
  )
  return vec3.dot(delta, delta) < inP.precision * inP.precision
}

/**
 * @param {number} edge
 * @returns {boolean}
 */
const flagEdge = (inP, edge) => {
  if (inP.halfedge[edge].pairedHalfedge < 0) return false
  const triRef = inP.meshRelation.triRef

  // Flag redundant edges - those where the startVert is surrounded by only
  // two original triangles.
  const ref0 = triRef[Math.floor(edge / 3)]
  let current = nextHalfedge(inP.halfedge[edge].pairedHalfedge)
  const ref1 = triRef[Math.floor(current / 3)]

  while (current !== edge) {
    current = nextHalfedge(inP.halfedge[current].pairedHalfedge)
    const tri = Math.floor(current / 3)
    const ref = triRef[tri]
    if ((ref.meshID !== ref0.meshID || ref.tri !== ref0.tri) &&
        (ref.meshID !== ref1.meshID || ref.tri !== ref1.tri)) {
      return false
    }
  }

  return true
}

/**
 * @param {number} edge
 * @returns {boolean}
 */
const swappableEdge = (inP, edge) => {
  if (inP.halfedge[edge].pairedHalfedge < 0) return false

  let tri = inP.halfedge[edge].face
  let triedge = triOf(edge)
  let projection = getAxisAlignedProjection(inP.faceNormal[tri])
  const v = [0, 1, 2].map((i) => dot(projection, inP.vertPos[inP.halfedge[triedge[i]].startVert]))
  if (CCW(v[0], v[1], v[2], inP.precision) > 0 || !is01Longest(v[0], v[1], v[2])) { return false }

  // Switch to neighbor's projection.
  edge = inP.halfedge[edge].pairedHalfedge
  tri = inP.halfedge[edge].face
  triedge = triOf(edge)
  projection = getAxisAlignedProjection(inP.faceNormal[tri])
  for (let i = 0; i < 3; i++) {
    v[i] = dot(projection, inP.vertPos[inP.halfedge[triedge[i]].startVert])
  }
  return CCW(v[0], v[1], v[2], inP.precision) > 0 || is01Longest(v[0], v[1], v[2])
}

/**
 * Collapses degenerate triangles by removing edges shorter than precision and
 * any edge that is preceded by an edge that joins the same two face relations.
 * It also performs edge swaps on the long edges of degenerate triangles, though
 * there are some configurations of degenerates that cannot be removed this way.
 *
 * Before collapsing edges, the mesh is checked for duplicate edges (more than
 * one pair of triangles sharing the same edge), which are removed by
 * duplicating one vert and adding two triangles. These degenerate triangles are
 * likely to be collapsed again in the subsequent simplification.
 *
 * Note when an edge collapse would result in something non-manifold, the
 * vertices are duplicated in such a way as to remove handles or separate
 * meshes, thus decreasing the Genus(). It only increases when meshes that have
 * collapsed to just a pair of triangles are removed entirely.
 *
 * Rather than actually removing the edges, this step merely marks them for
 * removal, by setting vertPos to NaN and halfedge to undefined.
 */
export const simplifyTopology = (inP) => {
  if (!inP.halfedge.length) return

  const nbEdges = inP.halfedge.length
  let numFlagged = 0
  const bflags = []

  const entries = new Array(nbEdges).fill(null).map((_, i) => ({
    start: inP.halfedge[i].startVert,
    end: inP.halfedge[i].endVert,
    index: i
  }))

  entries.sort((a, b) => a.start - b.start || a.end - b.end)
  for (let i = 0; i < nbEdges - 1; i++) {
    if (entries[i].start === entries[i + 1].start && entries[i].end === entries[i + 1].end) {
      dedupeEdge(inP, entries[i].index)
      numFlagged++
    }
  }

  if (numFlagged > 0) {
    console.log(`found ${numFlagged} duplicate edges to split`)
  }

  // short edge
  const scratchBuffer = []
  numFlagged = 0
  for (let i = 0; i < nbEdges; i++) {
    bflags[i] = shortEdge(inP, i)
  }
  for (let i = 0; i < nbEdges; i++) {
    if (bflags[i]) {
      collapseEdge(inP, i, scratchBuffer)
      scratchBuffer.length = 0
      numFlagged++
    }
  }

  if (numFlagged > 0) {
    console.log(`found ${numFlagged} short edges to collapse`)
  }

  // flag edge
  numFlagged = 0
  for (let i = 0; i < nbEdges; i++) {
    bflags[i] = flagEdge(inP, i)
  }
  for (let i = 0; i < nbEdges; i++) {
    if (bflags[i]) {
      collapseEdge(inP, i, scratchBuffer)
      scratchBuffer.length = 0
      numFlagged++
    }
  }

  if (numFlagged > 0) {
    console.log(`found ${numFlagged} colinear edges to collapse`)
  }

  // swappable edge
  numFlagged = 0
  for (let i = 0; i < nbEdges; i++) {
    bflags[i] = swappableEdge(inP, i)
  }
  const edgeSwapStack = []
  const visited = new Array(inP.halfedge.length).fill(-1)
  let tag = 0
  for (let i = 0; i < nbEdges; i++) {
    if (bflags[i]) {
      numFlagged++
      tag++
      recursiveEdgeSwap(inP, i, tag, visited, edgeSwapStack, scratchBuffer)
      while (edgeSwapStack.length) {
        const last = edgeSwapStack.pop()
        recursiveEdgeSwap(inP, last, tag, visited, edgeSwapStack, scratchBuffer)
      }
    }
  }

  if (numFlagged > 0) {
    console.log(`found ${numFlagged} edges to swap`)
  }
}

const dedupeEdge = (inP, edge) => {
  // Orbit endVert
  const startVert = inP.halfedge[edge].startVert
  const endVert = inP.halfedge[edge].endVert
  let current = inP.halfedge[nextHalfedge(edge)].pairedHalfedge
  while (current !== edge) {
    const vert = inP.halfedge[current].startVert
    if (vert === startVert) {
      const newVert = inP.vertPos.length
      inP.vertPos.push(inP.vertPos[endVert])
      if (inP.vertNormal.length > 0) inP.vertNormal.push(inP.vertNormal[endVert])
      current = inP.halfedge[nextHalfedge(current)].pairedHalfedge
      const opposite = inP.halfedge[nextHalfedge(edge)].pairedHalfedge

      updateVert(inP, newVert, current, opposite)

      let newHalfedge = inP.halfedge.length
      let newFace = Math.floor(newHalfedge / 3)
      let oldFace = inP.halfedge[current].face
      let outsideVert = inP.halfedge[current].startVert
      inP.halfedge.push({ startVert: endVert, endVert: newVert, pairedHalfedge: -1, face: newFace })
      inP.halfedge.push({ startVert: newVert, endVert: outsideVert, pairedHalfedge: -1, face: newFace })
      inP.halfedge.push({ startVert: outsideVert, endVert, pairedHalfedge: -1, face: newFace })
      pairUp(inP, newHalfedge + 2, inP.halfedge[current].pairedHalfedge)
      pairUp(inP, newHalfedge + 1, current)
      // if (inP.meshRelation.triRef.length > 0) inP.meshRelation.triRef.push(inP.meshRelation.triRef[oldFace])
      // if (inP.meshRelation.triProperties.length > 0) inP.meshRelation.triProperties.push(inP.meshRelation.triProperties[oldFace])
      if (inP.faceNormal.length > 0) inP.faceNormal.push(inP.faceNormal[oldFace])

      newHalfedge += 3
      newFace++
      oldFace = inP.halfedge[opposite].face
      outsideVert = inP.halfedge[opposite].startVert
      inP.halfedge.push({ startVert: newVert, endVert, pairedHalfedge: -1, face: newFace })
      inP.halfedge.push({ startVert: endVert, endVert: outsideVert, pairedHalfedge: -1, face: newFace })
      inP.halfedge.push({ startVert: outsideVert, endVert: newVert, pairedHalfedge: -1, face: newFace })
      pairUp(inP, newHalfedge + 2, inP.halfedge[opposite].pairedHalfedge)
      pairUp(inP, newHalfedge + 1, opposite)
      pairUp(inP, newHalfedge, newHalfedge - 3)
      // if (inP.meshRelation.triRef.length > 0) inP.meshRelation.triRef.push(inP.meshRelation.triRef[oldFace])
      // if (inP.meshRelation.triProperties.length > 0) inP.meshRelation.triProperties.push(inP.meshRelation.triProperties[oldFace])
      if (inP.faceNormal.length > 0) inP.faceNormal.push(inP.faceNormal[oldFace])

      break
    }

    current = inP.halfedge[nextHalfedge(current)].pairedHalfedge
  }
}

/**
 * Traverses CW around startEdge.endVert from startEdge to endEdge
 * (edgeEdge.endVert must == startEdge.endVert), updating each edge to point
 * to vert instead.
 * @param {number} vert
 * @param {number} startEdge
 * @param {number} endEdge
 */
const updateVert = (inP, vert, startEdge, endEdge) => {
  let current = startEdge
  while (current !== endEdge) {
    inP.halfedge[current].endVert = vert
    current = nextHalfedge(current)
    inP.halfedge[current].startVert = vert
    current = inP.halfedge[current].pairedHalfedge
    if (current === startEdge) {
      throw new Error('infinite loop in decimator')
    }
  }
}

/**
 * In the event that the edge collapse would create a non-manifold edge,
 * instead we duplicate the two verts and attach the manifolds the other way
 * across this edge.
 * @param {number} current
 * @param {number} end
 */
const formLoop = (inP, current, end) => {
  const startVert = inP.vertPos.length
  inP.vertPos.push(inP.vertPos[inP.halfedge[current].startVert])
  const endVert = inP.vertPos.length
  inP.vertPos.push(inP.vertPos[inP.halfedge[current].endVert])

  const oldMatch = inP.halfedge[current].pairedHalfedge
  const newMatch = inP.halfedge[end].pairedHalfedge

  updateVert(inP, startVert, oldMatch, newMatch)
  updateVert(inP, endVert, end, current)

  inP.halfedge[current].pairedHalfedge = newMatch
  inP.halfedge[newMatch].pairedHalfedge = current
  inP.halfedge[end].pairedHalfedge = oldMatch
  inP.halfedge[oldMatch].pairedHalfedge = end

  removeIfFolded(inP, end)
}

/**
 * @param {Vec3} triEdge
 */
const collapseTri = (inP, triEdge) => {
  const pair1 = inP.halfedge[triEdge[1]].pairedHalfedge
  const pair2 = inP.halfedge[triEdge[2]].pairedHalfedge
  inP.halfedge[pair1].pairedHalfedge = pair2
  inP.halfedge[pair2].pairedHalfedge = pair1
  triEdge.forEach((i) => {
    inP.halfedge[i] = { startVert: -1, endVert: -1, pairedHalfedge: -1, face: -1 }
  })
}

/**
 * @param {number} edge
 */
const removeIfFolded = (inP, edge) => {
  const tri0edge = triOf(edge)
  const tri1edge = triOf(inP.halfedge[edge].pairedHalfedge)

  if (inP.halfedge[tri0edge[1]].endVert === inP.halfedge[tri1edge[1]].endVert) {
    if (inP.halfedge[tri0edge[1]].pairedHalfedge === tri1edge[2]) {
      if (inP.halfedge[tri0edge[2]].pairedHalfedge === tri1edge[1]) {
        [0, 1, 2].forEach((i) => {
          inP.vertPos[inP.halfedge[tri0edge[i]].startVert] = undefined
        })
      } else {
        inP.vertPos[inP.halfedge[tri0edge[1]].startVert] = undefined
      }
    } else {
      if (inP.halfedge[tri0edge[2]].pairedHalfedge === tri1edge[1]) {
        inP.vertPos[inP.halfedge[tri1edge[1]].startVert] = undefined
      }
    }

    pairUp(inP, inP.halfedge[tri0edge[1]].pairedHalfedge, inP.halfedge[tri1edge[2]].pairedHalfedge)
    pairUp(inP, inP.halfedge[tri0edge[2]].pairedHalfedge, inP.halfedge[tri1edge[1]].pairedHalfedge)

    for (let i = 0; i < 3; i++) {
      inP.halfedge[tri0edge[i]] = undefined
      inP.halfedge[tri1edge[i]] = undefined
    }
  }
}

const collapseEdge = (inP, edge, edges) => {
  const triRef = inP.meshRelation.triRef
  const toRemove = inP.halfedge[edge]
  if (toRemove.pairedHalfedge < 0) return

  const endVert = toRemove.endVert
  const tri0edge = triOf(edge)
  const tri1edge = triOf(toRemove.pairedHalfedge)

  const pNew = inP.vertPos[endVert]
  const pOld = inP.vertPos[toRemove.startVert]
  const delta = vec3.subtract(vec3.create(), pNew, pOld)
  const shortEdge = vec3.dot(delta, delta) < inP.precision * inP.precision

  // Orbit endVert
  let current = inP.halfedge[tri0edge[1]].pairedHalfedge
  while (current !== tri1edge[2]) {
    current = nextHalfedge(current)
    edges.push(current)
    current = inP.halfedge[current].pairedHalfedge
  }

  // Orbit startVert
  let start = inP.halfedge[tri1edge[1]].pairedHalfedge
  if (!shortEdge) {
    current = start
    let refCheck = triRef[toRemove.pairedHalfedge / 3]
    let pLast = inP.vertPos[inP.halfedge[tri1edge[1]].endVert]
    while (current !== tri0edge[2]) {
      current = nextHalfedge(current)
      const pNext = inP.vertPos[inP.halfedge[current].endVert]
      const tri = current / 3
      const ref = triRef[tri]
      const projection = getAxisAlignedProjection(inP.faceNormal[tri])

      // Don't collapse if the edge is not redundant (this may have changed due
      // to the collapse of neighbors).
      if (ref.meshID !== refCheck.meshID || ref.tri !== refCheck.tri) {
        refCheck = triRef[edge / 3]
        if (ref.meshID !== refCheck.meshID || ref.tri !== refCheck.tri) {
          return
        } else {
          // Don't collapse if the edges separating the faces are not colinear
          // (can happen when the two faces are coplanar).
          if (CCW(dot(projection, pOld), dot(projection, pLast), dot(projection, pNew), inP.precision) != 0) {
            return
          }
        }
      }

      // Don't collapse edge if it would cause a triangle to invert.
      if (CCW(dot(projection, pNext), dot(projection, pLast), dot(projection, pNew), inP.precision) < 0) {
        return
      }

      pLast = pNext
      current = inP.halfedge[current].pairedHalfedge
    }
  }

  // Remove toRemove.startVert and replace with endVert.
  inP.vertPos[toRemove.startVert] = undefined
  collapseTri(inP, tri1edge)

  // Orbit startVert
  current = start
  while (current !== tri0edge[2]) {
    current = nextHalfedge(current)

    // Update the shifted triangles to the vertBary of endVert
    const tri = current / 3 // TODO: Math.floor?
    const vIdx = current - 3 * tri

    // TODO: Update properties if applicable

    const vert = inP.halfedge[current].endVert
    const next = inP.halfedge[current].pairedHalfedge
    for (let i = 0; i < edges.length; i++) {
      if (vert == inP.halfedge[edges[i]].endVert) {
        formLoop(inP, edges[i], current)
        start = next
        edges.resize(i)
        break
      }
    }

    current = next
  }

  updateVert(inP, endVert, start, tri0edge[2])
  collapseTri(inP, tri0edge)
  removeIfFolded(inP, start)
}

/**
 * @param {number} edge
 * @param {number} tag
 * @param {number[]} visited
 * @param {number[]} edgeSwapStack
 * @param {number[]} edges
 */
const recursiveEdgeSwap = (inP, edge, tag, visited, edgeSwapStack, edges) => {
  if (edge < 0) return
  const pair = inP.halfedge[edge].pairedHalfedge
  if (pair < 0) return

  // avoid infinite recursion
  if (visited[edge] === tag && visited[pair] === tag) return

  const triRef = inP.meshRelation.triRef
  const tri0edge = triOf(edge)
  const tri1edge = triOf(pair)
  const perm0 = triOf(edge % 3)
  const perm1 = triOf(pair % 3)

  // Only operate on the long edge of a degenerate triangle

  // Switch to neighbor's projection
  let projection = getAxisAlignedProjection(inP.faceNormal[Math.floor(edge / 3)])
  const v = []
  for (let i = 0; i < 3; i++) {
    v[i] = dot(projection, inP.vertPos[inP.halfedge[tri0edge[i]].startVert])
  }

  if (CCW(v[0], v[1], v[2], inP.precision) > 0 || !is01Longest(v[0], v[1], v[2])) { return }

  projection = getAxisAlignedProjection(inP.faceNormal[inP.halfedge[pair].face])
  for (let i = 0; i < 3; i++) {
    v[i] = dot(projection, inP.vertPos[inP.halfedge[tri0edge[i]].startVert])
  }
  v[3] = dot(projection, inP.vertPos[inP.halfedge[tri1edge[2]].startVert])

  const swapEdge = () => {
    // The 0-verts are swapped to the opposite 2-verts
    const v0 = inP.halfedge[tri0edge[2]].startVert
    const v1 = inP.halfedge[tri1edge[2]].startVert
    inP.halfedge[tri0edge[0]].startVert = v1
    inP.halfedge[tri0edge[2]].endVert = v1
    inP.halfedge[tri1edge[0]].startVert = v0
    inP.halfedge[tri1edge[2]].endVert = v0
    pairUp(inP, tri0edge[0], inP.halfedge[tri1edge[2]].pairedHalfedge)
    pairUp(inP, tri1edge[0], inP.halfedge[tri0edge[2]].pairedHalfedge)
    pairUp(inP, tri0edge[2], tri1edge[2])

    // Both triangles are now subsets of the neighboring triangle
    const tri0 = inP.halfedge[tri0edge[0]].face
    const tri1 = inP.halfedge[tri1edge[0]].face
    inP.faceNormal[tri0] = inP.faceNormal[tri1]
    triRef[tri0] = triRef[tri1]
    const l01 = vec3.length(vec3.subtract(vec3.create(), v[1], v[0]))
    const l02 = vec3.length(vec3.subtract(vec3.create(), v[2], v[0]))
    const a = Math.max(0.0, Math.min(1.0, l02 / l01))

    // TODO: Update properties if applicable

    // if the new edge already exists, duplicate the verts and split the mesh
    let current = inP.halfedge[tri1edge[0]].pairedHalfedge
    const endVert = inP.halfedge[tri1edge[1]].endVert
    while (current !== tri0edge[1]) {
      current = nextHalfedge(current)
      if (inP.halfedge[current].endVert === endVert) {
        formLoop(inP, tri0edge[2], current)
        removeIfFolded(inP, tri0edge[2])
        return
      }
      current = inP.halfedge[current].pairedHalfedge
    }
  }

  // Only operate if the other triangles are not degenerate
  if (CCW(v[1], v[0], v[3], inP.precision) <= 0) {
    if (!is01Longest(v[1], v[0], v[3])) {
      // Two facing, long-edge degenerates can swap
      swapEdge()
      visited[edge] = tag
      visited[pair] = tag
      edgeSwapStack.push(
        inP.halfedge[tri1edge[0]].pairedHalfedge,
        inP.halfedge[tri0edge[1]].pairedHalfedge
      )
    }
  } else if (CCW(v[0], v[1], v[3], inP.precision) > 0) {
    // Normal path
    swapEdge()
    visited[edge] = tag
    visited[pair] = tag
    edgeSwapStack.push(
      inP.halfedge[tri1edge[0]].pairedHalfedge,
      inP.halfedge[tri0edge[1]].pairedHalfedge
    )
  }
}

const pairUp = (inP, edge0, edge1) => {
  inP.halfedge[edge0].pairedHalfedge = edge1
  inP.halfedge[edge1].pairedHalfedge = edge0
}
