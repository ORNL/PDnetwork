// builds a network and prints the metrics that are shown in the tool

const fs = require('fs')
const path = require('path')

require('@babel/register')({ presets: ['@babel/preset-env'], only: [path.join(__dirname, '../src')] })
const { DEFAULT_SEED, deobfuscate } = require('../src/obfuscate.js')
const { buildNetworks } = require('../src/data.js')
const { assignAuthorMetrics, authorMetrics, networkMetrics } = require('../src/metric.js')

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

const folder = process.argv[2]
let publicationAuthors, nodeinfo
if (folder) {
  publicationAuthors = deobfuscate(readJson(path.join(folder, 'publications.json')), DEFAULT_SEED).ai
  nodeinfo = deobfuscate(readJson(path.join(folder, 'nodeinfo.json')), DEFAULT_SEED)
} else {
  publicationAuthors = readJson(0)
}

const { graph, components } = buildNetworks(publicationAuthors, nodeinfo)

const nodes = {}
for (const component of components) {
  assignAuthorMetrics(component)
  component.forEachNode(node => {
    nodes[node] = { label: component.getNodeAttribute(node, 'label'), ...authorMetrics(component, node) }
  })
}

process.stdout.write(JSON.stringify({ network: networkMetrics(graph, publicationAuthors), nodes }))
