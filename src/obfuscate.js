// Shared by the data generators and browser decoder.
const DEFAULT_SEED = 122333

function shift(value, seed, direction) {
  if (typeof value === 'string') {
    let a = seed >>> 0
    let out = ''
    for (let i = 0; i < value.length; i += 1) {
      a = (a + 0x6D2B79F5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      const key = ((t ^ (t >>> 14)) >>> 0) % 0xD7E0
      const code = value.charCodeAt(i)
      out += code < 0x20 || code >= 0xD800
        ? value[i]
        : String.fromCharCode(0x20 + (((code - 0x20 + direction * key) % 0xD7E0) + 0xD7E0) % 0xD7E0)
    }
    return out
  }
  if (Array.isArray(value)) return value.map(item => shift(item, seed, direction))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shift(item, seed, direction)]))
  }
  return value
}

module.exports = {
  DEFAULT_SEED,
  obfuscate: (value, seed) => shift(value, seed, 1),
  deobfuscate: (value, seed) => shift(value, seed, -1),
}

