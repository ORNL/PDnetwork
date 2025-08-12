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

function updateYears() {
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
  renderNetworks()

  if (window.selected) {
    window.selected = null
    if (window.components[window.component].nodes().includes(selected)) {
      set_nodeselect_div(selected)
    }
    else {
      let searchnode = selectOutsideComponentID(selected)
      if (!searchnode) {
        set_nodeselect_div(null, true)
      }
    }
  }
  else {
    let selecteddiv = document.getElementById("selected")
    selecteddiv.innerHTML = ""
    set_nodeselect_div(window.selected, true)
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

function selectOutsideComponentName(name) {
  let nid = window.nameToId[name]
  if (!nid) {
    alert("Could not find node")
    return false
  }

  for (let i = 0; i < window.components.length; i += 1) {
    let cnodes = window.components[i].nodes()
    if (nid in cnodes) {
      setComponent(i)
      set_nodeselect_div(nid)
      return true
    }
  }
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

function updateComponent(number=null) {
  let selectdiv = $("#component-select").get(0)

  if (number == null) {
    number = selectdiv.selectedIndex;
  }
  else {
    number = Math.max(number, 0)
    number = Math.min(number, window.components.length - 1)
  }
  let value = selectdiv.options[number].value

  if (value != window.component) {
    setComponent(value)
  }
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
  window.maxyearval = 2023

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
    $("#minyear").get(0).addEventListener("change", () => updateYears());
    $("#maxyear").get(0).addEventListener("change", () => updateYears());

    $("#leftcomponent").get(0).addEventListener("click", () => { updateComponent(parseInt(window.component) - 1) })
    $("#rightcomponent").get(0).addEventListener("click", () => { updateComponent(parseInt(window.component) + 1) })

    $("#component-select").get(0).addEventListener("change", () => updateComponent());
    $("#nodesearchfield").get(0).addEventListener("keyup", (e) => {
      if (e.key == "Enter" || e.keyCode == 13) {
        searchScientist(e.target);
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
