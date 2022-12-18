const flatten = require('../../utils/flatten')

const boolean = require('./martinez')
const { INTERSECTION } = require('./martinez/operation')

/*
 * Return a new 2D geometry representing space in both the first geometry and
 * in the subsequent geometries. None of the given geometries are modified.
 * @param {...geom2} geometries - list of 2D geometries
 * @returns {geom2} new 2D geometry
 */
const intersect = (...geometries) => {
  geometries = flatten(geometries)

  let newgeometry = geometries.shift()
  geometries.forEach((geometry) => {
    newgeometry = boolean(newgeometry, geometry, INTERSECTION)
  })

  return newgeometry
}

module.exports = intersect
