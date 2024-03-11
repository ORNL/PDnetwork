import Graph from "graphology";
import Sigma from "sigma";
import subgraph from 'graphology-operators/subgraph';
import { connectedComponents } from 'graphology-components';

import peri from "./peri.json"
import nodeinfo from "./nodeinfo.json"

import { oneName, transformData, zoomToPos } from "./utils.js"

import './style.css';

function set_components_from_ai(ai) {
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
  let nameToId = {}
  graph.forEachNode( node => {
    graph.setNodeAttribute(node, 'label', oneName(nodeinfo[node][0]).trim())
    graph.setNodeAttribute(node, 'fullname', nodeinfo[node][0])
    graph.setNodeAttribute(node, 'x', nodeinfo[node][2])
    graph.setNodeAttribute(node, 'y', nodeinfo[node][3])
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
  window.nameToId = nameToId
}

function updateYears(table) {
  let minval = parseInt(document.getElementById("minyear").value)
  let maxval = parseInt(document.getElementById("maxyear").value)

  table.clearFilter();
  table.addFilter("py", ">=", minval);
  table.addFilter("py", "<=", maxval);

  updateNetworks(table);
}

function updateNetworks(table) {
  let filters = table.getFilters();
  
  let geq = 2000;
  let leq = 2019;
  for (let i = 0; i < filters.length; i += 1) {
    if (filters[i].type == ">=") {
      geq = filters[i].value;
    }
    else if (filters[i].type == "<=") {
      leq = filters[i].value;
    }
  }

  let pa_list = window.pa_list;
  let newlist = {}
  for (const [key, value] of Object.entries(pa_list.py)) {
    if (value >= geq && value <= leq) {
      newlist[key] = pa_list.ai[key]
    }
  }

  set_components_from_ai(newlist);
  window.component = 0;
  renderNetworks()
}

function updateComponent() {
  let select = $("#component-select").get(0);
  window.component = select.options[select.selectedIndex].value;

  renderNetworks()
}

function renderNetworks() {
  if (window.renderer) { 
    window.renderer.kill()
  }

  window.renderer = new Sigma(window.components[window.component], $("#network").get(0), {
    labelRenderedSizeThreshold: 1, 
    labelDensity: 0.5,
    defaultNodeColor: "#00662B",
  })
  window.renderer.camera.maxRatio = 1
  window.renderer.refresh();
}

function authorCell(cellname, params, onRendered) {
  let names = cellname.getValue().split("; ")
  let cell = document.createElement("div")
  cell.className = "author-cell"

  for (let i = 0; i < names.length; i += 1) {
    let author = document.createElement("div")
    author.className = "author"
    author.innerHTML = `${names[i]}; `
    author.setAttribute("node", window.pa_list["ai"][cellname["_cell"].row.position - 1][i])
    cell.appendChild(author)
  }

  onRendered(() => {
    let authors = cellname.getElement().children[0].children 

    for (let j = 0; j < authors.length; j += 1)
      authors[j].addEventListener("click", () => {
        let node = window.pa_list["ai"][cellname["_cell"].row.position - 1][j]
        console.log(node)
        console.log(authors[j].getValue("node"))
        let nattr = window.renderer.nodeDataCache[node]
        zoomToPos(nattr.x, nattr.y)
      })
    })

  return cell
}

$(document).ready(function() {
  window.pa_list = JSON.parse(peri)
  let transposed = transformData(window.pa_list)

  set_components_from_ai(window.pa_list["ai"])

  window.component = 0
  renderNetworks()

  window.table = new Tabulator("#info", {
    data: transposed,
    layout: "fitData",
    columns: [
      { title: "Authors", field: "af", width: "22%", formatter: authorCell },
      { title: "Title", field: "ti", width: "50%" },
      { title: "Year", field: "py",  width: "13%" },
      { title: "Source", field: "so", width: "14%" },
    ]
  })

  window.table.on("tableBuilt", () => {
    $("#minyear").get(0).addEventListener("change", () => updateYears(table));
    $("#maxyear").get(0).addEventListener("change", () => updateYears(table));
    $("#component-select").get(0).addEventListener("change", () => updateComponent());
  });
})