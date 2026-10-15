const path = require('path')
const { DEFAULT_SEED, obfuscate, deobfuscate } = require('../src/obfuscate')
const root = path.resolve(__dirname, '..')

function readSeed(explicit = DEFAULT_SEED) {
  const seed = Number(explicit)
  if (!Number.isInteger(seed)) throw new Error('Pass an integer seed (default: 122333)')
  return seed
}

module.exports = { root, DEFAULT_SEED, readSeed, obfuscate, deobfuscate }
