import { nodeinfo } from './data.js';
import { networkMetrics, authorMetrics, networkMetricDefinitions, authorMetricDefinitions } from './metric.js';

let state
let callbacks
export const ui = { table: null, nodeTable: null, papers: null, papersReady: false }

export function configureUI(appState, handlers) {
  state = appState
  callbacks = handlers
}

function formatNetworkMetrics(graph) {
  const metrics = networkMetrics(graph, state.publicationAuthors)
  return networkMetricDefinitions.map(metric =>
    `<b>${metric.label}:</b> ${metric.format ? metric.format(metrics[metric.key]) : metrics[metric.key]}`
  )
}

export function componentMetrics(component) {
  return formatNetworkMetrics(component)
}

export function globalMetrics() {
  return formatNetworkMetrics(state.graph)
}

export function localMetrics(component, authorId) {
  const metrics = authorMetrics(component, authorId)
  return [
    "<b>All names:</b> " + component.getNodeAttribute(authorId, 'fullname'),
    ...authorMetricDefinitions.map(metric =>
      `<b>${metric.label}:</b> ${metric.format ? metric.format(metrics[metric.key]) : metrics[metric.key]}`
    ),
  ]
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

  onRendered(() => {
    let authors = cellname.getElement().children[0].children

    for (let j = 0; j < authors.length; j += 1) {
      let node = authors[j].getAttribute("node")

      authors[j].addEventListener("mouseenter", () => callbacks.onHover(node, true))
      authors[j].addEventListener("mouseleave", () => callbacks.onHover(node, false))

      authors[j].addEventListener("click", () => {
        console.log(authors[j])
        set_selected_div(node)
      })
    }
  })

  return cell
}

export function switch_tabs(name, first=false) {
  if (state.tab != name) {
    state.tab = name
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
      if (state.selectedAuthor == null) {
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
    ui.nodeTable.redraw(true)
  }
}

export function toggle_componentpapers(show) {
  const holder = document.getElementById("componentpapers")
  holder.replaceChildren()
  if (!show) return
  const check = document.createElement("input")
  check.id = "cpcheckbox"
  check.type = "checkbox"
  check.checked = state.componentOnly
  check.disabled = callbacks.isUpdating()
  check.addEventListener("change", event => callbacks.onComponentOnlyChange(event.target.checked, event))
  holder.append(check, document.createTextNode("Only Component"))
}

export function set_selected_div(authorId=null, refresh=false) {
  if (callbacks.isUpdating() && !refresh) return
  const network = state.components[state.componentIndex]
  authorId = authorId == null ? null : String(authorId)
  if (authorId !== null && !network.hasNode(authorId)) authorId = null

  let selecteddiv = document.getElementById("selected")

  if (authorId == null) {
    if (state.selectedAuthor == null && selecteddiv.innerHTML.length > 0 && !refresh) {
      return
    }

    callbacks.onHighlight(null)
    state.selectedAuthor = null
    if (ui.papers) {
      ui.papers.destroy()
      ui.papers = null
      ui.papersReady = false
    }
    document.getElementById("neighbor").replaceChildren()

    let headingglobal = document.createElement("h4")
    headingglobal.innerHTML = "Entire Network Information"
    let componentinfo = componentMetrics(state.components[state.componentIndex])
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
    if (state.selectedAuthor == authorId && !refresh) {
      set_selected_div(null)
      return
    }
    state.selectedAuthor = authorId
    callbacks.onHighlight(authorId)

    // now update node info
    selecteddiv.innerHTML = ""
    let heading = document.createElement("h3")
    heading.id = "selectedName"

    let names = network.getNodeAttribute(authorId, 'fullname').split("; ")

    let nn = names[0]
    if (names.length > 1) {
      nn = names[1];
    }

    heading.innerHTML = "<b>Selected Node:</b> " + nn
    let localinfo = localMetrics(network, authorId)

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
      window.open("https://www.scopus.com/authid/detail.uri?authorId=" + nodeinfo[parseInt(state.selectedAuthor)][4], '_blank');
    })

    cancelbutton.addEventListener("click", () => {
      if (!callbacks.isUpdating()) set_selected_div(null, true)
    })

    zoombutton.addEventListener("click", () => {
      callbacks.onZoom(state.selectedAuthor)
    })


    selecteddiv.appendChild(canceldiv)
    selecteddiv.appendChild(bullets)

    let buttons = document.getElementsByClassName("tab2")

    for (let i = 0; i < buttons.length; i += 1) {
      if (buttons[i].classList.contains("hiddenbutton")) {
        buttons[i].className = "tab2 nonhiddenbutton"
      }
    }

    setup_selected_tabs(authorId)
  }
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
      authors[j].addEventListener("mouseenter", () => callbacks.onHover(String(colids[j]), true))
      authors[j].addEventListener("mouseleave", () => callbacks.onHover(String(colids[j]), false))
      authors[j].addEventListener("click", () => {
        set_selected_div("" + colids[j])
      })
    }
  })

  return cell
}

export function setup_selected_tabs(authorId) {
  authorId = String(authorId)
  const selectedpapers = state.filteredPublications.filter(row =>
    row.ai.some(author => String(author) === authorId)
  )
  if (ui.papers) ui.papers.destroy()
  ui.papersReady = false
  ui.papers = new Tabulator("#paper", {
    data: selectedpapers,
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

  const papers = ui.papers
  papers.on("tableBuilt", () => {
    if (ui.papers === papers) {
      ui.papersReady = true
      papers.redraw(true)
    }
  })

  ui.papers.on("cellClick", (e, cell) => {
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
  let network = state.components[state.componentIndex]
  network.forEachEdge(authorId, (edge, edgevals, source, target, sourcevals, targetvals) => {
    let text = document.createElement("li")

    let val = 0
    let name = ""
    if (source == authorId) {
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

    text.addEventListener("mouseenter", e => callbacks.onHover(e.target.getAttribute("key"), true))
    text.addEventListener("mouseleave", e => callbacks.onHover(e.target.getAttribute("key"), false))

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

export function setupNetworkControls() {
  const networks = state.components
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
  const tableMetrics = authorMetricDefinitions.filter(metric => metric.columnTitle)
  const ranking = component.nodes().map(key => {
    const metrics = authorMetrics(component, key)
    return {
      name: component.getNodeAttribute(key, 'label'),
      key,
      ...Object.fromEntries(tableMetrics.map(metric => [
        metric.key,
        metric.tableValue ? metric.tableValue(metrics[metric.key], component) : metrics[metric.key],
      ])),
    }
  })

  const columns = [
    { title:"", field:"", formatter:"rownum", width: "2%", headerSort: false},
    { title: "Name", field: "name", formatter: authorCell2, resizable: false, headerFilter:"input", width: "30%" },
    ...tableMetrics.map(metric => ({
      title: metric.columnTitle,
      field: metric.key,
      resizable: false,
      headerSortStartingDir: "desc",
    })),
  ];

  if (ui.nodeTable) return ui.nodeTable.replaceData(ranking)

  ui.nodeTable = new Tabulator("#index", {
    data: ranking,
    columns: columns,
    height: "100%",
    layout: "fitData",
    initialSort:[
      {column:"name", dir:"asc"}
    ]
  });

  return new Promise(resolve => ui.nodeTable.on("tableBuilt", resolve))
}
