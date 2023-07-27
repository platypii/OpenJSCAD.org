/*
 * Copyright 2021 The Manifold Authors
 * https://github.com/elalish/manifold
 * JS port by @platypii
 */

import * as vec4 from '../../../maths/vec4/index.js'

// These two functions (Interpolate and Intersect) are the only places where
// floating-point operations take place in the whole Boolean function. These are
// carefully designed to minimize rounding error and to eliminate it at edge
// cases to ensure consistency.

/**
 * Intersect two line segments.
 *
 * Computes the intersection in x/y plane, and then returns
 * the z value for first and second line segments.
 *
 * Given two segments (xL,yAL)->(xR,yAR) and (xL,yBL)->(xR,yBR)
 * where yAL <= yBL and yBR <= yAR, with one of the inequalities
 * being strict, determine the point of intersection.
 *
 * @param {Vec3} pL left point of first line segment
 * @param {Vec3} pR right point of first line segment
 * @param {Vec3} qL left point of second line segment
 * @param {Vec3} qR right point of second line segment
 * @returns {Vec4} intersection point
 */
export const intersect = (pL, pR, qL, qR) => {
  if (!Array.isArray(pL) || pL.length !== 3) throw new Error('pL must be a vec3 ' + pL)
  if (!Array.isArray(pR) || pR.length !== 3) throw new Error('pR must be a vec3 ' + pR)
  if (!Array.isArray(qL) || qL.length !== 3) throw new Error('qL must be a vec3 ' + qL)
  if (!Array.isArray(qR) || qR.length !== 3) throw new Error('qR must be a vec3 ' + qR)
  if (pL[0] !== qL[0] || pR[0] !== qR[0]) throw new Error('intersect x range mismatch')
  const dyL = qL[1] - pL[1]
  const dyR = qR[1] - pR[1]
  if (dyL * dyR > 0) throw new Error('no intersection')
  const useL = Math.abs(dyL) < Math.abs(dyR)
  const dx = pR[0] - pL[0]
  let lambda = (useL ? dyL : dyR) / (dyL - dyR)
  if (!Number.isFinite(lambda)) lambda = 0

  const x = (useL ? pL[0] : pR[0]) + lambda * dx
  const pDy = pR[1] - pL[1]
  const qDy = qR[1] - qL[1]
  const useP = Math.abs(pDy) < Math.abs(qDy)
  const y = (useL ? (useP ? pL[1] : qL[1]) : (useP ? pR[1] : qR[1])) +
           lambda * (useP ? pDy : qDy)
  const z = (useL ? pL[2] : pR[2]) + lambda * (pR[2] - pL[2]) // z for p
  const w = (useL ? qL[2] : qR[2]) + lambda * (qR[2] - qL[2]) // z for q
  return vec4.fromValues(x, y, z, w)
}
