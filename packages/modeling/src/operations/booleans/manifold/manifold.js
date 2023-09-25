/*
 * Copyright 2021 The Manifold Authors
 * https://github.com/elalish/manifold
 * JS port by @platypii
 */

/**
 * @typedef {{ startVert: number, endVert: number, pairedHalfedge: number, face: number }} Halfedge
 */

import * as geom3 from '../../../geometries/geom3/index.js'
import * as vec3 from '../../../maths/vec3/index.js'
import { generalize } from '../../modifiers/generalize.js'
import * as bbox from './bbox.js'
import { Collider } from './collider.js'
import { connectedComponents } from './connectedComponents.js'
import { simplifyTopology } from './edgeOp.js'
import { getFaceBoxMorton, kNoCode, morton } from './morton.js'
import { CCW, dot, getAxisAlignedProjection, isForward, kTolerance, permute, reserveIDs } from './utils.js'

export class Manifold {
  constructor (geometry) {
    /**
     * @type {Vec3[]}
     */
    this.vertPos = []
    /**
     * @type {Halfedge[]}
     */
    this.halfedge = []
    this.precision = 2e-5
    this.meshRelation = { originalID: 1, triRef: [] }

    if (geometry) {
      // manifold expects triangles, no t-junctions
      geometry = generalize({ triangulate: true }, geometry)
      const triVerts = this.triVertsFromGeometry(geometry)
      this.createHalfedges(triVerts)
    }

    // TODO: Remove topological degenerates

    this.calculateBBox()
    // this.splitPinchedVerts()
    this.calculateNormals()
    this.meshRelation.originalID = reserveIDs(1)
    this.finish()
    this.initializeOriginal()
    this.createFaces()
    simplifyTopology(this)
    // this.setPrecision(precision)
    // this.finish() // finish again?
  }

  calculateBBox () {
    this.bBox = bbox.create()
    this.vertPos.forEach((vert) => bbox.expand(this.bBox, vert))
  }

  triVertsFromGeometry (geometry) {
    // map from unique vertex string to index
    const vertices = new Map()
    const getVertexIndex = (vertex) => {
      const key = vertex.toString()
      let index = vertices.get(key)
      if (index === undefined) {
        index = this.vertPos.length
        this.vertPos.push(vertex)
        vertices.set(key, index)
      }
      return index
    }

    // Triangles by vertex index
    return geom3.toPoints(geometry).map((poly) => poly.map((vertex, i) => {
      const index = getVertexIndex(vertex)
      const next = getVertexIndex(poly[(i + 1) % poly.length])
      // generate half edges from geometry
      this.halfedge.push({ startVert: next, endVert: index, pairedHalfedge: -1, face: i })
      return index
    }))
  }

  initializeOriginal () {
    const meshID = this.meshRelation.originalID
    // Don't initialize if it's not an original
    if (meshID < 0) return
    for (let i = 0; i < this.numTri(); i++) {
      this.meshRelation.triRef[i] = { meshID, originalID: meshID, tri: i }
    }

    // TODO: meshIDtransform stuff?
    // this.meshRelation.meshIDtransform.clear()
    // this.meshRelation.meshIDtransform[meshID] = { meshID }
  }

  /**
   * @param {Array} triVerts
   */
  createHalfedges (triVerts) {
    const numTri = triVerts.length
    const numHalfedge = 3 * numTri
    const edges = []
    const ids = Array.from({ length: numHalfedge }, (_, i) => i)
    triVerts.forEach((triVert, index) => {
      this.tri2Halfedges(edges, index, triVert)
    })

    // Stable sort is required here so that halfedges from the same face are
    // paired together (the triangles were created in face order). In some
    // degenerate situations the triangulator can add the same internal edge in
    // two different faces, causing this edge to not be 2-manifold. These are
    // fixed by duplicating verts in SimplifyTopology.
    // JS sort is stable.
    ids.sort((a, b) => edges[a] < edges[b] ? -1 : (edges[a] > edges[b] ? 1 : 0))
    edges.sort((a, b) => a < b ? -1 : (a > b ? 1 : 0))

    // Once sorted, the first half of the range is the forward halfedges, which
    // correspond to their backward pair at the same offset in the second half
    // of the range.
    for (let i = 0; i < numHalfedge / 2; i++) {
      const pair0 = ids[i]
      const pair1 = ids[i + numHalfedge / 2]
      this.halfedge[pair0].pairedHalfedge = pair1
      this.halfedge[pair1].pairedHalfedge = pair0
    }
  }

  /**
   * @param {object} edges
   * @param {number} face
   * @param {Array} triVerts
   */
  tri2Halfedges (edges, face, triVerts) {
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3
      const edge = 3 * face + i
      this.halfedge[edge] = { startVert: triVerts[i], endVert: triVerts[j], pairedHalfedge: -1, face }

      // Sort the forward halfedges in front of the backward ones by setting the highest-order bit.
      edges[edge] = ((BigInt(triVerts[i] < triVerts[j] ? 1 : 0) << BigInt(63)) |
                    (BigInt(Math.min(triVerts[i], triVerts[j])) << BigInt(32)) |
                    BigInt(Math.max(triVerts[i], triVerts[j])))
    }
  }

  /**
   * Once halfedge has been filled in, this function can be called to create the
   * rest of the internal data structures. This function also removes the verts
   * and halfedges flagged for removal (NaN verts and -1 halfedges).
   */
  finish () {
    if (this.halfedge.length === 0) return
    if (!Number.isFinite(this.bBox.min[0])) {
      // Decimated out of existence - early out.
      return
    }

    const faceBox = [] // list of face bboxes
    const faceMorton = [] // list of face morton codes

    this.sortVerts()
    getFaceBoxMorton(this, faceBox, faceMorton)
    this.sortFaces(faceBox, faceMorton)
    if (this.halfedge.length === 0) return
    // this.compactProps()

    if (this.halfedge.length % 6 !== 0) {
      throw new Error('not an even number of faces after sorting faces')
    }
    // if (extrema.startVert < 0) throw new Error('vertex index is negative')
    // if (extrema.endVert >= this.triVerts.length) throw new Error('vertex index exceeds number of verts')
    // if (extrema.face < 0) throw new Error('face index is negative')
    // if (extrema.face >= this.numTri()) throw new Error('face index exceeds number of faces')
    // if (extrema.pairedHalfedge < 0) throw new Error('halfedge index is negative')
    // if (extrema.pairedHalfedge >= 2 * NumEdge()) throw new Error('halfedge index exceeds number of halfedges')
    // if (meshRelation.triRef.length !== this.numTri() && meshRelation.triRef.length !== 0) throw new Error('mesh relation doesn\'t fit')
    // if (faceNormal.length !== this.numTri() && faceNormal.length !== 0) throw new Error(`faceNormal size = ${faceNormal.length}, NumTri = ${NumTri}`)
    // TODO: figure out why this has a flaky failure and then enable reading vertNormals from a Mesh.
    // if (vertNormal.length !== NumVert() && vertNormal.length !== 0) throw new Error(`vertNormal size = ${vertNormal.length}, NumVert = ${NumVert()}`)

    this.calculateNormals()
    this.collider = new Collider(faceBox, faceMorton)
  }

  /**
   * Sorts the vertices according to their Morton code.
   */
  sortVerts () {
    const numVert = this.vertPos.length
    const vertNew2Old = Array.from({ length: numVert }, (_, i) => i)

    // Calculate Morton codes for vertices
    const vertMorton = this.vertPos.map((vertex) => morton(vertex, this.bBox))

    // Create array of indices sorted by Morton codes
    vertNew2Old.sort((a, b) => vertMorton[a] - vertMorton[b])
    vertMorton.sort((a, b) => a - b)

    this.reindexVerts(vertNew2Old, numVert)

    // Verts were flagged for removal with NaNs and assigned kNoCode to sort
    // them to the end, which allows them to be removed.
    // Find the index of the first element that has the Morton code as kNoCode
    let newNumVert = vertMorton.findIndex((code) => code === kNoCode)
    if (newNumVert === -1) newNumVert = numVert

    const vertNew2OldFiltered = vertNew2Old.slice(0, newNumVert)
    permute(this.vertPos, vertNew2OldFiltered)

    if (this.vertNormal.length === numVert) {
      permute(this.vertNormal, vertNew2OldFiltered)
    }
  }

  /**
   * Sorts the faces of this manifold according to their input Morton code. The
   * bounding box and Morton code arrays are also sorted accordingly.
   * @param {Array} faceBox - array of face bounding boxes
   * @param {number[]} faceMorton - array of face Morton codes
   */
  sortFaces (faceBox, faceMorton) {
    const numTri = this.numTri()
    const faceNew2Old = Array.from({ length: numTri }, (_, i) => i)

    // Create array of indices sorted by Morton codes
    faceNew2Old.sort((a, b) => faceMorton[a] - faceMorton[b])
    faceMorton.sort((a, b) => a - b)

    // Tris were flagged for removal with pairedHalfedge = -1 and assigned kNoCode
    // to sort them to the end, which allows them to be removed.
    // Find the index of the first element that has the Morton code as kNoCode
    let newNumTri = faceMorton.findIndex((code) => code === kNoCode)
    if (newNumTri === -1) newNumTri = numTri

    faceMorton = faceMorton.slice(0, newNumTri)
    const faceNew2OldFiltered = faceNew2Old.slice(0, newNumTri)

    permute(faceBox, faceNew2OldFiltered)
    this.gatherFaces(faceNew2OldFiltered)
  }

  /**
   * Creates the halfedge vector for this manifold by copying a set of faces from
   * another manifold, given by oldHalfedge. Input faceNew2Old defines the old
   * faces to gather into this.
   * @param {number[]} faceNew2Old
   */
  gatherFaces (faceNew2Old) {
    const numTri = faceNew2Old.length
    if (this.faceNormal.length === this.numTri()) {
      permute(this.faceNormal, faceNew2Old)
    }

    const oldHalfedge = [...this.halfedge]
    const oldHalfedgeTangent = undefined // TODO: halfedgeTangent?
    const faceOld2New = Array(oldHalfedge.length / 3).fill(0)

    faceNew2Old.forEach((oldIndex, newIndex) => {
      faceOld2New[oldIndex] = newIndex
    })

    this.halfedge = Array(3 * numTri).fill({})
    // if (oldHalfedgeTangent.length !== 0) {
    //   this.halfedgeTangent = Array.from({ length: 3 * numTri }, () => ({}))
    // }

    for (let i = 0; i < numTri; i++) {
      this.reindexFace(oldHalfedge, oldHalfedgeTangent, faceNew2Old, faceOld2New, i)
    }
  }

  /**
   * @param {number[]} faceNew2Old
   * @param {number[]} faceOld2New
   * @param {number} newFace
   */
  reindexFace (oldHalfedge, oldHalfedgeTangent, faceNew2Old, faceOld2New, newFace) {
    const oldFace = faceNew2Old[newFace]
    for (let i = 0; i < 3; i++) {
      const oldEdge = 3 * oldFace + i
      const edge = oldHalfedge[oldEdge]
      edge.face = newFace
      const pairedFace = Math.floor(edge.pairedHalfedge / 3)
      const offset = edge.pairedHalfedge - 3 * pairedFace
      edge.pairedHalfedge = 3 * faceOld2New[pairedFace] + offset
      const newEdge = 3 * newFace + i
      this.halfedge[newEdge] = edge
      // if (oldHalfedgeTangent) {
      //   this.halfedgeTangent[newEdge] = oldHalfedgeTangent[oldEdge]
      // }
    }
  }

  /**
   * Updates the halfedges to point to new vert indices based on a mapping,
   * vertNew2Old. This may be a subset, so the total number of original verts is
   * also given.
   * @param {Array} vertNew2Old - array of new indices mapped to old ones
   * @param {number} oldNumVert - total number of original vertices
   */
  reindexVerts (vertNew2Old, oldNumVert) {
    const vertOld2New = new Array(oldNumVert).fill(-1)
    vertNew2Old.forEach((oldIndex, newIndex) => {
      vertOld2New[oldIndex] = newIndex
    })

    this.halfedge = this.halfedge.map((edge) => ({
      ...edge,
      startVert: vertOld2New[edge.startVert] ?? edge.startVert,
      endVert: vertOld2New[edge.endVert] ?? edge.endVert
    }))
  }

  numEdge () {
    return this.halfedge.length / 2
  }

  numTri () {
    return this.halfedge.length / 3
  }

  calculateNormals () {
    const numVert = this.vertPos.length
    this.vertNormal = new Array(numVert).fill().map(vec3.create)
    let calculateTriNormal = false

    if (!this.faceNormal || this.faceNormal.length !== this.numTri()) {
      this.faceNormal = new Array(this.numTri()).fill().map(vec3.create)
      calculateTriNormal = true
    }

    for (let i = 0; i < this.numTri(); i++) {
      this.assignNormals(i, calculateTriNormal)
    }

    this.vertNormal.forEach((v) => vec3.normalize(v, v))
  }

  /**
   * Updates the vertex normals and face normals if necessary.
   */
  assignNormals (face, calculateTriNormal) {
    const triVerts = []
    for (let i = 0; i < 3; i++) {
      triVerts[i] = this.halfedge[3 * face + i].startVert
      this.vertNormal[triVerts[i]] = vec3.create()
    }

    const edge = []
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3
      const v1 = this.vertPos[triVerts[i]]
      const v2 = this.vertPos[triVerts[j]]
      const out = vec3.create()
      edge[i] = vec3.normalize(out, vec3.subtract(out, v2, v1))
    }

    if (calculateTriNormal) {
      vec3.normalize(this.faceNormal[face], vec3.cross(vec3.create(), edge[0], edge[1]))
      if (isNaN(this.faceNormal[face][0])) this.faceNormal[face] = [0, 0, 1]
    }

    // corner angles
    const dot = -vec3.dot(edge[2], edge[0])
    const phi = []
    phi[0] = dot >= 1 ? 0 : (dot <= -1 ? Math.PI : Math.acos(dot))
    phi[1] = dot >= 1 ? 0 : (dot <= -1 ? Math.PI : Math.acos(dot))
    phi[2] = Math.PI - phi[0] - phi[1]

    // assign weighted sum
    triVerts.forEach((triVert, i) => {
      const scaled = vec3.scale(vec3.create(), this.faceNormal[face], phi[i])
      vec3.add(this.vertNormal[triVert], this.vertNormal[triVert], scaled)
    })
  }

  vertexCollisionsZ (vertsIn) {
    return this.collider.collisions(vertsIn)
  }

  isEmpty () {
    return this.vertPos.length === 0
  }

  /**
   * Convert back to JSCAD geometry
   */
  toGeometry () {
    const triangles = []
    for (let i = 0; i < this.numTri(); i++) {
      const vertices = []
      for (let j = 0; j < 3; j++) {
        // TODO: should be filtered before this?
        if (this.halfedge[3 * i + j]) {
          const vert = this.vertPos[this.halfedge[3 * i + j].startVert]
          vertices.push(vert)
        }
      }
      if (vertices.length === 0) continue // TODO: should be filtered before this?
      if (vertices.length !== 3) throw new Error('triangle must have 3 vertices')
      triangles.push({ vertices })
    }
    return geom3.create(triangles)
  }

  isManifold () {
    if (this.halfedge.length === 0) return true
    return this.halfedge.every((_, edge) => {
      // Check halfedges
      const halfedge = this.halfedge[edge]
      if (halfedge.startVert === -1 && halfedge.endVert === -1) return true
      if (halfedge.pairedHalfedge === -1) return false

      const paired = this.halfedge[halfedge.pairedHalfedge]
      let good = true
      if (paired.pairedHalfedge !== edge) console.log('pairedHalfedge !== edge')
      if (halfedge.startVert === halfedge.endVert) console.log('startVert === endVert')
      if (halfedge.startVert !== paired.endVert) console.log('startVert !== paired.endVert')
      if (halfedge.endVert !== paired.startVert) console.log('endVert !== paired.startVert')
      good &&= paired.pairedHalfedge === edge
      good &&= halfedge.startVert !== halfedge.endVert
      good &&= halfedge.startVert === paired.endVert
      good &&= halfedge.endVert === paired.startVert
      return good
    })
  }

  /**
   * Returns the number of triangles that are colinear within precision.
   * @returns {number}
   */
  numDegenerateTris () {
    if (this.halfedge.length === 0 || this.faceNormal.length !== this.numTri()) {
      return 1
    }
    let count = 0
    for (let face = 0; face < this.numTri(); face++) {
      // Check CCW
      if (this.halfedge[3 * face].pairedHalfedge < 0) {
        count++
        continue
      }
      const projection = getAxisAlignedProjection(this.faceNormal[face])
      const v = []
      for (let i = 0; i < 3; i++) {
        v[i] = dot(projection, this.vertPos[this.halfedge[3 * face + i].startVert])
      }
      const ccw = CCW(v[0], v[1], v[2], Math.abs(this.precision))
      const check = this.precision > 0 ? ccw >= 0 : ccw === 0
      if (check) {
        count++
      }
    }
    return count
  }

  /**
   * This function condenses all coplanar faces in the relation, and
   * collapses those edges. In the process the relation to ancestor meshes is lost
   * and this new Manifold is marked an original. Properties are preserved, so if
   * they do not match across an edge, that edge will be kept.
   */
  createFaces () {
    const face2face = this.halfedge.map(() => [])
    const vert2vert = this.halfedge.map(() => [])
    const numTri = this.numTri()
    const triArea = Array(numTri)

    // Assuming autoPolicy and other relevant methods are defined elsewhere
    this.halfedge.forEach((halfedge, i) => {
      this.coplanarEdge(triArea, face2face[i], vert2vert[i], i)
    })

    const components = []
    const numComponent = getLabels(components, face2face, numTri)

    const comp2tri = Array(numComponent).fill(-1)
    for (let tri = 0; tri < numTri; tri++) {
      const comp = components[tri]
      const current = comp2tri[comp]
      if (current < 0 || triArea[tri] > triArea[current]) {
        comp2tri[comp] = tri
        triArea[comp] = triArea[tri]
      }
    }

    for (let i = 0; i < numTri; i++) {
      this.checkCoplanarity(comp2tri, components, i)
    }

    this.meshRelation.triRef.forEach((triRef, tri) => {
      const referenceTri = comp2tri[components[tri]]
      if (referenceTri >= 0) {
        triRef.tri = referenceTri
      }
    })
  }

  coplanarEdge (triArea, face2face, vert2vert, edgeIdx) {
    const edge = this.halfedge[edgeIdx]
    const pair = this.halfedge[edge.pairedHalfedge]

    const triRef = this.meshRelation.triRef
    if (triRef[edge.face].meshID !== triRef[pair.face].meshID) return

    const base = this.vertPos[edge.startVert]
    const baseNum = edgeIdx - 3 * edge.face
    const jointNum = edge.pairedHalfedge - 3 * pair.face

    // TODO: triProp stuff?

    if (!isForward(edge)) return

    const edgeNum = baseNum === 0 ? 2 : baseNum - 1
    const pairNum = jointNum === 0 ? 2 : jointNum - 1
    const jointVec = vec3.subtract(vec3.create(), this.vertPos[pair.startVert], base)
    const edgeVec = vec3.subtract(vec3.create(), this.vertPos[this.halfedge[3 * edge.face + edgeNum].startVert], base)
    const pairVec = vec3.subtract(vec3.create(), this.vertPos[this.halfedge[3 * pair.face + pairNum].startVert], base)

    const length = vec3.length(jointVec) > vec3.length(edgeVec) ? vec3.length(jointVec) : vec3.length(edgeVec)
    const lengthPair = vec3.length(jointVec) > vec3.length(pairVec) ? vec3.length(jointVec) : vec3.length(pairVec)
    let normal = vec3.cross(vec3.create(), jointVec, edgeVec)
    const area = vec3.length(normal)
    const areaPair = vec3.length(vec3.cross(vec3.create(), pairVec, jointVec))
    triArea[edge.face] = area
    triArea[pair.face] = areaPair

    if (area < length * this.precision || areaPair < lengthPair * this.precision) return

    const volume = Math.abs(vec3.dot(normal, pairVec))

    if (volume > Math.max(area, areaPair) * this.precision) return

    if (area > 0) {
      vec3.scale(normal, normal, area)
      // TODO: prop stuff?
    }

    face2face[0] = edge.face
    face2face[1] = pair.face
  }

  /**
   * @param {number[]} comp2tri
   * @param {number[]} components
   * @param {number} tri
   */
  checkCoplanarity (comp2tri, components, tri) {
    const component = components[tri]
    const referenceTri = comp2tri[component]
    if (referenceTri < 0 || referenceTri === tri) return

    const origin = this.vertPos[this.halfedge[3 * referenceTri].startVert]
    const normal = vec3.normalize(vec3.create(), vec3.cross(
      vec3.create(),
      vec3.subtract(vec3.create(), this.vertPos[this.halfedge[3 * referenceTri + 1].startVert], origin),
      vec3.subtract(vec3.create(), this.vertPos[this.halfedge[3 * referenceTri + 2].startVert], origin)
    ))

    for (let i = 0; i < 3; i++) {
      const vert = this.vertPos[this.halfedge[3 * tri + i].startVert]
      const dot = vec3.dot(normal, vec3.subtract(vec3.create(), vert, origin))
      // If any component vertex is not coplanar with the component's reference
      // triangle, unmark the entire component so that none of its triangles are
      // marked coplanar.
      if (Math.abs(dot) > this.precision) {
        comp2tri[component] = -1
        break
      }
    }
  }
}

/**
 * @param {number[]} components
 * @param {number[][]} edges
 * @param {number} numNodes
 * @returns {number}
 */
const getLabels = (components, edges, numNodes) => {
  const graph = new Map() // map from vertex to edges
  for (let i = 0; i < numNodes; i++) {
    graph.set(i, [])
  }
  edges.forEach((edge) => {
    if (edge[0] >= 0) {
      // bidirectional
      graph.get(edge[0]).push(edge[1])
      graph.get(edge[1]).push(edge[0])
    }
  })
  return connectedComponents(components, graph)
}
