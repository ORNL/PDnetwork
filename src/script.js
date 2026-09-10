import peri from "./scopus.json"

import { hover_node, cancelselect, paperInComponent, toggle_componentpapers, setupCentralityTables, switch_tabs, set_selected_div as set_nodeselect_div, transformData, zoomToPos, renderNetworks, set_components_from_ai } from "./utils.js"

import './style.css';

function searchScientist(input) {
  let name = input.value

  let nid = window.nameToId[name]
  if (window.components[window.component].nodes().includes(nid)) {
    input.value = ""
    set_nodeselect_div(nid, true)
  }
  else {
    let found = selectOutsideComponentID(nid)
    if (found) {
      input.value = ""
    }
  }
}

let lockReleasedAt = 0

// A rebuild blocks the main thread start to finish, so disable the controls that
// trigger it - a disabled control dispatches no events, which drops any queued
// double-click - and yield a frame so the locked state paints before the freeze.
function runLocked(controlIds, containerId, work) {
  let controls = controlIds.map((id) => document.getElementById(id))

  // already rebuilding, ignore anything that slipped through
  if (controls.some((control) => control.disabled)) {
    return
  }

  controls.forEach((control) => { control.disabled = true })
  document.getElementById(containerId).classList.add("rebuilding")

  requestAnimationFrame(() => setTimeout(() => {
    try {
      work()
    }
    finally {
      // Clicks made during the freeze sit in the queue undispatched until the main
      // thread frees up. Releasing inline would hand them re-enabled controls and
      // start a second rebuild, so give the queue a turn to drain first.
      setTimeout(() => {
        lockReleasedAt = performance.now()
        controls.forEach((control) => { control.disabled = false })
        document.getElementById(containerId).classList.remove("rebuilding")
      }, 0)
    }
  }, 0))
}

// Backstop for whatever still slips through the drain. timeStamp is set when the
// browser creates the event, not when it dispatches, so a click made during the
// lock stays identifiable as stale however late it arrives.
function staleEvent(event) {
  return event && event.timeStamp < lockReleasedAt
}

function updateYears(event) {
  if (staleEvent(event)) {
    return
  }

  runLocked(["minyear", "maxyear"], "year-filter", rebuildYears)
}

function rebuildYears() {
  window.minyearval = parseInt(document.getElementById("minyear").value)
  window.maxyearval = parseInt(document.getElementById("maxyear").value)

  let filters = window.table.getFilters();
  for (let i = 0; i < filters.length; i += 1) {
    if (filters[i].field == "py") {
      table.removeFilter("py", filters[i].type, filters[i].value)
    }
  }
  
  // update table
  let pa_list = window.pa_list;
  let newlist = {}
  for (const [key, value] of Object.entries(pa_list.py)) {
    if (value >= window.minyearval && value <= window.maxyearval) {
      newlist[key] = pa_list.ai[key]
    }
  }

  window.table.addFilter("py", ">=", window.minyearval);
  window.table.addFilter("py", "<=", window.maxyearval);

  let selected = window.selected

  set_components_from_ai(newlist);

  let old = [window.renderer.camera.x, window.renderer.camera.y, window.renderer.camera.ratio];
  renderNetworks()

  if (window.selected) {
    window.selected = null
    if (window.components[window.component].nodes().includes(selected)) {
      // window.renderer.camera.x = old[0];
      // window.renderer.camera.y = old[1];
      // window.renderer.camera.ratio = old[2];
      set_nodeselect_div(selected)
    }
    else {
      let beforetab = self.tab;
      let searchnode = selectOutsideComponentID(selected)

      if (!searchnode) {
        set_nodeselect_div(null, true)
        document.getElementById("component-select").value = String(window.component)
        setComponent(0);
      }
      else {
        switch_tabs(beforetab);
      }
    }
  }
  else {
    let selecteddiv = document.getElementById("selected")
    selecteddiv.innerHTML = ""
    set_nodeselect_div(window.selected, true)
    document.getElementById("component-select").value = String(window.component)
  }
}


function authorCell(cellname, params, onRendered) {
  //console.log(cellname.getValue(), cellname["_cell"].row.position)
  let names = cellname.getValue().split("; ").slice(0, 10)
  let cell = document.createElement("div")
  cell.className = "author-cell"

  for (let i = 0; i < names.length; i += 1) {
    let author = document.createElement("div")
    author.className = "author"
    author.innerHTML = `${names[i]}; `
    author.setAttribute("node", parseInt(window.nameToId[names[i]]))
    cell.appendChild(author)
  }

  let nodes = window.components[window.component].nodes()
  let ais = cellname.getRow().getData().ai

  let incomponent = true
  if (!nodes.includes(String(ais[0]))) {
    cell.classList.add("nohover")
    incomponent = false
  }
    
  onRendered(() => {
    let authors = cellname.getElement().children[0].children 

    for (let j = 0; j < authors.length; j += 1) {
      let network = window.components[window.component]
      let node = cellname.getData().ai[j]
      let nodeobj = network._nodes.get(node.toString())

      if (incomponent) {
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
          set_nodeselect_div(node.toString())
        })
      }
      else {
        authors[j].addEventListener("click", () => {
          selectOutsideComponentID(node.toString())
        })
      }
    }
  })

  return cell
}

function selectOutsideComponentID(nid) {
  if (!nid) {
    alert("Could not find node")
    console.log("From alert:", nid)
    return false
  }

  for (let i = 0; i < window.components.length; i += 1) {
    let cnodes = window.components[i].nodes()

    if (cnodes.includes(nid)) {
      setComponent(i)
      console.log(nid, cnodes)
      set_nodeselect_div(nid)
      return true
    }
  }

  return false
}

function setComponent(num) {
  cancelselect(window.selected)
  let select = $("#component-select").get(0);
  select.value = num;

  let selecteddiv = document.getElementById("selected")
  selecteddiv.innerHTML = ""

  window.component = num;
  set_nodeselect_div(window.selected, true)
  setupCentralityTables(window.components[num])

  if (window.componentpapers) {
    toggle_componentpapers(false)
    toggle_componentpapers(true)
    window.table.setFilter(paperInComponent, window.components[num].nodes())
    window.table.addFilter("py", ">=", window.minyearval);
    window.table.addFilter("py", "<=", window.maxyearval);
  }

  redraw_tables()

  renderNetworks()
}

function redraw_tables() {
  window.table.redraw(true)

  if (window.papers) {
    window.papers.redraw(true)
  }
}

function updateComponent(number=null, event=null) {
  if (staleEvent(event)) {
    return
  }

  let selectdiv = $("#component-select").get(0)

  if (number == null) {
    number = selectdiv.selectedIndex;
  }
  else {
    number = Math.max(number, 0)
    number = Math.min(number, window.components.length - 1)
  }
  let value = selectdiv.options[number].value

  // nothing to rebuild, so don't lock - clicking the arrow at either end lands here
  if (value == window.component) {
    return
  }

  runLocked(["component-select", "leftcomponent", "rightcomponent", "lcccomponent"], "components", () => setComponent(value))
}


$(document).ready(function() {
  window.pa_list = JSON.parse(peri)
  let transposed = transformData(window.pa_list)
  
  set_components_from_ai(window.pa_list["ai"])

  window.component = 0
  window.selected = null
  set_nodeselect_div()

  window.tab = "info"
  window.componentpapers = false

  window.minyearval = 2000
  window.maxyearval = 2025

  $("#reset").on("click", () => {
    window.renderer.camera.ratio = 1
    zoomToPos(0.5, 0.5)
  })

  window.table = new Tabulator("#info", {
    data: transposed,
    layout: "fitData",
    height: "100%",
    columns: [
      {title:"", field:"", formatter:"rownum", width: "5%", headerSort: false},
      { title: "Authors", field: "af", width: "32%", formatter: authorCell,  resizable: false, variableHeight:true, cssClass: "authorName", headerFilter:"input"},
      { title: "Title", field: "ti", width: "50%", resizable: false, formatter:"textarea", cssClass: "paperTitle", headerFilter:"input"},
      { title: "Year", field: "py",  width: "10%", resizable: false},
    ],
    initialSort: [
      {column:"ti", dir:"asc"},
      {column:"py", dir:"desc"}
    ]
  })

  window.table.on("cellClick", (e, cell) => {
    let field = cell.getField()
    if (field == "ti") {
      window.open("https://doi.org/" + cell.getRow().getData().doi, "_blank");
    }
    else {
      console.log(cell)
    }
  });

  window.table.on("tableBuilt", () => {
    $("#minyear").get(0).addEventListener("change", (e) => updateYears(e));
    $("#maxyear").get(0).addEventListener("change", (e) => updateYears(e));

    $("#leftcomponent").get(0).addEventListener("click", (e) => { updateComponent(parseInt(window.component) - 1, e) })
    $("#rightcomponent").get(0).addEventListener("click", (e) => { updateComponent(parseInt(window.component) + 1, e) })
    $("#lcccomponent").get(0).addEventListener("click", (e) => { updateComponent(0, e) })

    $("#component-select").get(0).addEventListener("change", (e) => updateComponent(null, e));
    $("#nodesearchfield").get(0).addEventListener("keyup", (e) => {
      if (e.key == "Enter" || e.keyCode == 13) {
        searchScientist(e.target);
      }
    });
    $("#nodesearchfield").get(0).addEventListener("input", (e) => {
      if (e.inputType && e.inputType !== "insertReplacementText") return;
      if (window.nameToId[e.target.value]) {
        searchScientist(e.target)
      }
    });

    renderNetworks()
    switch_tabs("index", true)

    $("#infotab").get(0).addEventListener("click", () => {
      switch_tabs("info")
      redraw_tables()
    })
    $("#indextab").get(0).addEventListener("click", () => {
      switch_tabs("index")
      redraw_tables()
    })
    $("#neighbortab").get(0).addEventListener("click", () => {
      switch_tabs("neighbor")
      redraw_tables()
    })
    $("#papertab").get(0).addEventListener("click", () => {
      switch_tabs("paper")
      redraw_tables()
    })
  });
})
