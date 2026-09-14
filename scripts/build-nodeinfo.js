// Usage: node scripts/build-nodeinfo.js [seed] [iterations] [--force]
//
// Derives src/nodeinfo.json from the obfuscated src/publications.json. Runs
// automatically on npm install, start, and build when it does not already exist.
// Output before obfuscating: { nodeId: [names, componentIndex, x, y, scopusAuthorId] }
//   names           all spellings seen for the author, "; " joined; a numeric
//                   prefix ("2; Name") disambiguates authors sharing a name
//   componentIndex  connected components sorted by size, largest first
//   x, y            NetworkX spring layout per component, normalized to [-1, 1]
// Centrality metrics are computed in the browser (src/metric.js), not here.
const fs = require('fs')
const path = require('path')
const Graph = require('graphology')
const { connectedComponents } = require('graphology-components')
const { spawnSync } = require('child_process')
const { root, readSeed, obfuscate, deobfuscate } = require('./obfuscate')

const force = process.argv.includes('--force')
const args = process.argv.slice(2).filter(arg => arg !== '--force')
const seed = readSeed(args[0])
const iterations = Number(args[1] ?? process.env.LAYOUT_ITERATIONS ?? process.env.SPRING_LAYOUT_ITERATIONS ?? 100)
if (!Number.isSafeInteger(iterations) || iterations < 1) {
  throw new Error('Layout iterations must be a positive integer')
}
const source = path.join(root, 'src/publications.json')
const output = path.join(root, 'src/nodeinfo.json')
if (fs.existsSync(output) && !force) {
  console.log('src/nodeinfo.json already exists; reusing saved positions.')
  process.exit(0)
}
if (!fs.existsSync(source)) {
  console.error('src/publications.json is missing. Run: npm run build-data -- <scopus.csv>')
  process.exit(1)
}
const publications = deobfuscate(JSON.parse(fs.readFileSync(source, 'utf8')), seed)

const names = new Map()
const scopusIds = new Map()
const graph = new Graph({ type: 'undirected' })
const split = value => value.split(';').map(v => v.trim())
for (const id of Object.keys(publications.ai)) {
  const ai = publications.ai[id]
  const af = split(publications.af[id])
  const si = split(publications.si[id])
  ai.forEach((node, i) => {
    const key = String(node)
    graph.mergeNode(key)
    if (!names.has(key)) names.set(key, new Set())
    if (af[i]) names.get(key).add(af[i])
    if (si[i] && !scopusIds.has(key)) scopusIds.set(key, Number(si[i]) || si[i])
  })
  for (let j = 0; j < ai.length; j += 1) {
    for (let k = j + 1; k < ai.length; k += 1) {
      if (ai[j] !== ai[k]) graph.mergeEdge(String(ai[j]), String(ai[k]))
    }
  }
}

const usedNames = new Map()
function uniqueName(key) {
  const base = [...names.get(key)].join('; ')
  const seen = (usedNames.get(base) || 0) + 1
  usedNames.set(base, seen)
  return seen === 1 ? base : `${seen}; ${base}`
}

const components = connectedComponents(graph).sort((a, b) => b.length - a.length)
console.log(`Running spring_layout for up to ${iterations} iterations per component...`)
const layout = spawnSync(process.env.PYTHON || 'python', [path.join(__dirname, 'spring-layout.py')], {
  input: JSON.stringify({
    components,
    edges: graph.edges().map(edge => graph.extremities(edge)),
    seed: seed >>> 0,
    iterations,
  }),
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
  stdio: ['pipe', 'pipe', 'inherit'],
})
if (layout.error || layout.status !== 0) {
  throw new Error(`Spring layout failed (${layout.error?.message || `exit ${layout.status}`}). Check the Python error above. Set PYTHON to your Python executable; dependencies: python -m pip install -r scripts/requirements.txt`)
}
const positions = JSON.parse(layout.stdout)
const nodeinfo = {}
components.forEach((nodes, componentIndex) => {
  nodes.forEach(node => {
    const position = positions[node]
    if (!Array.isArray(position) || position.length !== 2 || !position.every(Number.isFinite)) {
      throw new Error(`Invalid layout position for node ${node}`)
    }
    nodeinfo[node] = [uniqueName(node), componentIndex, ...position, scopusIds.get(node) ?? null]
  })
})

fs.writeFileSync(output, JSON.stringify(obfuscate(nodeinfo, seed)))
console.log(`${graph.order} authors, ${graph.size} links, ${components.length} components -> src/nodeinfo.json (seed ${seed})`)
