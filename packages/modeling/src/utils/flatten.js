/**
 * Flatten the given list of arguments into a single flat array.
 * The arguments can be composed of multiple depths of objects and arrays.
 * @param {Array} arr - list of arguments
 * @returns {Array} a flat list of arguments
 * @alias module:modeling/utils.flatten
 */
const flatten = (arr) => flattenHelper(arr, [])

// Helper to recursively append to a given list.
// This is MUCH faster than other flatten methods.
const flattenHelper = (arr, out) => {
  if (Array.isArray(arr)) {
    arr.forEach((child) => flattenHelper(child, out))
  } else {
    out.push(arr)
  }
  return out
}

module.exports = flatten
