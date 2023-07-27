/*
 * Copyright 2021 The Manifold Authors
 * https://github.com/elalish/manifold
 * JS port by @platypii
 */

import * as geom3 from '../../../geometries/geom3/index.js'
import * as vec3 from '../../../maths/vec3/index.js'
import { mayOverlap } from '../mayOverlap.js'
import { Filter11, Intersect12, Shadow02, Shadow11, Winding03 } from './kernels.js'
import { Manifold } from './manifold.js'
import { result } from './booleanResult.js'
import { SparseIndices } from './sparse.js'

const halfedge2Tmp = (halfedge, halfedgeIdx) => {
  if (halfedge.startVert >= halfedge.endVert) halfedgeIdx = -1
  return { ...halfedge, halfedgeIdx }
}

/**
 * Returns a sparse array of the bounding box overlaps between the edges of
 * the input manifold, Q and the faces of this manifold. Returned indices only
 * point to forward halfedges.
 * @param {Manifold} P
 * @param {Manifold} Q
 * @returns {SparseIndices} sparse array of edge-face overlaps
 */
const edgeCollisions = (P, Q) => {
  // CreateTmpEdges
  const edges = Q.halfedge
    .map((half, i) => halfedge2Tmp(half, i))
    .filter((edge) => !(edge.halfedgeIdx < 0))
  const QedgeBB = edges
    .map((edge) => {
      // EdgeBox
      const v1 = Q.vertPos[edge.startVert]
      const v2 = Q.vertPos[edge.endVert]
      return {
        min: vec3.min(vec3.create(), v1, v2),
        max: vec3.max(vec3.create(), v1, v2)
      }
    })

  const q1p2 = P.collider.collisions(QedgeBB)
  // ReindexEdge
  q1p2.p = q1p2.p.map((edge) => edges[edge].halfedgeIdx)

  return q1p2
}

/**
 * The central operation of this library: the Boolean combines two manifolds
 * into another by calculating their intersections and removing the unused
 * portions.
 * epsilon-valid inputs will produce epsilon-valid output.
 * epsilon-invalid input may fail triangulation.
 *
 * These operations are optimized to produce nearly-instant results if either
 * input is empty or their bounding boxes do not overlap.
 *
 * @param {string} op the type of operation to perform
 */
export const boolean = (geomP, geomQ, op) => {
  const manifold = booleanManifold(geomP, geomQ, op)
  return manifold.toGeometry()
}

const booleanManifold = (geomP, geomQ, op) => {
  let p1q2
  let p2q1
  let x12 = []
  let x21 = []
  let w03 = []
  let w30 = []
  let v12 = []
  let v21 = []

  // Convert JSCAD to manifold
  const inP = new Manifold(geomP)
  const inQ = new Manifold(geomQ)

  if (!mayOverlap(geomP, geomQ)) {
    console.log('No overlap, early out')
    p1q2 = new SparseIndices(0)
    p2q1 = new SparseIndices(0)
    w03 = new Array(geom3.toPoints(geomP).length).fill(0)
    w30 = new Array(geom3.toPoints(geomQ).length).fill(0)
    return result({ op, inP, inQ, p1q2, p2q1, x12, x21, v12, v21, w03, w30 })
  }

  const expandP = op === 'add' ? 1 : -1
  // Symbolic perturbation:
  // Union -> expand inP
  // Difference, Intersection -> contract inP

  // Level 3
  // Find edge-triangle overlaps (broad phase)
  p1q2 = edgeCollisions(inQ, inP)
  p2q1 = edgeCollisions(inP, inQ)

  p1q2.sort()
  console.log('p1q2 size =', p1q2.length)

  p2q1.swapPQ()
  p2q1.sort()
  console.log('p2q1 size =', p2q1.length)

  // Level 2
  // Find vertices that overlap faces in XY-projection
  const p0q2 = inQ.vertexCollisionsZ(inP.vertPos)
  p0q2.sort()
  console.log('p0q2 size =', p0q2.length)

  const p2q0 = inP.vertexCollisionsZ(inQ.vertPos)
  p2q0.swapPQ()
  p2q0.sort()
  console.log('p2q0 size =', p2q0.length)

  // Find involved edge pairs from Level 3
  const p1q1 = Filter11(inP, inQ, p1q2, p2q1)
  console.log('p1q1 size =', p1q1.length)

  // Level 2
  // Build up XY-projection intersection of two edges, including the z-value for
  // each edge, keeping only those whose intersection exists.
  const [s11, xyzz11] = Shadow11(p1q1, inP, inQ, expandP)
  console.log('s11 size =', s11.length)

  // Build up Z-projection of vertices onto triangles, keeping only those that
  // fall inside the triangle.
  const [s02, z02] = Shadow02(inP, inQ, p0q2, true, expandP)
  console.log('s02 size =', s02.length)

  const [s20, z20] = Shadow02(inQ, inP, p2q0, false, expandP)
  console.log('s20 size =', s20.length)

  // Level 3
  // Build up the intersection of the edges and triangles, keeping only those
  // that intersect, and record the direction the edge is passing through the
  // triangle.
  ;[x12, v12] = Intersect12(inP, inQ, s02, p0q2, s11, p1q1, z02, xyzz11, p1q2, true)
  console.log('x12 size =', x12.length)

  ;[x21, v21] = Intersect12(inQ, inP, s20, p2q0, s11, p1q1, z20, xyzz11, p2q1, false)
  console.log('x21 size =', x21.length)

  // Sum up the winding numbers of all vertices.
  w03 = Winding03(inP, p0q2, s02, false)
  w30 = Winding03(inQ, p2q0, s20, true)

  return result(op, inP, inQ, p1q2, p2q1, x12, x21, v12, v21, w03, w30)
}
