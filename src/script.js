import { loadPublications, transformData, filterPublicationAuthors, buildNetworks } from "./data.js"

import { setupCentralityTables, switch_tabs, set_selected_div as set_nodeselect_div, setupNetworkControls, configureUI, ui } from "./utils.js"

import './style.css';
import { assignAuthorMetrics } from './metric.js';
import { createNetworkView } from './network.js';

// Application state is owned here and passed explicitly to the UI helpers.
export const state = {
  publications: null, publicationRows: [], filteredPublications: [], publicationAuthors: {},
  minYear: 2000, maxYear: 2025,
  graph: null, components: [], nameToId: {}, componentIndex: 0, selectedAuthor: null,
  componentOnly: false, tab: "info",
}

const network = createNetworkView(document.getElementById("network"), {
  onSelect: id => set_nodeselect_div(id),
  canInteract: () => !updating,
})

const measuredComponents = new WeakSet()

function updateError(message = "") {
  const alert = document.getElementById("update-error")
  alert.textContent = message
  alert.hidden = !message
}

async function renderState(selection, controls = false) {
  const component = state.components[state.componentIndex]
  if (controls) setupNetworkControls()
  document.getElementById("component-select").value = String(state.componentIndex)
  document.getElementById("minyear").value = String(state.minYear)
  document.getElementById("maxyear").value = String(state.maxYear)
  network.show(component)
  // Drain both operations before rollback, including synchronous view failures.
  const results = await Promise.allSettled([
    Promise.resolve().then(() => ui.table.replaceData(visiblePublications())),
    Promise.resolve().then(() => setupCentralityTables(component)),
  ])
  const failure = results.find(result => result.status === "rejected")
  if (failure) throw failure.reason
  set_nodeselect_div(selection, true)
  redraw_tables()
}

function visiblePublications() {
  const component = state.components[state.componentIndex]
  return state.componentOnly
    ? state.filteredPublications.filter(paper => component.hasNode(String(paper.ai[0])))
    : state.filteredPublications
}

// Startup, year changes, component navigation, and cross-component author
// selection all use this sequence. Add new dependent views in the render block.
export async function updateNetwork({
  minYear = state.minYear, maxYear = state.maxYear,
  componentIndex, selectedAuthor = state.selectedAuthor,
} = {}) {
  if (!Number.isInteger(minYear) || !Number.isInteger(maxYear) || minYear > maxYear) {
    throw new RangeError("Enter a valid year range with the start year before the end year.")
  }
  const rebuild = !state.graph || minYear !== state.minYear || maxYear !== state.maxYear
  const publicationAuthors = rebuild
    ? filterPublicationAuthors(state.publications, minYear, maxYear)
    : state.publicationAuthors
  const networks = rebuild ? buildNetworks(publicationAuthors) : state
  const components = networks.components

  // On a year change, follow a surviving author even if component ordering changed.
  // Without an author, keep the component containing the previous component's
  // first surviving node. If it disappeared entirely, fall back to the largest.
  let index = componentIndex
  if (index === undefined) {
    index = selectedAuthor == null ? -1 : components.findIndex(graph => graph.hasNode(String(selectedAuthor)))
    if (index < 0 && rebuild) {
      const oldNodes = state.components[state.componentIndex]?.nodes() || []
      const survivor = oldNodes.find(node => networks.graph.hasNode(node))
      index = survivor === undefined ? 0 : components.findIndex(graph => graph.hasNode(survivor))
    }
    if (index < 0) index = state.componentIndex
  }
  index = Math.max(0, Math.min(Number.isInteger(Number(index)) ? Number(index) : 0, components.length - 1))
  const component = components[index]
  const selection = selectedAuthor != null && component.hasNode(String(selectedAuthor)) ? String(selectedAuthor) : null

  // Prepare calculations before changing the currently displayed state. Components
  // are immutable between year rebuilds, so revisits can reuse their metrics.
  if (!measuredComponents.has(component)) {
    assignAuthorMetrics(component)
    measuredComponents.add(component)
  }
  const previous = { ...state }
  try {
    network.select(null)
    Object.assign(state, {
      minYear, maxYear, publicationAuthors,
      graph: networks.graph, components, nameToId: networks.nameToId,
      componentIndex: index, selectedAuthor: null,
    })
    if (rebuild) {
      state.filteredPublications = state.publicationRows.filter(paper =>
        Object.prototype.hasOwnProperty.call(publicationAuthors, paper.id)
      )
    }
    await renderState(selection, rebuild)
    updateError()
  } catch (error) {
    Object.assign(state, previous)
    try {
      if (previous.graph) {
        await renderState(previous.selectedAuthor, true)
        switch_tabs(previous.tab)
      } else {
        network.destroy()
        await ui.table.replaceData([])
        document.getElementById("network-half").hidden = true
        document.getElementById("info-half").hidden = true
      }
      updateError(previous.graph
        ? "Could not update the network. The previous view has been restored. Please try again."
        : "Could not load the network. Please reload the page to try again.")
    } catch (recoveryError) {
      // A broken renderer/table must not remain visible as if it were current.
      document.getElementById("network-half").hidden = true
      document.getElementById("info-half").hidden = true
      updateError("Could not restore the network view. Please reload the page.")
      console.error("Could not restore the network", recoveryError)
    }
    throw error
  }
}

function searchScientist(input) {
  const nid = state.nameToId[input.value]
  if (nid !== undefined && selectOutsideComponentID(nid)) input.value = ""
}

let lockReleasedAt = 0
let updating = false
const updateControlIds = ["minyear", "maxyear", "component-select", "leftcomponent", "rightcomponent", "lcccomponent", "nodesearchfield", "cpcheckbox"]

// Graph calculations block the main thread. Paint the busy state first and
// keep all update controls locked until the asynchronous table updates finish.
function runLocked(work) {
  let controls = updateControlIds.map(id => document.getElementById(id)).filter(Boolean)

  // already rebuilding, ignore anything that slipped through
  if (updating) {
    return
  }

  updating = true
  controls.forEach((control) => { control.disabled = true })
  document.getElementById("app").classList.add("rebuilding")

  requestAnimationFrame(() => setTimeout(async () => {
    try {
      await work()
    }
    catch (error) {
      console.error("Could not update the network", error)
      if (document.getElementById("update-error").hidden) {
        updateError("Could not update the network. Please try again or reload the page.")
      }
    }
    finally {
      // Clicks made during the freeze sit in the queue undispatched until the main
      // thread frees up. Releasing inline would hand them re-enabled controls and
      // start a second rebuild, so give the queue a turn to drain first.
      setTimeout(() => {
        lockReleasedAt = performance.now()
        updating = false
        updateControlIds.forEach(id => {
          const control = document.getElementById(id)
          if (control) control.disabled = false
        })
        document.getElementById("app").classList.remove("rebuilding")
      }, 0)
    }
  }, 0))
}

// Backstop for whatever still slips through the drain. timeStamp is set when the
// browser creates the event, not when it dispatches, so a click made during the
// lock stays identifiable as stale however late it arrives.
function staleEvent(event) {
  return updating || (event && event.timeStamp < lockReleasedAt)
}

function updateYears(event) {
  if (staleEvent(event)) return
  const minInput = document.getElementById("minyear")
  const maxInput = document.getElementById("maxyear")
  const minYear = minInput.valueAsNumber
  const maxYear = maxInput.valueAsNumber
  maxInput.setCustomValidity(minYear > maxYear ? "End year must be at least the start year." : "")
  if (!minInput.reportValidity() || !maxInput.reportValidity() || !Number.isInteger(minYear) || !Number.isInteger(maxYear)) return
  if (minYear !== state.minYear || maxYear !== state.maxYear) {
    runLocked(() => updateNetwork({ minYear, maxYear }))
  }
}

function authorCell(cellname, params, onRendered) {
  let names = cellname.getValue().split("; ").slice(0, 10)
  let cell = document.createElement("div")
  cell.className = "author-cell"

  for (let i = 0; i < names.length; i += 1) {
    let author = document.createElement("div")
    author.className = "author"
    author.innerHTML = `${names[i]}; `
    author.setAttribute("node", parseInt(state.nameToId[names[i]]))
    cell.appendChild(author)
  }

  const ais = cellname.getData().ai
  const component = state.components[state.componentIndex]
  if (!component.hasNode(String(ais[0]))) cell.classList.add("nohover")
  onRendered(() => {
    const authors = cell.children
    for (let j = 0; j < authors.length; j += 1) {
      const node = String(ais[j])
      for (const [event, enable] of [["mouseenter", true], ["mouseleave", false]]) {
        authors[j].addEventListener(event, () => {
          network.hover(node, enable)
        })
      }
      authors[j].addEventListener("click", event => {
        if (!staleEvent(event)) selectOutsideComponentID(node)
      })
    }
  })

  return cell
}

function selectOutsideComponentID(nid) {
  if (nid == null || updating) return false
  const componentIndex = state.components.findIndex(graph => graph.hasNode(String(nid)))
  if (componentIndex < 0) return false
  if (componentIndex === state.componentIndex) {
    set_nodeselect_div(String(nid), true)
  } else {
    runLocked(() => updateNetwork({ componentIndex, selectedAuthor: String(nid) }))
  }
  return true
}

function redraw_tables() {
  ui.table.redraw(true)

  if (ui.papers && ui.papersReady) {
    ui.papers.redraw(true)
  }
}

function updateComponent(number = null, event = null) {
  if (staleEvent(event)) return
  const requested = number ?? Number(document.getElementById("component-select").value)
  const componentIndex = Math.max(0, Math.min(requested, state.components.length - 1))
  if (componentIndex === state.componentIndex) return
  runLocked(() => updateNetwork({ componentIndex }))
}

$(document).ready(function() {
  state.publications = loadPublications()
  state.publicationRows = transformData(state.publications)
  configureUI(state, {
    isUpdating: () => updating,
    onHighlight: id => network.select(id),
    onHover: (id, enabled) => network.hover(id, enabled),
    onZoom: id => network.zoomTo(id),
    onComponentOnlyChange: (enabled, event) => {
      if (staleEvent(event)) return
      state.componentOnly = enabled
      runLocked(async () => {
        await ui.table.replaceData(visiblePublications())
        redraw_tables()
      })
    },
  })

  $("#reset").on("click", () => {
    if (!updating) network.resetCamera()
  })

  ui.table = new Tabulator("#info", {
    data: [],
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

  ui.table.on("cellClick", (e, cell) => {
    let field = cell.getField()
    if (field == "ti") {
      window.open("https://doi.org/" + cell.getRow().getData().doi, "_blank");
    }
    else {
      console.log(cell)
    }
  });

  ui.table.on("tableBuilt", () => {
    runLocked(async () => {
      await updateNetwork()
      switch_tabs("index", true)
    })
    $("#minyear").get(0).addEventListener("change", (e) => updateYears(e));
    $("#maxyear").get(0).addEventListener("change", (e) => updateYears(e));

    $("#leftcomponent").get(0).addEventListener("click", (e) => { updateComponent(parseInt(state.componentIndex) - 1, e) })
    $("#rightcomponent").get(0).addEventListener("click", (e) => { updateComponent(parseInt(state.componentIndex) + 1, e) })
    $("#lcccomponent").get(0).addEventListener("click", (e) => { updateComponent(0, e) })

    $("#component-select").get(0).addEventListener("change", (e) => updateComponent(null, e));
    $("#nodesearchfield").get(0).addEventListener("keyup", (e) => {
      if (e.key == "Enter" || e.keyCode == 13) {
        searchScientist(e.target);
      }
    });
    $("#nodesearchfield").get(0).addEventListener("input", (e) => {
      if (e.inputType && e.inputType !== "insertReplacementText") return;
      if (state.nameToId[e.target.value]) {
        searchScientist(e.target)
      }
    });


    $("#infotab").get(0).addEventListener("click", () => {
      if (updating) return
      switch_tabs("info")
      redraw_tables()
    })
    $("#indextab").get(0).addEventListener("click", () => {
      if (updating) return
      switch_tabs("index")
      redraw_tables()
    })
    $("#neighbortab").get(0).addEventListener("click", () => {
      if (updating) return
      switch_tabs("neighbor")
      redraw_tables()
    })
    $("#papertab").get(0).addEventListener("click", () => {
      if (updating) return
      switch_tabs("paper")
      redraw_tables()
    })
  });
})
