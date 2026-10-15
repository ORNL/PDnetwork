// Usage: node scripts/build-data.js <scopus.csv> [seed]
//
// Converts a Scopus CSV export into src/publications.json, the obfuscated file
// the app loads. Expected CSV headers (extra columns are ignored):
//   af  author full names, "; " separated
//   si  Scopus author ids, "; " separated, aligned with af
//   aa  affiliations (not stored)
//   ti  title
//   py  publication year
//   doi DOI
//   co  countries, "; " separated
//   ai  ignored; node indices are assigned here from si in first-seen order
//
// Output layout before obfuscating, column -> rowId -> value:
//   { af, si, ti, py, doi, co, ai }
// Node info (components and positions) is derived from this file by
// scripts/build-nodeinfo.js, which runs on npm install, start, and build.
const fs = require('fs')
const path = require('path')
const { root, readSeed, obfuscate } = require('./obfuscate')

const [, , csvPath, seedArg] = process.argv
if (!csvPath) {
  console.error('Usage: node scripts/build-data.js <scopus.csv> [seed]')
  process.exit(1)
}
const seed = readSeed(seedArg)

// Minimal RFC 4180 parser: quoted fields, doubled quotes, newlines inside quotes.
function parseCsv(text) {
  const rows = []
  let row = [], field = '', quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1 }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1
      row.push(field); rows.push(row); row = []; field = ''
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  const header = rows.shift().map(h => h.trim().replace(/^﻿/, '').toLowerCase())
  return rows.filter(r => r.some(v => v !== '')).map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])))
}

const splitList = value => value.split(';').map(v => v.trim()).filter(Boolean)

const records = parseCsv(fs.readFileSync(csvPath, 'utf8'))
for (const column of ['af', 'si', 'ti', 'py']) {
  if (!(column in records[0])) throw new Error(`CSV is missing the "${column}" column`)
}

const nodeIndex = new Map()
const publications = { af: {}, si: {}, ti: {}, py: {}, doi: {}, co: {}, ai: {} }
let rowId = 0
for (const record of records) {
  const authorNames = splitList(record.af)
  const authorIds = splitList(record.si)
  if (authorNames.length !== authorIds.length) {
    console.warn(`Row ${rowId + 1}: ${authorNames.length} names but ${authorIds.length} ids; using the shorter list`)
  }
  const count = Math.min(authorNames.length, authorIds.length)
  if (count === 0) continue
  const ai = []
  for (let i = 0; i < count; i += 1) {
    if (!nodeIndex.has(authorIds[i])) nodeIndex.set(authorIds[i], nodeIndex.size)
    ai.push(nodeIndex.get(authorIds[i]))
  }
  const id = String(rowId)
  publications.af[id] = authorNames.slice(0, count).join('; ')
  publications.si[id] = authorIds.slice(0, count).join('; ')
  publications.ti[id] = record.ti
  publications.py[id] = Number(record.py)
  publications.doi[id] = record.doi ?? ''
  publications.co[id] = record.co ?? ''
  publications.ai[id] = ai
  rowId += 1
}

const out = path.join(root, 'src/publications.json')
fs.writeFileSync(out, JSON.stringify(obfuscate(publications, seed)))
const nodeinfo = path.join(root, 'src/nodeinfo.json')
if (fs.existsSync(nodeinfo)) {
  fs.unlinkSync(nodeinfo)
  console.log('Removed stale src/nodeinfo.json; it will be rebuilt on the next start or build.')
}
console.log(`${rowId} publications, ${nodeIndex.size} authors -> src/publications.json (seed ${seed})`)
