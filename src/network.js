import Sigma from 'sigma';
import { createNodeBorderProgram } from '@sigma/node-border';

const colors = {
  node: '#D2E5FF', border: '#2B7CE9',
  selected: '#E00000', selectedBorder: '#000000',
  neighbor: '#FFADAD', neighborBorder: '#004400',
  hover: '#FF00FF', hoveredNeighbor: '#55FF00',
  edge: 'rgba(0, 0, 0, 0.3)', selectedEdge: '#FF8585',
};

/**
 * Owns one network view, with no application state, tables, or metric logic.
 * show(graph) reuses the renderer and restores each graph's camera;
 * select(id|null) and hover(id, enabled)
 * change only its appearance. onSelect(id) reports clicks to the application.
 * Call destroy() when removing the view. All author IDs are normalized to strings.
 */
export function createNetworkView(container, { onSelect = () => {}, canInteract = () => true } = {}) {
  let renderer = null;
  let graph = null;
  let selected = null;
  let hovered = null;
  let neighbors = new Set();
  let cameras = new WeakMap();

  const nodeId = id => id != null && graph?.hasNode(String(id)) ? String(id) : null;

  // Reducers keep display attributes separate from the graph's scientific data.
  function nodeReducer(node, attributes) {
    const display = {
      ...attributes, type: 'border', size: 3, zIndex: 1,
      color: colors.node, borderColor: colors.border,
    };
    if (node === selected) {
      display.color = colors.selected;
      display.borderColor = colors.selectedBorder;
      display.zIndex = 2;
    } else if (neighbors.has(node)) {
      display.color = node === hovered ? colors.hoveredNeighbor : colors.neighbor;
      display.borderColor = colors.neighborBorder;
    } else if (node === hovered) {
      display.color = colors.hover;
    }
    return display;
  }

  function edgeReducer(edge, attributes) {
    const ends = graph.extremities(edge);
    if (selected !== null && ends.includes(selected)) {
      return { ...attributes, color: colors.selectedEdge, size: 2 };
    }
    if (hovered !== null && ends.includes(hovered)) {
      return { ...attributes, color: colors.hover, size: 1.5 };
    }
    return { ...attributes, color: colors.edge, size: 1 };
  }

  function destroy() {
    if (renderer) renderer.kill();
    renderer = null;
    graph = null;
    selected = null;
    hovered = null;
    neighbors = new Set();
    cameras = new WeakMap();
  }

  function hover(id, enabled) {
    if (!canInteract()) return;
    const node = nodeId(id);
    if (node === null) return;
    if (enabled) hovered = node;
    else if (hovered === node) hovered = null;
    renderer?.refresh();
  }

  return {
    show(component) {
      if (renderer && graph === component) return;
      if (renderer && graph) cameras.set(graph, { ...renderer.getCamera().getState() });
      graph = component;
      selected = null;
      hovered = null;
      neighbors = new Set();
      if (renderer) {
        renderer.setGraph(component);
        renderer.getCamera().setState(cameras.get(component) || { x: 0.5, y: 0.5, ratio: 1, angle: 0 });
        renderer.refresh();
        return;
      }
      renderer = new Sigma(graph, container, {
        labelRenderedSizeThreshold: 0,
        labelDensity: 0,
        zIndex: true,
        enableHovering: false,
        labelGridCellSize: 150,
        defaultNodeColor: colors.node,
        maxCameraRatio: 1,
        nodeReducer,
        edgeReducer,
        nodeProgramClasses: {
          border: createNodeBorderProgram({
            borders: [
              { size: { attribute: 'borderSize', defaultValue: 0.3 }, color: { attribute: 'borderColor' } },
              { size: { fill: true }, color: { attribute: 'color' } },
            ],
          }),
        },
      });
      renderer.on('clickNode', ({ node }) => {
        if (canInteract()) onSelect(node);
      });
      renderer.on('enterNode', ({ node }) => hover(node, true));
      renderer.on('leaveNode', ({ node }) => hover(node, false));
    },
    select(id) {
      selected = nodeId(id);
      neighbors = new Set(selected === null ? [] : graph.neighbors(selected));
      hovered = null;
      renderer?.refresh();
    },
    hover,
    zoomTo(id) {
      const node = nodeId(id);
      if (node === null || !renderer) return;
      const position = renderer.getNodeDisplayData(node);
      if (position) renderer.getCamera().setState({ x: position.x, y: position.y });
    },
    resetCamera() {
      renderer?.getCamera().setState({ x: 0.5, y: 0.5, ratio: 1 });
    },
    destroy,
  };
}
