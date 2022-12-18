/*
 * Implementation of the Martinez 2D polygon clipping algorithm.
 * Copyright (c) 2018 Alexander Milevski
 * https://github.com/w8r/martinez
 *
 * Adapted for JSCAD by @platypii
 */

const subdivideSegments = require('./subdivideSegments')
const connectEdges = require('./connectEdges')
const fillQueue = require('./fillQueue')
const {
  INTERSECTION,
  DIFFERENCE,
  UNION,
  XOR
} = require('./operation')

const geom2 = require('../../../geometries/geom2')
const vec2 = require('../../../maths/vec2')

const EMPTY = []

/*
 * Fast path for trivial operations like intersection with empty geometry
 * Returns null if operation is non-trivial
 */
const trivialOperation = (subject, clipping, operation) => {
  let result = null
  if (subject.length * clipping.length === 0) {
    if (operation === INTERSECTION) {
      return EMPTY
    } else if (operation === DIFFERENCE) {
      result = subject
    } else if (operation === UNION ||
               operation === XOR) {
      result = (subject.length === 0) ? clipping : subject
    }
  }
  if (result === EMPTY) {
    return geom2.create()
  } else if (result) {
    return geom2.fromOutlines(result.flat())
  } else {
    return null
  }
}

/*
 * Fast path for non-intersecting subjects
 * Returns null if operation is non-trivial
 */
const compareBBoxes = (subject, clipping, sbbox, cbbox, operation) => {
  let result = null
  if (sbbox[0] > cbbox[2] ||
      cbbox[0] > sbbox[2] ||
      sbbox[1] > cbbox[3] ||
      cbbox[1] > sbbox[3]) {
    if (operation === INTERSECTION) {
      result = EMPTY
    } else if (operation === DIFFERENCE) {
      result = subject
    } else if (operation === UNION ||
               operation === XOR) {
      result = subject.concat(clipping)
    }
  }
  if (result === EMPTY) {
    return geom2.create()
  } else if (result) {
    return geom2.fromOutlines(result.flat())
  } else {
    return null
  }
}

/*
 * Convert from geom2 to martinez data structure
 */
const toMartinez = (geometry) => {
  const outlines = []
  geom2.toOutlines(geometry).forEach((outline) => {
    // Martinez expects first point == last point
    if (vec2.equals(outline[0], outline[outline.length - 1])) {
      outlines.push(outline)
    } else {
      outlines.push([...outline, outline[0]])
    }
  })
  return [outlines]
}

const boolean = (subjectGeom, clippingGeom, operation) => {
  // Convert from geom2 to outlines
  const subject = toMartinez(subjectGeom)
  const clipping = toMartinez(clippingGeom)

  let trivial = trivialOperation(subject, clipping, operation)
  if (trivial) {
    return trivial
  }
  const sbbox = [Infinity, Infinity, -Infinity, -Infinity]
  const cbbox = [Infinity, Infinity, -Infinity, -Infinity]

  const eventQueue = fillQueue(subject, clipping, sbbox, cbbox, operation)

  trivial = compareBBoxes(subject, clipping, sbbox, cbbox, operation)
  if (trivial) {
    return trivial
  }
  const sortedEvents = subdivideSegments(eventQueue, subject, clipping, sbbox, cbbox, operation)

  const contours = connectEdges(sortedEvents, operation)

  // Convert contours to geom2
  const polygons = []
  for (let i = 0; i < contours.length; i++) {
    const contour = contours[i]
    if (contour.isExterior()) {
      // The exterior ring goes first
      const rings = [contour.points]
      // Followed by holes if any
      for (let j = 0; j < contour.holeIds.length; j++) {
        const holeId = contour.holeIds[j]
        const holePoints = contours[holeId].points
        const hole = []
        for (let k = holePoints.length - 2; k >= 0; k--) {
          hole.push(holePoints[k])
        }
        rings.push(hole)
      }
      polygons.push(rings)
    }
  }

  if (polygons) {
    return geom2.fromOutlines(polygons.flat())
  } else {
    return geom2.create()
  }
}

module.exports = boolean
