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
    [100, 200], // A
    [120.44771878596228, 109.55893998720018], // B
    [133.6345063121441, 108.1970243647632], // C
    [157.0231603224197, 105.78147219020022], // D
    [304.10646839831827, 87.1482528134537], // E
    [310, 40], // F
    [400, 0], // G
    [400, 75], // H
    [400, 200], // I
    [300, 120], // J
  ]

  // Find the index of the point in the points array
  const index = points.findIndex((p) => vec2.equals(p, point))

  if (index < 0) {
    console.log('Unexpected point', point)
  }

  // Return the letter corresponding to the index
  return "ABCDEFGHIJ"[index]
}

export const edgeName = (e) => {
  const subj = e.isSubject ? 'S' : 'C' // TODO: how to get in other impl?
  return `${name(e.point)}${name(e.otherEvent.point)}`
}

export const edgeShort = (e) => {
  const subj = e.isSubject ? 'subj' : 'clip' // TODO: how to get in other impl?
  const lr = e.left ? 'left' : 'rght'
  const type = e.type ? ' ' + typeName(e.type) : ''
  return `${edgeName(e)} ${lr}${type}`
}
