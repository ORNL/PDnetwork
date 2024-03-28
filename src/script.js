import peri from "./peri.json"

import { oneName, transformData, zoomToPos, renderNetworks, set_components_from_ai } from "./utils.js"

import './style.css';

function searchScientist(input) {
  let name = input.value
  input.value = ""
  console.log(name)
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

function authorCell(cellname, params, onRendered) {
  //console.log(cellname.getValue(), cellname["_cell"].row.position)
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
        let nattr = window.renderer.nodeDataCache[node]
        zoomToPos(nattr.x, nattr.y)
      })
    })

  return cell
}

$(document).ready(function() {
  window.pa_list = JSON.parse(peri)
  let transposed = transformData(window.pa_list)

  console.log(transposed)

  set_components_from_ai(window.pa_list["ai"])

  window.component = 0
  renderNetworks()

  window.table = new Tabulator("#info", {
    data: transposed,
    layout: "fitData",
    columns: [
      { title: "Authors", field: "af", width: "35%", formatter: authorCell,  resizable: false, variableHeight:true},
      { title: "Title", field: "ti", width: "52%", resizable: false, formatter:"textarea"},
      { title: "Year", field: "py",  width: "10%", resizable: false},
    ]
  })

  window.table.on("tableBuilt", () => {
    $("#minyear").get(0).addEventListener("change", () => updateYears(table));
    $("#maxyear").get(0).addEventListener("change", () => updateYears(table));
    $("#component-select").get(0).addEventListener("change", () => updateComponent());
    $("#nodesearch").get(0).addEventListener("keyup", (e) => {
      if (e.key == "Enter" || e.keyCode == 13) {
        searchScientist(e.target);
      }
    });
  });
})