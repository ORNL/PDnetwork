// Usage: npm run build-dataset -- <path/to/scopus.json>
// Accepts plain column-oriented JSON or a JSON-encoded string of that object.
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { root, DEFAULT_SEED, obfuscate } = require('./obfuscate')

function main() {
  const args = process.argv.slice(2)
  if (args.length !== 1) throw new Error('Usage: npm run build-dataset -- <path/to/scopus.json>')
  const input = path.resolve(args[0])
  let data = JSON.parse(fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, ''))
  if (typeof data === 'string') data = JSON.parse(data)
  for (const column of ['af', 'si', 'ti', 'py', 'doi', 'co', 'ai']) {
    if (!data || typeof data[column] !== 'object' || data[column] === null) {
      throw new Error(`Input must contain the "${column}" column`)
    }
  }
  const ids = Object.keys(data.ai)
  if (!ids.length) throw new Error('Input contains no publications')
  for (const id of ids) {
    if (!Array.isArray(data.ai[id]) || !data.ai[id].every(Number.isInteger)) {
      throw new Error(`Publication ${id}: ai must be an array of integer author indices`)
    }
    for (const column of ['af', 'si', 'ti', 'doi', 'co']) {
      if (['doi', 'co'].includes(column) && data[column][id] === null) continue
      if (typeof data[column][id] !== 'string') throw new Error(`Publication ${id}: ${column} must be a string`)
    }
    if (!Number.isFinite(data.py[id])) throw new Error(`Publication ${id}: py must be a number`)
  }
  const output = path.join(root, 'src/publications.json')
  if (input.toLowerCase() === output.toLowerCase()) throw new Error('Use a separate source file, not src/publications.json')
  fs.writeFileSync(output, JSON.stringify(obfuscate(data, DEFAULT_SEED)))
  // Invalidate saved positions so a failed layout cannot leave stale node data.
  const nodeinfo = path.join(root, 'src/nodeinfo.json')
  if (fs.existsSync(nodeinfo)) fs.unlinkSync(nodeinfo)
  console.log(`${ids.length} publications -> src/publications.json (seed ${DEFAULT_SEED})`)
  const result = spawnSync(process.execPath, [path.join(__dirname, 'build-nodeinfo.js'), String(DEFAULT_SEED), '--force'], { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error('Node data generation failed; fix the error above and rerun this command')
}

try {
  main()
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
