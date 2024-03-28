import Sigma from "sigma";
import subgraph from 'graphology-operators/subgraph';
import Graph from "graphology";
import { connectedComponents } from 'graphology-components';

import nodeinfo from "./nodeinfo.json"

export function oneName(name) {
  return name.split(";").sort((a, b) => b.length - a.length)[0]
}

export function transformData(data) {
  let transformed = [];
  let keys = Object.keys(data);
  let length = Object.keys(data[keys[0]]).length

  for (let i = 0; i < length; i++) {
      let row = {};
      keys.forEach(key => {
          row[key] = data[key][i];
      });

      if (row[keys[0]]) {
        transformed.push(row);
      }
  }

  return transformed;
}

export function zoomToPos(x, y) {
  window.renderer.camera.x = x
  window.renderer.camera.y = y
  window.renderer.refresh()
}

export function renderNetworks() {
  if (window.renderer) { 
    window.renderer.kill()
  }

  window.renderer = new Sigma(window.components[window.component], $("#network").get(0), {
    labelRenderedSizeThreshold: 1, 
    labelDensity: 0,
    defaultNodeColor: "#00662B",
  })
  window.renderer.camera.maxRatio = 1
  window.renderer.refresh();
}

export function set_components_from_ai(ai) {
  window.nodeinfo = nodeinfo
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
    newedge.attributes = {"weight": edges[edge], "distance": 1 / edges[edge], "size": 1, "color": "#aaaaaa"}

    gdata.edges.push(newedge)
  }

  nodes = Array.from(nodes)
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i]
    let newnode = {}
    newnode.key = node
    gdata.nodes.push(newnode)
  }

  let graph = Graph.from(gdata)
  graph.forEachNode( node => {
    graph.setNodeAttribute(node, 'label', oneName(nodeinfo[node][0]).trim())
    graph.setNodeAttribute(node, 'fullname', nodeinfo[node][0])
    graph.setNodeAttribute(node, 'x', nodeinfo[node][2])
    graph.setNodeAttribute(node, 'y', nodeinfo[node][3])
    graph.setNodeAttribute(node, 'size', 3)
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

  let numsize = {}
  let str = ""
  for (let i = 0; i < networks.length; i++) {
    let size = networks[i].nodes().length

    if (numsize[size]) {
      numsize[size] += 1;
      str += `<option value=${i}>${networks[i].nodes().length}${String.fromCharCode(64 + numsize[size])} Nodes</option>`
    }
    else { 
      numsize[size] = 1;
      str += `<option value=${i}>${networks[i].nodes().length} Nodes</option>`
    }
  }

  $("#component-select").get(0).innerHTML = str

  window.components = networks
}