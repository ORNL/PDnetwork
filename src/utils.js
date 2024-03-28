import Sigma from "sigma";
import subgraph from 'graphology-operators/subgraph';
import Graph from "graphology";
import { connectedComponents } from 'graphology-components';

import { degreeCentrality } from 'graphology-metrics/centrality/degree'

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

function authorCell2(cellname, params, onRendered) {
  //console.log(cellname.getValue(), cellname["_cell"].row.position)
  let names = cellname.getValue().split("; ")
  let cell = document.createElement("div")
  cell.className = "author-cell"

  for (let i = 0; i < names.length; i += 1) {
    let author = document.createElement("div")
    author.className = "author"
    author.innerHTML = `${names[i]}; `
    author.key = i
    author.setAttribute("node", parseInt(window.nameToId[names[i]]))//window.pa_list["ai"][cellname["_cell"].row.position - 1][i])
    cell.appendChild(author)
  }

  onRendered(() => {
    let authors = cellname.getElement().children[0].children 

    for (let j = 0; j < authors.length; j += 1)
      authors[j].addEventListener("click", () => {
        console.log(authors[j])
        let node = authors[j].getAttribute("node")
        let nattr = window.renderer.nodeDataCache[node]
        zoomToPos(nattr.x, nattr.y)
      })
    })

  return cell
}

export function zoomToPos(x, y) {
  window.renderer.camera.x = x
  window.renderer.camera.y = y
  window.renderer.camera.ratio = 0.1
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

  window.nameToId = {}

  let graph = Graph.from(gdata)
  graph.forEachNode( node => {
    graph.setNodeAttribute(node, 'label', oneName(nodeinfo[node][0]).trim())
    graph.setNodeAttribute(node, 'fullname', nodeinfo[node][0])
    graph.setNodeAttribute(node, 'x', nodeinfo[node][2])
    graph.setNodeAttribute(node, 'y', nodeinfo[node][3])
    graph.setNodeAttribute(node, 'size', 3)
    window.nameToId[nodeinfo[node][0]] = node
    window.nameToId[ oneName(nodeinfo[node][0]).trim()] = node
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

  setupNodeSearch(networks[0])
  setupCentralityTables(networks[0])
}

function setupNodeSearch(component) {
  console.log("SetupNodeSearch")

  let searchoptions = document.getElementById("nodesearch")

  let nodes = component.nodes()
  for (let i = 0; i < nodes.length; i += 1) {
    let op = document.createElement("option")
    op.value = nodeinfo[nodes[i]][0]
    searchoptions.appendChild(op)  
  }
}

function setupCentralityTables(component) {
  // degree centrality
  let ranking = []
  let nodes = component.nodes()
  for (let i = 0; i < nodes.length; i += 1) {
    let nattr = component._nodes.get(nodes[i])
    //console.log(nattr)
    let obj = {}
    obj.name = nattr.attributes["label"]
    obj.degree = nattr.outDegree + nattr.inDegree
    ranking.push(obj)
  }

  var columns = [
    { title: "Name", field: "name", formatter: authorCell2, resizable: false },
    { title: "Degree", field: "degree", resizable: false }
  ];

  let nodeTable = new Tabulator("#index", {
    data: ranking,
    columns: columns,
    layout: "fitData",
    initialSort:[
      {column:"name", dir:"asc"}
  ]
  });
}