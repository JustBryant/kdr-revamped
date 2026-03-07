function computeLevel(xp, xpCurve) {
  if (!Array.isArray(xpCurve) || xpCurve.length === 0) return 0
  let level = 0
  for (let i = 0; i < xpCurve.length; i++) {
    if (xp >= xpCurve[i]) level = i
    else break
  }
  return level
}

function sampleArray(arr, count) {
  const copy = [...arr]
  const out = []
  while (out.length < count && copy.length > 0) {
    const idx = Math.floor(Math.random() * copy.length)
    out.push(copy.splice(idx, 1)[0])
  }
  return out
}

function weightedPickIndex(weights) {
  const total = weights.reduce((s, w) => s + (w > 0 ? w : 0), 0)
  if (total <= 0) return -1
  let r = Math.random() * total
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] > 0 ? weights[i] : 0
    if (r < w) return i
    r -= w
  }
  return weights.length - 1
}

function weightedSampleArray(items, weightFn, count) {
  const copy = [...items]
  const out = []
  while (out.length < count && copy.length > 0) {
    const weights = copy.map(weightFn)
    const idx = weightedPickIndex(weights)
    if (idx < 0 || idx >= copy.length) break
    out.push(copy.splice(idx, 1)[0])
  }
  return out
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed')
}

async function runHelperTests() {
  assert(computeLevel(0, [0, 100, 300]) === 0, 'level0')
  assert(computeLevel(100, [0, 100, 300]) === 1, 'level1')
  assert(computeLevel(299, [0, 100, 300]) === 1, 'level1b')
  assert(computeLevel(300, [0, 100, 300]) === 2, 'level2')

  const arr = [1,2,3,4,5]
  const s = sampleArray(arr, 3)
  assert(s.length === 3, 'sample length')
  assert(new Set(s).size === 3, 'sample unique')

  const counts = {}
  for (let i=0;i<1000;i++) {
    const idx = weightedPickIndex([0,1,0])
    counts[idx] = (counts[idx] || 0) + 1
  }
  assert((counts[1] || 0) > 0, 'weightedPickIndex picks middle')

  const items = [{id:'a',w:1},{id:'b',w:10},{id:'c',w:1}]
  const picked = weightedSampleArray(items, (x)=>x.w, 2)
  assert(picked.length === 2, 'weighted sample count')

  console.log('Helper tests passed')
}

module.exports = { runHelperTests }
