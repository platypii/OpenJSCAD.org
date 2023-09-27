
/**
 * PriorityQueue implemented as a Min-Heap with a comparison function.
 * Mimics std::priority_queue from C++ STL.
 */
export class PriorityQueue {
  /**
   * @param {function} compareFn - comparison function for priority
   */
  constructor(compareFn = (a, b) => a > b) {
    this.heap = []
    this.compareFn = compareFn
  }

  /**
   * Remove and return the element with minimum priority based on the compareFn.
   * @returns {any} - element with minimum priority
   */
  pop () {
    const min = this.heap[0]

    if (this.heap.length > 0) {
      this.popHeap()
      // console.log('post popHeap', this.heap)
      this.heap.pop()
      // console.log('post pop', this.heap)
    }

    return min
  }

  /**
   * Insert an item into the priority queue.
   * @param {any} value - value to be inserted
   */
  push (value) {
    this.heap.push(value)
    this.pushHeap()
  }

  size () {
    return this.heap.length
  }

  /**
   * Peek at the element with minimum priority based on the compareFn.
   * @returns {any} - element with minimum priority
   */
  top () {
    return this.heap[0]
  }

  /**
   * Helper function to bubble up the last element after push.
   * Equivalent to std::push_heap.
   *
   * This operation pushes the element at __last-1 onto the valid
   * heap over the range [__first,__last-1). After completion,
   * [__first,__last) is a valid heap. Compare operations are
   * performed using comp.
   */
  pushHeap () {
    let index = this.heap.length - 1
    const value = this.heap[index]

    let parent = Math.trunc((index - 1) / 2)
    while (index > 0 && this.compareFn(this.heap[parent], value)) {
      this.heap[index] = this.heap[parent]
      // [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]]
      index = parent
      parent = Math.floor((index - 1) / 2)
    }
    this.heap[index] = value
  }

  /**
   * Helper function to bubble down the root element after pop.
   * Equivalent to std::pop_heap.
   *
   * This operation pops the top of the heap.  The elements __first
   * and __last-1 are swapped and [__first,__last-1) is made into a
   * heap.
   */
  popHeap () {
    // Swap the root element with the last element

    const length = this.heap.length - 1 // exclude last element
    const value = this.heap[length]
    let index = 0
    let secondChild = 0

    // Adjust the heap
    while (secondChild < Math.floor((length - 1) / 2)) {
      secondChild = 2 * secondChild + 2
      if (this.compareFn(this.heap[secondChild], this.heap[secondChild - 1])) {
        secondChild--
      }

      this.heap[index] = this.heap[secondChild]
      index = secondChild
    }

    // If the length is even, we might have one child left that was not
    // checked in the loop above
    if (length % 2 === 0 && secondChild === Math.floor((length - 2) / 2)) {
      secondChild = 2 * secondChild + 2
      this.heap[index] = this.heap[secondChild - 1]
      index = secondChild - 1
    }

    // Bubble up the element we swapped into the root
    let parent = Math.trunc((index - 1) / 2)
    while (index > 0 && this.compareFn(this.heap[parent], value)) {
      this.heap[index] = this.heap[parent]
      index = parent
      parent = Math.floor((index - 1) / 2)
    }

    this.heap[index] = value
  }
}
