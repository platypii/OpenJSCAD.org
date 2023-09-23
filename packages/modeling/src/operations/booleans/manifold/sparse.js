import { permute } from './utils.js'

/**
 * COO-style sparse matrix storage. Values corresponding to these indicies are
 * stored in vectors separate from this class, but having the same length.
 */
export class SparseIndices {
  constructor (length) {
    this.length = length
    this.p = new Array(length)
    this.q = new Array(length)
    this.index = new Array(length)
  }

  /**
   * @param {boolean} useQ - true to use q, false to use p
   */
  get (useQ) {
    return useQ ? this.q : this.p
  }

  pq () {
    return this.p.map((_, i) => [this.p[i], this.q[i]])
  }

  /**
   * @param {number} index - index to set
   * @param {number} p - first value
   * @param {number} q - second value
   */
  set (index, p, q) {
    if (index >= this.length) throw new Error(`index ${index} out of bounds ${this.length}`)
    this.p[index] = p
    this.q[index] = q
  }

  forEach (fn) {
    this.p.forEach((_, i) => fn([this.p[i], this.q[i]], i))
  }

  isSorted () {
    return false // TODO
  }

  /**
   * Remove indicies where v is NaN or Infinity
   * @param {number[]|number[][]} v - values to check
   * @param {number[]} x - other values to filter
   */
  keepFinite (v, x) {
    if (x.length !== this.p.length) {
      throw new Error('different number of values than indicies')
    }
    const finite = v.map((value) => {
      if (typeof value === 'number') return Number.isFinite(value)
      if (Array.isArray(value)) return value.every(Number.isFinite)
      return false
    })
    this.q = this.q.filter((_, i) => finite[i])
    this.p = this.p.filter((_, i) => finite[i])
    this.length = this.p.length
    // Also remove from v and x, in place
    for (let i = v.length - 1; i >= 0; i--) {
      if (!finite[i]) {
        v.splice(i, 1)
        x.splice(i, 1)
      }
    }
  }

  swapPQ () {
    const tmp = this.q
    this.q = this.p
    this.p = tmp
  }

  /**
   * Sort by p then q.
   */
  sort () {
    // Sort by p then q
    const order = Array.from({ length: this.length }, (_, i) => i)
    order.sort((a, b) => this.p[a] - this.p[b] || this.q[a] - this.q[b])
    permute(this.p, order)
    permute(this.q, order)
  }

  unique () {
    this.sort()
    const dups = this.p.map((_, i) => this.p[i] === this.p[i - 1] && this.q[i] === this.q[i - 1])
    this.p = this.p.filter((_, i) => !dups[i])
    this.q = this.q.filter((_, i) => !dups[i])
    this.length = this.p.length
  }

  /**
   * @param {Array} key the key to search for
   * @returns index of the key, or -1 if not found
   */
  binarySearch (key) {
    if (this.length <= 0) return -1
    let left = 0
    let right = this.length - 1
    let m
    let keyM
    while (true) {
      m = right - Math.floor((right - left) / 2)
      keyM = [this.p[m], this.q[m]]
      if (left === right) break
      if ((keyM[0] > key[0]) || (keyM[0] === key[0] && keyM[1] > key[1])) {
        right = m - 1
      } else {
        left = m
      }
    }
    if (keyM[0] === key[0] && keyM[1] === key[1]) {
      return m
    } else {
      return -1
    }
  }

  reduceByKey (useQ, s02) {
    const w03vert = []
    const w03val = []

    // sum known s02 values into w03 (winding number)
    // reduce this and s02 where this.get(useQ) is equal
    const acc = this.pq().reduce((acc, [p, q], index) => {
      const key = useQ ? q : p
      const value = s02[index]
      if (acc.prevKey !== key) {
        if (acc.prevKey !== null) {
          w03vert.push(acc.prevKey)
          w03val.push(acc.sum)
        }
        acc.sum = value
        acc.prevKey = key
      } else {
        acc.sum += value
      }
      return acc
    }, { prevKey: null, sum: 0 })

    if (acc.prevKey !== null) {
      w03vert.push(acc.prevKey)
      w03val.push(acc.sum)
    }

    return [w03vert, w03val]
  }
}
