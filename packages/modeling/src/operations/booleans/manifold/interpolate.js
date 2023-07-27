/*
 * Copyright 2021 The Manifold Authors
 * https://github.com/elalish/manifold
 * JS port by @platypii
 */

import * as vec2 from '../../../maths/vec2/index.js'

// These two functions (Interpolate and Intersect) are the only places where
// floating-point operations take place in the whole Boolean function. These are
// carefully designed to minimize rounding error and to eliminate it at edge
// cases to ensure consistency.

/**
 * Interpolate between two points at a given x value.
 *
 * For a given segment l->r where l.x < r.x and x in range l.x <= x <= r.x,
 * compute y such that point (x, y) lies on the segment. Paper calls it `yAtX`.
 *
 * @param {Vec3} pL left point
 * @param {Vec3} pR right point
 * @param {Number} x x value to interpolate at
 * @returns {Vec2} interpolated point
 */
export const interpolate = (pL, pR, x) => {
  const dxL = x - pL[0]
  const dxR = x - pR[0]
  if (dxL * dxR > 0) throw new Error('interpolate out of range')
  const useL = Math.abs(dxL) < Math.abs(dxR)
  const lambda = (useL ? dxL : dxR) / (pR[0] - pL[0])
  if (!Number.isFinite(lambda)) return vec2.fromValues(pL[1], pL[2])
  const y = (useL ? pL[1] : pR[1]) + lambda * (pR[1] - pL[1])
  const z = (useL ? pL[2] : pR[2]) + lambda * (pR[2] - pL[2])
  return vec2.fromValues(y, z)
}
