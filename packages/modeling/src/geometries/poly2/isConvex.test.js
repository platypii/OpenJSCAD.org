const test = require('ava')

const { isConvex, create } = require('./index')

test('poly2: isConvex() should return correct values', (t) => {
  const ply1 = create()
  t.true(isConvex(ply1))

  // clockwise, not convex
  const ply2 = create([[1, 1], [1, 0], [0, 0]])
  t.false(isConvex(ply2))

  const points2ccw = [[0, 0], [10, 10], [0, 5]]
  const ply3 = create(points2ccw)
  t.true(isConvex(ply3))

  // clockwise, not convex
  const points2cw = [[0, 0], [-10, 10], [0, 5]]
  const ply4 = create(points2cw)
  t.false(isConvex(ply4))

  // V-shape
  const pointsV = [[0, 0], [-10, 10], [0, 5], [10, 10]]
  const ply5 = create(pointsV)
  t.false(isConvex(ply5))
})
