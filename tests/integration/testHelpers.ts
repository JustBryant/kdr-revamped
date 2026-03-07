const { computeLevel, sampleArray, weightedPickIndex, weightedSampleArray } = require('../../lib/shopHelpers')

function assert(cond: boolean, msg?: string) {
  if (!cond) throw new Error(msg || 'Assertion failed')
}

export async function runHelperTests() {
  // computeLevel
  assert(computeLevel(0, [0, 100, 300]) === 0, 'level0')
  assert(computeLevel(100, [0, 100, 300]) === 1, 'level1')
  assert(computeLevel(299, [0, 100, 300]) === 1, 'level1b')
  assert(computeLevel(300, [0, 100, 300]) === 2, 'level2')

  // sampleArray uniqueness and count
  const arr = [1,2,3,4,5]
  const s = sampleArray(arr, 3)
  assert(s.length === 3, 'sample length')
  assert(new Set(s).size === 3, 'sample unique')

  // weightedPickIndex basic
  const counts: Record<number, number> = {}
  for (let i=0;i<1000;i++) {
    const idx = weightedPickIndex([0,1,0])
    counts[idx] = (counts[idx] || 0) + 1
  }
  assert((counts[1] || 0) > 0, 'weightedPickIndex picks middle')

  // weightedSampleArray respects weights
  const items = [{id:'a',w:1},{id:'b',w:10},{id:'c',w:1}]
  const picked = weightedSampleArray(items, (x: any) => x.w, 2)
  assert(picked.length === 2, 'weighted sample count')

  console.log('Helper tests passed')
}
