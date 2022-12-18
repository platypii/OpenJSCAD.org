const flatten = require('../../utils/flatten')

const boolean = require('./martinez')
const { DIFFERENCE } = require('./martinez/operation')

/*
 * Return a new 2D geometry representing space in the first geometry but
 * not in the subsequent geometries. None of the given geometries are modified.
 * @param {...geom2} geometries - list of geometries
 * @returns {geom2} new 2D geometry
 */
const subtract = (...geometries) => {
  geometries = flatten(geometries)

  let newgeometry = geometries.shift()
  geometries.forEach((geometry) => {
    newgeometry = boolean(newgeometry, geometry, DIFFERENCE)
  })

  return newgeometry
}

module.exports = subtract
