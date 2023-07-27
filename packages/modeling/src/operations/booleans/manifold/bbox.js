
export const create = () => ({
  min: [Infinity, Infinity, Infinity],
  max: [-Infinity, -Infinity, -Infinity]
})

export const expand = (box, vertex) => {
  for (let i = 0; i < 3; i++) {
    box.min[i] = Math.min(box.min[i], vertex[i])
    box.max[i] = Math.max(box.max[i], vertex[i])
  }
}

export const union = (a, b) => ({
  min: [
    Math.min(a.min[0], b.min[0]),
    Math.min(a.min[1], b.min[1]),
    Math.min(a.min[2], b.min[2])
  ],
  max: [
    Math.max(a.max[0], b.max[0]),
    Math.max(a.max[1], b.max[1]),
    Math.max(a.max[2], b.max[2])
  ]
})

/**
 * bbox: Does this box overlap the one given?
 * vec3: does the given point project within the XY extent of this box?
 */
export const doesOverlap = (box1, box2) => {
  if (Array.isArray(box2)) {
    // vec3
    return box1.min[0] <= box2[0] && box1.max[0] >= box2[0] &&
      box1.min[1] <= box2[1] && box1.max[1] >= box2[1]
  } else {
    // bbox
    return box1.min[0] <= box2.max[0] && box1.max[0] >= box2.min[0] &&
      box1.min[1] <= box2.max[1] && box1.max[1] >= box2.min[1] &&
      box1.min[2] <= box2.max[2] && box1.max[2] >= box2.min[2]
  }
}
