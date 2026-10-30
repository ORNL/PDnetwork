const path = require('path')
const { DEFAULT_SEED, obfuscate, deobfuscate } = require('../src/obfuscate')
const root = path.resolve(__dirname, '..')

function readSeed(explicit = DEFAULT_SEED) {
  const seed = Number(explicit)
  if (!Number.isInteger(seed)) throw new Error('Pass an integer seed (default: 122333)')
  return seed
}

// Removes "--out <folder>" from args and returns that folder, or src/ if it is not given.
function readOutDir(args) {
  const i = args.indexOf('--out')
  if (i === -1) return path.join(root, 'src')
  const [, dir] = args.splice(i, 2)
  if (!dir) throw new Error('Pass a folder after --out')
  return path.resolve(dir)
}

module.exports = { root, DEFAULT_SEED, readSeed, readOutDir, obfuscate, deobfuscate }
