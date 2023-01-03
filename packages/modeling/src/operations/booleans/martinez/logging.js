import * as vec2 from '../../../maths/vec2/index.js'

export const compactEvent = (e, sortedEvents = []) => {
  return {
    left: e.left,
    point: e.point,
    pointName: name(e.point),
    otherEvent: `sortedEvents[${sortedEvents.indexOf(e.otherEvent)}]`,
    edgeName: `${name(e.point)}${name(e.otherEvent.point)}`,
    isSubject: e.isSubject,
    type: typeName(e.type),
    inOut: e.inOut,
    otherInOut: e.otherInOut,
    prevInResult: e.prevInResult ? `sortedEvents[${sortedEvents.indexOf(e.prevInResult)}]` : e.prevInResult,
    resultTransition: e.resultTransition,
    otherPos: e.otherPos,
    outputContourId: e.outputContourId,
    isExteriorRing: e.isExteriorRing,
    contourId: e.contourId
  }
}

const typeName = (t) => {
  return ['normal', 'non-contrib', 'same-trans', 'diff-trans'][t]
}

export const name = (point) => {
  const points = [
    [-5, 0],
    [4.707106781186547, 0.7071067811865477],
    [4, 1],
    [0, 1],
    [3.477592250072517, 0.7836116248912244],
    [2.564081902288895, 0.8404535446987661]
  ]

  // Find the index of the point in the points array
  const index = points.findIndex((p) => vec2.equals(p, point))

  if (index < 0) {
    console.log('Unexpected point', point)
  }

  // Return the letter corresponding to the index
  return "ABCDEF"[index]
}

export const edgeName = (e) => {
  return `${name(e.point)}${name(e.otherEvent.point)}`
}

export const edgeShort = (e) => {
  const subj = e.isSubject ? 'subj' : 'clip' // TODO: how to get in other impl?
  const lr = e.left ? 'left' : 'rght'
  const type = e.type ? ' ' + typeName(e.type) : ''
  return `${edgeName(e)} ${lr}${type}`
}
