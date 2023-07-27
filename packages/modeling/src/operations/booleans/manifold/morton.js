/*
 * Copyright 2021 The Manifold Authors
 * https://github.com/elalish/manifold
 * JS port by @platypii
 */

import * as vec3 from '../../../maths/vec3/index.js'
import * as bbox from './bbox.js'

export const kNoCode = 0xFFFFFFFF

/**
 * Calculates the Morton code of a position within a bounding box.
 * @param {Array} position - The position for which to calculate the Morton code.
 * @param {Object} bBox - The bounding box within which to calculate the Morton code.
 * @returns {Number} The calculated Morton code.
 */
export const morton = (position, bBox) => {
  // Unreferenced vertices are marked NaN, and this will sort them to the end
  // (the Morton code only uses the first 30 of 32 bits).
  if (isNaN(position[0])) return kNoCode

  const xyz = position
    .map((coord, i) => (coord - bBox.min[i]) / (bBox.max[i] - bBox.min[i]))
    .map((coord) => Math.min(1023, Math.max(0, 1024 * coord)))

  const x = spreadBits3(Math.floor(xyz[0]))
  const y = spreadBits3(Math.floor(xyz[1]))
  const z = spreadBits3(Math.floor(xyz[2]))
  return x * 4 + y * 2 + z
}

const spreadBits3 = (v) => {
  v = 0xFF0000FF & (v * 0x00010001)
  v = 0x0F00F00F & (v * 0x00000101)
  v = 0xC30C30C3 & (v * 0x00000011)
  v = 0x49249249 & (v * 0x00000005)
  return v
}

export const getFaceBoxMorton = (inP, faceBox, faceMorton) => {
  const numTri = inP.numTri()
  for (let face = 0; face < numTri; face++) {
    const center = vec3.create()
    faceBox[face] = bbox.create()

    // Removed tris are marked by all halfedges having pairedHalfedge = -1, and
    // this will sort them to the end (the Morton code only uses the first 30 of
    // 32 bits).
    if (inP.halfedge[3 * face].pairedHalfedge < 0) {
      return { mortonCode: kNoCode, faceBox }
    }

    for (const i of [0, 1, 2]) {
      const pos = inP.vertPos[inP.halfedge[3 * face + i].startVert]
      vec3.add(center, center, pos)
      // expand face box
      bbox.expand(faceBox[face], pos)
    }
    vec3.scale(center, center, 1 / 3)
    faceMorton[face] = morton(center, inP.bBox)
  }
}
