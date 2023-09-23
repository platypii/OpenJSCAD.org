/*
 * Copyright 2021 The Manifold Authors
 * https://github.com/elalish/manifold
 * JS port by @platypii
 */

/**
 * @typedef {import('./manifold.js').Manifold} Manifold
 */

import * as vec3 from '../../../maths/vec3/index.js'
import { triangulateIdx } from './triangulator/polygon.js'
import { CCW, dot, getAxisAlignedProjection } from './utils.js'

/**
 * Triangulates the faces. In this case, the halfedge vector is not yet a set
 * of triangles as required by this data structure, but is instead a set of
 * general faces with the input faceEdge vector having length of the number of
 * faces + 1. The values are indicies into the halfedge vector for the first
 * edge of each face, with the final value being the length of the halfedge
 * vector itself. Upon return, halfedge has been lengthened and properly
 * represents the mesh as a set of triangles as usual. In this process the
 * faceNormal values are retained, repeated as necessary.
 * @param {Manifold} inP
 * @param {number[]} faceEdge
 */
export const face2Tri = (inP, faceEdge, halfedgeRef) => {
  const triVerts = []
  const triNormal = []
  const addTri = (face, tri, normal, triRef) => {
    triVerts.push(tri)
    triNormal.push(normal)
    inP.meshRelation.triRef.push(triRef)
  }

  for (let face = 0; face < faceEdge.length - 1; face++) {
    const firstEdge = faceEdge[face]
    const lastEdge = faceEdge[face + 1]
    const numEdge = lastEdge - firstEdge

    if (numEdge < 3) throw new Error('face has less than three edges ' + numEdge)
    const normal = inP.faceNormal[face]

    if (numEdge === 3) {
      // Single triangle
      const tri = vec3.fromValues(
        inP.halfedge[firstEdge].startVert,
        inP.halfedge[firstEdge + 1].startVert,
        inP.halfedge[firstEdge + 2].startVert
      )
      const ends = vec3.fromValues(
        inP.halfedge[firstEdge].endVert,
        inP.halfedge[firstEdge + 1].endVert,
        inP.halfedge[firstEdge + 2].endVert
      )
      if (ends[0] === tri[2]) {
        [tri[1], tri[2]] = [tri[2], tri[1]]
        ;[ends[1], ends[2]] = [ends[2], ends[1]]
      }
      if (ends[0] !== tri[1] || ends[1] !== tri[2] || ends[2] !== tri[0]) {
        throw new Error('These 3 edges do not form a triangle')
      }

      addTri(face, tri, normal, halfedgeRef[firstEdge])
    } else if (numEdge === 4) {
      // Pair of triangles
      const projection = getAxisAlignedProjection(normal)
      const triCCW = (tri) => CCW(
        dot(projection, inP.vertPos[tri[0]]),
        dot(projection, inP.vertPos[tri[1]]),
        dot(projection, inP.vertPos[tri[2]]),
        inP.precision) >= 0

      const tri0 = vec3.fromValues(
        inP.halfedge[firstEdge].startVert,
        inP.halfedge[firstEdge].endVert,
        -1
      )
      const tri1 = vec3.fromValues(-1, -1, tri0[0])
      for (const i of [1, 2, 3]) {
        if (inP.halfedge[firstEdge + i].startVert === tri0[1]) {
          tri0[2] = inP.halfedge[firstEdge + i].endVert
          tri1[0] = tri0[2]
        }
        if (inP.halfedge[firstEdge + i].endVert === tri0[0]) {
          tri1[1] = inP.halfedge[firstEdge + i].startVert
        }
      }
      if (tri0.some((v) => v < 0) || tri1.some((v) => v < 0)) {
        throw new Error('non-manifold quad')
      }

      const firstValid = triCCW(tri0) && triCCW(tri1)
      tri0[2] = tri1[1]
      tri1[2] = tri0[1]
      const secondValid = triCCW(tri0) && triCCW(tri1)

      if (!secondValid) {
        tri0[2] = tri1[0]
        tri1[2] = tri0[0]
      } else if (firstValid) {
        const firstCross = vec3.subtract(vec3.create(), inP.vertPos[tri0[0]], inP.vertPos[tri1[0]])
        const secondCross = vec3.subtract(vec3.create(), inP.vertPos[tri0[1]], inP.vertPos[tri1[1]])
        if (vec3.dot(firstCross, firstCross) < vec3.dot(secondCross, secondCross)) {
          tri0[2] = tri1[0]
          tri1[2] = tri0[0]
        }
      }

      for (const tri of [tri0, tri1]) {
        addTri(face, tri, normal, halfedgeRef[firstEdge])
      }
    } else {
      // General triangulation
      const projection = getAxisAlignedProjection(normal)
      const polys = face2Polygons(inP, face, projection, faceEdge)

      // triangulate the polygons
      const newTris = triangulateIdx(polys, inP.precision)
      newTris.forEach((tri) => {
        addTri(face, tri, normal, halfedgeRef[firstEdge])
      })
    }
  }
  inP.faceNormal = triNormal.slice() // Assuming a move operation is required?
  inP.createHalfedges(triVerts)
}

/**
 * For the input face index, return a set of 2D polygons formed by the input
 * projection of the vertices.
 * @param {Manifold} inP - the input manifold
 * @param {number} face
 * @param {[Vec2, Vec2, Vec2]} projection - a 3x2 projection matrix
 * @param {number[]} faceEdge
 */
const face2Polygons = (inP, face, projection, faceEdge) => {
  const firstEdge = faceEdge[face]
  const lastEdge = faceEdge[face + 1]

  const vertEdge = new Map()
  for (let edge = firstEdge; edge < lastEdge; ++edge) {
    if (vertEdge.has(inP.halfedge[edge].startVert)) {
      throw new Error('face has duplicate vertices')
    }
    vertEdge.set(inP.halfedge[edge].startVert, edge)
  }

  const polys = []
  let startEdge = 0
  let thisEdge = startEdge
  while (true) {
    if (thisEdge === startEdge) {
      // Start a new poly
      if (vertEdge.size === 0) break
      startEdge = vertEdge.values().next().value
      thisEdge = startEdge
      polys.push([])
    }

    const vert = inP.halfedge[thisEdge].startVert
    const v = inP.vertPos[vert]

    polys[polys.length - 1].push({
      pos: [
        projection[0][0] * v[0] + projection[1][0] * v[1] + projection[2][0] * v[2],
        projection[0][1] * v[0] + projection[1][1] * v[1] + projection[2][1] * v[2]
      ],
      idx: vert
    })
    const next = inP.halfedge[thisEdge].endVert
    const result = vertEdge.get(next)
    if (result === undefined) {
      throw new Error('non-manifold edge')
    }
    thisEdge = result
    vertEdge.delete(next)
  }
  return polys
}
