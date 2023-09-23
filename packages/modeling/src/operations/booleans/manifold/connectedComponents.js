
/**
 * Find connected components in a graph
 * @param {number[]} components
 * @param {Map} graph
 * @returns {number}
 */
export const connectedComponents = (components, graph) => {
  if (graph.size === 0) return 0
  const queue = []
  let numComponent = 0
  const roots = [...graph.keys()]
  for (let i = roots.length - 1; i >= 0; i--) { // reverse order to match manifold
    const root = roots[i]
    if (components[root] >= 0) continue // skip visited nodes

    // new component
    components[root] = numComponent
    queue.push(root)
    // traverse all connected nodes
    while (queue.length > 0) {
      const neighbors = graph.get(queue.shift())
      neighbors.forEach((neighbor) => {
        if (components[neighbor] === undefined) { // unvisited
          components[neighbor] = numComponent
          queue.push(neighbor)
        }
      })
    }
    numComponent++
  }
  return numComponent
}
