import Sigma from "sigma";
import subgraph from 'graphology-operators/subgraph';
import Graph from "graphology";
import { createNodeBorderProgram  } from "@sigma/node-border";
import { connectedComponents } from 'graphology-components';

import betweennessCentrality from 'graphology-metrics/centrality/betweenness';
import closenessCentrality from 'graphology-metrics/centrality/closeness';

import diameter from 'graphology-metrics/graph/diameter';
import eccentricity from 'graphology-metrics/node/eccentricity';

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

function numPaperWithAuthors(nodes) {
  let authorArr = Object.values(window.pa_list.ai)
  let papers = authorArr.filter(x => nodes.includes(String(x[0])))
  return papers.length;
}

export function componentMetrics(component) {
  let stats = []
  let nodes = [... new Set(component.nodes())]

  console.log(nodes)

  stats.push("<b>Number of authors:</b> " + nodes.length)
  stats.push("<b>Number of papers:</b> " + numPaperWithAuthors(nodes))
  stats.push("<b>Number of links:</b> " + component.edges().length)

  return stats
}

export function globalMetrics() {
  let stats = []
  let nodes = [... new Set(window.graph.nodes())]

  stats.push("<b>Number of authors:</b> " + nodes.length)
  stats.push("<b>Number of papers:</b> " + numPaperWithAuthors(nodes))
  stats.push("<b>Number of links:</b> " + window.graph.edges().length)

  return stats
}

export function localMetrics(component, node) {
  console.log(node)
  let stats = []
  stats.push("<b>All names:</b> " + node.attributes["fullname"])
  stats.push("<b>Number of collaborators:</b> " + node.undirectedDegree)
  stats.push("<b>Number of collaborative publications:</b> " + node.attributes["wdegree"])
  stats.push("<b>Closeness centrality:</b> " + parseFloat(node.attributes["close"]).toFixed(4))
  stats.push("<b>Betweenness centrality:</b> " + parseFloat(node.attributes["btwn"]).toFixed(4))

  return stats 
}

function authorCell2(cellname, params, onRendered) {
  let names = cellname.getValue().split("; ")
  let cell = document.createElement("div")
  cell.className = "author-cell"

  let key = cellname.getData().key

  for (let i = 0; i < names.length; i += 1) {
    let author = document.createElement("div")
    author.className = "author"
    author.innerHTML = `${names[i]}`
    author.key = key
    author.setAttribute("node", parseInt(key))
    cell.appendChild(author)
  }

  let network = window.components[window.component]
  onRendered(() => {
    let authors = cellname.getElement().children[0].children 

    for (let j = 0; j < authors.length; j += 1) {
      let node = authors[j].getAttribute("node")

      authors[j].addEventListener("mouseenter", () => {
        let nodeobj = network._nodes.get(node)
        if (nodeobj !== undefined) {
          hover_node(nodeobj, true) 
        }
      })
      authors[j].addEventListener("mouseleave", () => {
        let nodeobj = network._nodes.get(node)
        if (nodeobj !== undefined) {
          hover_node(nodeobj, false) 
        }
      })

      authors[j].addEventListener("click", () => {
        console.log(authors[j])
        set_selected_div(node)
      })
    }
  })

  return cell
}

function zoomToNode(nodename) {
  let nattr = window.renderer.nodeDataCache[nodename]
  zoomToPos(nattr.x, nattr.y)
}

export function zoomToPos(x, y) {
  window.renderer.camera.x = x
  window.renderer.camera.y = y
  window.renderer.refresh()
}

const NODECOLOR_DEFAULT = "#D2E5FF"
const NODEBORDER_DEFAULT = "#2B7CE9"
const NODECOLOR_SELECTED = "#E00000"
const NODEBORDER_SELECTED = "#000000"
const NODECOLOR_NEIGHBOR = "#FFADAD"
const NODEBORDER_NEIGHBOR = "#004400"
const EDGECOLOR_DEFAULT = "rgba(0, 0, 0, 0.3)"
const EDGECOLOR_SELECTED = "#FF8585"

const NODECOLOR_HOVER = "#FF00FF"
const NODECOLOR_HOVER2 = "#55FF00"
const EDGECOLOR_HOVER = "#FF00FF"

export function renderNetworks() {
  if (window.renderer) { 
    window.renderer.kill()
  }

  let network = window.components[window.component]

  window.renderer = new Sigma(network, $("#network").get(0), {
    labelRenderedSizeThreshold: 0, 
    labelDensity: 0,
    zIndex: true,
    enableHovering: false,
    labelGridCellSize: 150,
    defaultNodeColor: NODECOLOR_DEFAULT,
    nodeProgramClasses: {
      border: createNodeBorderProgram({
        borders: [
          { size: { attribute: "borderSize", defaultValue: 0.3 }, color: { attribute: "borderColor" } },
          { size: { fill: true }, color: { attribute: "color" } },
        ],
      }),
    },
  })
  window.renderer.camera.maxRatio = 1
  window.renderer.refresh();

  window.renderer.on("clickNode", e => { 
    let node = network._nodes.get(e.node)
    set_selected_div(node) 
  })

  window.renderer.on("enterNode", e => { 
    let node = network._nodes.get(e.node)
    hover_node(node, true) 
  })

  window.renderer.on("leaveNode", e => { 
    let node = network._nodes.get(e.node)
    hover_node(node, false) 
  })
}

export function hover_node(node, enable) {
  let network = window.components[window.component]

  let nodecolor = NODECOLOR_DEFAULT
  let edgecolor = EDGECOLOR_DEFAULT
  let edgesize = 1

  if (enable) {
    nodecolor = NODECOLOR_HOVER
    edgecolor = EDGECOLOR_HOVER
    edgesize = 1.5
  }

  network.forEachEdge(node.key, (edge, edgevals) => {
    if (edgevals.color != EDGECOLOR_SELECTED) {
      edgevals.color = edgecolor
      edgevals.size = edgesize
    }
  })

  if (node.attributes.color != NODECOLOR_SELECTED && node.attributes.color != NODECOLOR_NEIGHBOR && node.attributes.color != NODECOLOR_HOVER2) {
    node.attributes.color = nodecolor
  }
  else if (node.attributes.color == NODECOLOR_NEIGHBOR || node.attributes.color == NODECOLOR_HOVER2) {
    if (enable) {
      node.attributes.color = NODECOLOR_HOVER2
    }
    else {
      node.attributes.color = NODECOLOR_NEIGHBOR
    }
  }

  window.renderer.refresh()
}

export function switch_tabs(name, first=false) {
  if (window.tab != name) {
    window.tab = name
    let active = $(".activetab")
    active.removeClass()
    active.addClass("inactivetab")

    let activeButton = $(".activebutton")
    activeButton.removeClass()

    let oldbutton = activeButton[0].id
    if (oldbutton == "indextab" || oldbutton == "infotab") {
      activeButton.addClass("tab")
    }
    else{
      activeButton.addClass("tab2")
      if (window.selected == null) {
        activeButton.addClass("hiddenbutton")
      }
      else {
        activeButton.addClass("nonhiddenbutton")
      }
    }

    let tabname = "#" + name + "tab"
    let holdername = "#" + name + "holder"
    $(holdername).removeClass()
    $(holdername).addClass("activetab")
    $(tabname).addClass("activebutton")

    if (oldbutton == "infotab") {
      toggle_componentpapers(false)
    }
    if (name == "info") {
      toggle_componentpapers(true)
    }
  }
  

  if (first) {
    window.nodeTable.redraw(true)
  }
}

export function toggle_componentpapers(show) {
  let ctoggle = $("#componentpapers").get(0)
  ctoggle.innerHTML = ""

  if (show) {
    let check = document.createElement("input")
    check.id = "cpcheckbox"
    check.type = "checkbox" 
    ctoggle.appendChild(check)
    ctoggle.innerHTML += "Only Component"

    let togglebox = document.getElementById("cpcheckbox")
    togglebox.checked = window.componentpapers

    togglebox.addEventListener("change", e => {
      window.componentpapers = e.target.checked

      if (window.componentpapers) {
        let nodes = window.components[window.component].nodes()
        let filters = window.table.getFilters();
        console.log(window.table.getFilters())
        window.table.setFilter(paperInComponent, nodes)
        window.table.addFilter("py", ">=", window.minyearval);
        window.table.addFilter("py", "<=", window.maxyearval);
        console.log(window.table.getFilters())
      }
      else {
        let filters = window.table.getFilters()
        for (let i = 0; i < filters.length; i += 1) {
          if (!filters[i].value) {
            table.removeFilter(filters[i].field, filters[i].type, filters[i].value)
          }
        }
      }
    })
  }
}

export function paperInComponent(data, params) {
  return params.includes(String(data.ai[0]))
}

export function set_selected_div(node=null, refresh=false) {
  if (typeof node === 'string' || node instanceof String) {
    node = window.components[window.component]._nodes.get(node)

    if (node) {
      console.log("switched to " + node)
    }
    else {
      console.log("Undefined node. Clearing.")
    }
  }

  let selecteddiv = document.getElementById("selected")

  if (node == null) {
    if (window.selected == null && selecteddiv.innerHTML.length > 0 && !refresh) {
      return 
    }

    window.selected = null

    let headingglobal = document.createElement("h4")
    headingglobal.innerHTML = "Entire Network Information"
    let componentinfo = componentMetrics(window.components[window.component])
    let globalinfo = globalMetrics()

    let bulletsglobal = document.createElement("ul")
    for (let i = 0; i < globalinfo.length; i += 1) {
      let b = document.createElement("li")
      b.innerHTML = globalinfo[i]
      bulletsglobal.appendChild(b)
    }

    let heading = document.createElement("h4")
    heading.innerHTML = "Selected Component Information"

    let bullets = document.createElement("ul")
    for (let i = 0; i < componentinfo.length; i += 1) {
      let b = document.createElement("li")
      b.innerHTML = componentinfo[i]
      bullets.appendChild(b)
    }

    let columndiv = document.createElement("div")
    columndiv.id = "flexrow"
    let leftdiv = document.createElement("div")
    leftdiv.appendChild(heading)
    leftdiv.appendChild(bullets)

    let rightdiv = document.createElement("div")
    rightdiv.appendChild(headingglobal)
    rightdiv.appendChild(bulletsglobal)

    selecteddiv.innerHTML = ""
    columndiv.appendChild(leftdiv)
    columndiv.appendChild(rightdiv)
    selecteddiv.appendChild(columndiv)

    let activename = document.getElementsByClassName("activebutton")[0].id
    if (activename !== "indextab" && activename !== "infotab") {
      switch_tabs("index")
    }

    let buttons = document.getElementsByClassName("tab2")
    for (let i = 0; i < buttons.length; i += 1) {
      buttons[i].className = "tab2 hiddenbutton"
    }
  }
  else {
    console.log("Selecting " + node)
    let network = window.components[window.component]
    if (window.selected != null) {
      // color
      network.forEachEdge(window.selected, (edge, edgevals, source, target, sourcevals, targetvals) => {
        edgevals.color = EDGECOLOR_DEFAULT
        edgevals.size = 1
        sourcevals.color = NODECOLOR_DEFAULT
        sourcevals.borderColor = NODEBORDER_DEFAULT
        targetvals.color = NODECOLOR_DEFAULT
        targetvals.borderColor = NODEBORDER_DEFAULT
        sourcevals.forceLabel = false
        targetvals.forceLabel = false
      })

      network._nodes.get(window.selected).attributes.color = NODECOLOR_DEFAULT
      network._nodes.get(window.selected).attributes.zIndex = 1
      network._nodes.get(window.selected).attributes.labelColor = "#000000"
    }

    if (window.selected == node.key && !refresh) {
      set_selected_div(null)
      window.renderer.refresh()
      return
    }

    window.selected = node.key

    // color
    network.forEachEdge(window.selected, (edge, edgevals, source, target, sourcevals, targetvals) => {
      edgevals.color = EDGECOLOR_SELECTED
      edgevals.size = 2
      if (source == window.selected) {
        targetvals.color = NODECOLOR_NEIGHBOR
        targetvals.borderColor = NODEBORDER_NEIGHBOR
      }
      else {
        sourcevals.color = NODECOLOR_NEIGHBOR
        sourcevals.borderColor = NODEBORDER_NEIGHBOR
      }
    })
    node.attributes.color = NODECOLOR_SELECTED
    node.attributes.borderColor = NODEBORDER_SELECTED
    node.attributes.zIndex = 2
    
    window.renderer.refresh()

    // now update node info
    selecteddiv.innerHTML = ""
    let heading = document.createElement("h3")
    heading.id = "selectedName"

    let names = node.attributes["fullname"].split("; ")

    let nn = names[0]
    if (names.length > 1) {
      nn = names[1];
    }
  
    heading.innerHTML = "<b>Selected Node:</b> " + nn
    let localinfo = localMetrics(network, node)

    let bullets = document.createElement("ul")
    for (let i = 0; i < localinfo.length; i += 1) {
      let b = document.createElement("li")
      b.innerHTML = localinfo[i]
      bullets.appendChild(b)
    }

    let canceldiv = document.createElement("div")

    let webbutton = document.createElement("button")
    webbutton.id = "webbutton"
    webbutton.innerHTML = "🌐"

    let zoombutton = document.createElement("button")
    zoombutton.id = "zoombutton"
    zoombutton.innerHTML = "🔍"

    let cancelbutton = document.createElement("button")
    cancelbutton.id = "cancelbutton"
    cancelbutton.innerHTML = "X"

    canceldiv.id = "canceldiv"
    canceldiv.appendChild(heading)
    canceldiv.appendChild(webbutton)
    canceldiv.appendChild(zoombutton)
    canceldiv.appendChild(cancelbutton)
    selecteddiv.innerHTML = ""

    webbutton.addEventListener("click", () => {
      window.open("https://www.scopus.com/authid/detail.uri?authorId=" + nodeinfo[parseInt(window.selected)][4], '_blank');
    })

    cancelbutton.addEventListener("click", () => {
      cancelselect(window.selected)
      window.selected = null
      set_selected_div(null, true)
    })

    zoombutton.addEventListener("click", () => {
      zoomToNode(window.selected)
    })


    selecteddiv.appendChild(canceldiv)
    selecteddiv.appendChild(bullets)

    let buttons = document.getElementsByClassName("tab2")

    for (let i = 0; i < buttons.length; i += 1) {
      if (buttons[i].classList.contains("hiddenbutton")) {
        buttons[i].className = "tab2 nonhiddenbutton"
      }
    }

    setup_selected_tabs(node)
  }
}

export function cancelselect(node) {
  if (node == null) {
    return
  }

  let network = window.components[window.component]
  let selecteddiv = document.getElementById("selected")
  selecteddiv.innerHTML = ""

  network.forEachEdge(node, (edge, edgevals, source, target, sourcevals, targetvals) => {
    edgevals.color = EDGECOLOR_DEFAULT
    edgevals.size = 1
    sourcevals.color = NODECOLOR_DEFAULT
    sourcevals.borderColor = NODEBORDER_DEFAULT
    targetvals.color = NODECOLOR_DEFAULT
    targetvals.borderColor = NODEBORDER_DEFAULT
    sourcevals.forceLabel = false
    targetvals.forceLabel = false
  })

  network._nodes.get(node).attributes.color = NODECOLOR_DEFAULT
  network._nodes.get(node).attributes.labelColor = "#000000"
  window.renderer.refresh()
}

function authorCell3(cellname, params, onRendered) {
  let names = cellname.getValue().split("; ").slice(0, 10)
  let cell = document.createElement("div")
  cell.className = "author-cell"
  let colids = cellname.getRow().getData()["ai"]

  for (let i = 0; i < names.length; i += 1) {
    let author = document.createElement("div")
    author.className = "author"
    author.innerHTML = `${names[i]}; `
    author.setAttribute("node", colids[i])
    cell.appendChild(author)
  }

  onRendered(() => {
    let authors = cellname.getElement().children[0].children 

    for (let j = 0; j < authors.length; j += 1) {
      //console.log("Working on", authors[j])
      //let network = window.components[window.component]
      //let node = window.selectedpapers[cellname["_cell"].row.position - 1]["ai"][j]
      //console.log("node is", node, "from", window.selectedpapers[cellname["_cell"].row.position - 1]["ai"], "because authors is", authors)
      let nodeobj = window.components[window.component]._nodes.get("" + colids[j])

      authors[j].addEventListener("mouseenter", () => {
        if (nodeobj !== undefined) {
          hover_node(nodeobj, true) 
        }
      })
      authors[j].addEventListener("mouseleave", () => {
        if (nodeobj !== undefined) {
          hover_node(nodeobj, false) 
        }
      })
      authors[j].addEventListener("click", () => {
        set_selected_div("" + colids[j])
      })
    }
  })

  return cell
}

export function setup_selected_tabs(node) {
  let buttons = document.getElementsByClassName("tab2")

  let allpapers = window.table.getData();
  let filteredData = allpapers.filter(function(row) {
    return row.ai.includes(parseInt(node.key))
  });

  window.selectedpapers = filteredData

  console.log("Creating paper!")
  window.papers = new Tabulator("#paper", {
    data: window.selectedpapers,
    layout: "fitData",
    columns: [
      {title:"", field:"", formatter:"rownum", width: "5%", headerSort: false},
      { title: "Authors", field: "af", width: "32%", formatter: authorCell3,  resizable: false, variableHeight:true, headerFilter:"input"},
      { title: "Title", field: "ti", width: "50%", resizable: false, formatter:"textarea", cssClass: "paperTitle", headerFilter:"input"},
      { title: "Year", field: "py",  width: "10%", resizable: false},
    ],
    initialSort: [
      {column:"ti", dir:"asc"},
      {column:"py", dir:"desc"}
    ]
  })

  window.papers.on("tableBuilt", () => { 
    window.papers.addFilter("py", ">=", window.minyearval);
    window.papers.addFilter("py", "<=", window.maxyearval);
  });

  window.papers.on("cellClick", (e, cell) => {
    let field = cell.getField()
    if (field == "ti") {
      window.open("https://doi.org/" + cell.getRow().getData().doi, "_blank");
    }
    else {
      console.log(cell)
    }
  });

  let ndiv = document.getElementById("neighbor")

  let nlist = []
  let network = window.components[window.component]
  network.forEachEdge(node.key, (edge, edgevals, source, target, sourcevals, targetvals) => {
    let text = document.createElement("li")

    let val = 0
    let name = ""
    if (source == node.key) {
      name = targetvals.fullname
      val = target
      text.setAttribute("key", target)
    }
    else {
      name = sourcevals.fullname
      val = source
      text.setAttribute("key", source)
    }
    text.innerHTML = name

    text.addEventListener("mouseenter", e => {
      let nodeobj = network._nodes.get(e.target.getAttribute("key"))
      if (nodeobj !== undefined) {
         hover_node(nodeobj, true) 
      }
    })
    text.addEventListener("mouseleave", e => {
      let nodeobj = network._nodes.get(e.target.getAttribute("key"))
      if (nodeobj !== undefined) {
         hover_node(nodeobj, false) 
      }
    })
  
    text.addEventListener("click", e => {
      set_selected_div(e.target.getAttribute("key"))
    })

    nlist.push([text, name])
  })

  nlist.sort((a, b) => a[1].replace(/[^a-z]/ig, "") > b[1].replace(/\W/ig, "") ? 1 : -1)
  
  let neighbors = document.createElement("ul")
  for (let i = 0; i < nlist.length; i += 1) {
    neighbors.appendChild(nlist[i][0])
  }

  ndiv.innerHTML = ""
  ndiv.appendChild(neighbors)
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
    newedge.attributes = {"weight": edges[edge], "distance": 1 / edges[edge], "size": 1, "color": EDGECOLOR_DEFAULT}

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

  window.graph = Graph.from(gdata, {type: "undirected"})

  window.graph.forEachNode( node => {
    if (!nodeinfo[node]) {
      console.log(node)
      return
    }

    window.graph.setNodeAttribute(node, 'type', "border")
    window.graph.setNodeAttribute(node, 'label', oneName(nodeinfo[node][0]).trim())
    window.graph.setNodeAttribute(node, 'fullname', nodeinfo[node][0])
    window.graph.setNodeAttribute(node, 'x', nodeinfo[node][2])
    window.graph.setNodeAttribute(node, 'y', nodeinfo[node][3])
    window.graph.setNodeAttribute(node, 'zIndex', 1)
    window.graph.setNodeAttribute(node, 'size', 3)
    window.graph.setNodeAttribute(node, 'color', NODECOLOR_DEFAULT)
    window.graph.setNodeAttribute(node, 'borderColor', NODEBORDER_DEFAULT)
    console.log(nodeinfo[node][0])
    window.nameToId[nodeinfo[node][0]] = node
    window.nameToId[ oneName(nodeinfo[node][0]).trim()] = node
  } );

  let components = connectedComponents(window.graph);
  components.sort((a, b) => b.length - a.length);
  for (let i = 0; i < components.length; i++) {
    let gc = subgraph(window.graph, components[i])
    networks.push(gc)
  }

  if (components.length == 0) {
    networks = [ window.graph ];
  }

  let numsize = {}
  let str = ""
  document.getElementById("nodesearch").innerHTML = ""
  for (let i = 0; i < networks.length; i++) {
    let size = networks[i].nodes().length

    if (numsize[size]) {
      numsize[size] += 1;
      str += `<option value=${i}> ${networks[i].nodes().length} Nodes ${String.fromCharCode(64 + numsize[size])} </option>`
    }
    else { 
      numsize[size] = 1;
      str += `<option value=${i}> ${networks[i].nodes().length} Nodes </option>`

    }

    setupNodeSearch(networks[i])
  }

  $("#component-select").get(0).innerHTML = str

  window.components = networks

  //setupNodeSearch(networks[0])
  setupCentralityTables(networks[0])
}

function setupNodeSearch(component) {
  let searchoptions = document.getElementById("nodesearch");
  let nodes = component.nodes();

  let optionsArray = [];

  for (let i = 0; i < nodes.length; i += 1) {
    let op = document.createElement("option");
    op.value = nodeinfo[nodes[i]][0];
    op.setAttribute("node", nodes[i]);
    op.textContent = nodeinfo[nodes[i]][0]; // display text
    optionsArray.push(op);
  }

  // Sort alphabetically ignoring numbers (case-insensitive)
  optionsArray.sort((a, b) => {
    const stripNumbers = str => str.replace(/[^a-z]/gi, '');
    const nameA = stripNumbers(a.textContent).toLowerCase();
    const nameB = stripNumbers(b.textContent).toLowerCase();
    return nameA.localeCompare(nameB);
  });

  optionsArray.forEach(op => searchoptions.appendChild(op));
}


export function setupCentralityTables(component) {
  // degree centrality
  let ranking = []
  let nodes = component.nodes()

  betweennessCentrality.assign(component, {nodeCentralityAttribute: "btwn", normalized: true, getEdgeWeight: null});
  closenessCentrality.assign(component, {nodeCentralityAttribute: "close"});

  for (let i = 0; i < nodes.length; i += 1) {
    let nattr = component._nodes.get(nodes[i])
    let eweights = Math.round(Object.values(nattr["undirected"]).reduce((partial, v) => partial + v["attributes"]["weight"], 0))
    nattr.attributes["wdegree"] = eweights

    let obj = {}
    obj.name = nattr.attributes["label"]
    obj.key = nattr.key
    obj.degree = nattr.undirectedDegree
    obj.wdegree = nattr.attributes["wdegree"]
    obj.btwn = Math.round(nattr.attributes["btwn"] * (nodes.length - 1) * 10) / 10
    obj.close = Math.round(nattr.attributes["close"] * (nodes.length - 1) * 10) / 10
    ranking.push(obj)
  }


  var columns = [
    { title:"", field:"", formatter:"rownum", width: "2%", headerSort: false},
    { title: "Name", field: "name", formatter: authorCell2, resizable: false, headerFilter:"input", width: "30%" },
    { title: "\# Co-Authors", field: "degree", resizable: false, headerSortStartingDir:"desc" },
    { title: "\# Co-Publications", field: "wdegree", resizable: false, headerSortStartingDir:"desc"},
    { title: "Close", field: "close", resizable: false, headerSortStartingDir:"desc"},
    { title: "Between", field: "btwn", resizable: false, headerSortStartingDir:"desc"},
  ];

  window.nodeTable = new Tabulator("#index", {
    data: ranking,
    columns: columns,
    height: "100%",
    layout: "fitData",
    initialSort:[
      {column:"name", dir:"asc"}
    ]
  });

  window.nodeTable.on("tableBuilt", () => {

  })
}