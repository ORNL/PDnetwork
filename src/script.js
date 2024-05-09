import peri from "./scopus.json"

import { authorCell, switch_tabs, set_selected_div, transformData, zoomToPos, renderNetworks, set_components_from_ai } from "./utils.js"

import './style.css';

function searchScientist(input) {
  let name = input.value

  let nid = window.nameToId[name]
  if (nid) {
    let nattr = window.renderer.nodeDataCache[parseInt(nid)]
    input.value = ""
    //zoomToPos(nattr.x, nattr.y)
    set_selected_div(nid)
  }
  else {
    console.log(name + " not found")
  }
}

function updateYears(table) {
  let minval = parseInt(document.getElementById("minyear").value)
  let maxval = parseInt(document.getElementById("maxyear").value)

  let filters = table.getFilters();
  for (let i = 0; i < filters.length; i += 1) {
    if (filters[i].field == "py") {
      table.removeFilter("py", filters[i].type, filters[i].value)
    }
  }
  table.addFilter("py", ">=", minval);
  table.addFilter("py", "<=", maxval);

  updateNetworks(table);

  // update network/selected information
  let selected = window.selected
  let selecteddiv = document.getElementById("selected")
  selecteddiv.innerHTML = ""

  set_selected_div(selected, true)
}

function updateNetworks(table) {
  let filters = table.getFilters();
  
  let geq = 2000;
  let leq = 2023;
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


$(document).ready(function() {
  window.pa_list = JSON.parse(peri)
  let transposed = transformData(window.pa_list)
  
  set_components_from_ai(window.pa_list["ai"])

  window.component = 0
  window.selected = null
  set_selected_div()

  window.table = new Tabulator("#info", {
    data: transposed,
    layout: "fitData",
    columns: [
      {title:"", field:"", formatter:"rownum", width: "5%", headerSort: false},
      { title: "Authors", field: "af", width: "32%", formatter: authorCell,  resizable: false, variableHeight:true},
      { title: "Title", field: "ti", width: "50%", resizable: false, formatter:"textarea"},
      { title: "Year", field: "py",  width: "10%", resizable: false},
    ]
  })

  window.tab = "info"
  window.componentpapers = false

  window.table.on("tableBuilt", () => {
    $("#minyear").get(0).addEventListener("change", () => updateYears(table));
    $("#maxyear").get(0).addEventListener("change", () => updateYears(table));
    //$("#component-select").get(0).addEventListener("change", () => updateComponent());
    $("#nodesearchfield").get(0).addEventListener("keyup", (e) => {
      if (e.key == "Enter" || e.keyCode == 13) {
        searchScientist(e.target);
      }
    });

    renderNetworks()
    switch_tabs("index", true)

    $("#infotab").get(0).addEventListener("click", () => {
      switch_tabs("info")
    })
    $("#indextab").get(0).addEventListener("click", () => {
      switch_tabs("index")
    })
    $("#neighbortab").get(0).addEventListener("click", () => {
      switch_tabs("neighbor")
    })
    $("#papertab").get(0).addEventListener("click", () => {
      switch_tabs("paper")
    })
  });
})
