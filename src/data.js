import Graph from "graphology";
import subgraph from 'graphology-operators/subgraph';
import { connectedComponents } from 'graphology-components';
import publications from './scopus.json';
import nodeinfo from './nodeinfo.json';

export { nodeinfo };

// The bundled publication file currently contains a JSON-encoded string.
export function loadPublications() {
  return typeof publications === 'string' ? JSON.parse(publications) : publications;
}

export function oneName(name) {
  return name.split(";").sort((a, b) => b.length - a.length)[0]
}

export function transformData(data) {
  let transformed = [];
  let keys = Object.keys(data);
  if (keys.length === 0) return transformed;

  for (const i of Object.keys(data[keys[0]])) {
      let row = { id: i };
      keys.forEach(key => {
          row[key] = data[key][i];
      });

      if (row[keys[0]]) {
        transformed.push(row);
      }
  }

  return transformed;
}

// Keep publication IDs when selecting the author lists used to build a graph.
export function filterPublicationAuthors(publications, minYear, maxYear) {
  return Object.fromEntries(
    Object.entries(publications.py)
      .filter(([, year]) => year >= minYear && year <= maxYear)
      .map(([id]) => [id, publications.ai[id]])
  );
}

// Build the weighted co-authorship graph and components without touching the UI.
export function buildNetworks(ai) {
  let networks = []

  let nodes = []
  let edges = {}

  // populate objects
  let keys = Object.keys(ai)

  for (let i = 0; i < keys.length; i++) {
    let key = keys[i]
    let alist = ai[key].slice().sort()

    if (alist.length == 1) {
      nodes.push(alist[0])
    }
    else {
      for (let j = 0; j < alist.length; j++) {
        for (let k = j + 1; k < alist.length; k++) {
          let edge = [alist[j], alist[k]]
          edge.sort()
          let ename = `${edge[0]}-${edge[1]}`

          nodes.push(alist[j])
          nodes.push(alist[k])

          if (edges[ename]) {
            edges[ename] += 1 / (alist.length - 1)
          }
          else {
            edges[ename] = 1 / (alist.length - 1)
          }
        }
      }
    }
  }

  // construct graph
  let gdata = {}
  nodes = new Set(nodes)
  gdata.nodes = []
  gdata.edges = []

  for (const edge in edges) {
    let newedge = {}
    newedge.key = edge
    newedge.source = edge.slice(0, edge.indexOf("-"))
    newedge.target = edge.slice(edge.indexOf("-") + 1)
    newedge.attributes = {"weight": edges[edge], "distance": 1 / edges[edge]}

    gdata.edges.push(newedge)
  }

  nodes = Array.from(nodes)
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i]
    let newnode = {}
    newnode.key = node
    gdata.nodes.push(newnode)
  }

  const nameToId = {}

  const graph = Graph.from(gdata, {type: "undirected"})

  graph.forEachNode( node => {
    if (!nodeinfo[node]) {
      return
    }

    graph.setNodeAttribute(node, 'label', oneName(nodeinfo[node][0]).trim())
    graph.setNodeAttribute(node, 'fullname', nodeinfo[node][0])
    graph.setNodeAttribute(node, 'x', nodeinfo[node][2])
    graph.setNodeAttribute(node, 'y', nodeinfo[node][3])
    nameToId[nodeinfo[node][0]] = node
    nameToId[ oneName(nodeinfo[node][0]).trim()] = node
  } );

  let components = connectedComponents(graph);
  components.sort((a, b) => b.length - a.length);
  for (let i = 0; i < components.length; i++) {
    let gc = subgraph(graph, components[i])
    networks.push(gc)
  }

  if (components.length == 0) {
    networks = [ graph ];
  }

  return { graph, components: networks, nameToId };
}
