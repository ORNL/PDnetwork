import betweennessCentrality from 'graphology-metrics/centrality/betweenness';
import closenessCentrality from 'graphology-metrics/centrality/closeness';

const fourDecimals = value => Number(value).toFixed(4);
// Preserve the ranking table's existing scaling; the panel shows raw centrality.
const scaledCentrality = (value, graph) => Math.round(value * (graph.order - 1) * 10) / 10;

/**
 * To add an author metric, append one definition to authorMetricDefinitions:
 *   key: a unique graph attribute name (avoid existing metadata/display attributes)
 *   label: the selected-author panel label
 *   calculate(graph): return { [nodeId]: numericValue } for every node
 *   columnTitle: optional ranking column; omit for panel-only metrics
 *   format(value): optional panel formatting (raw numbers remain on the graph)
 *   tableValue(value, graph): optional numeric conversion for the ranking table
 *
 * Calculations receive a Graphology graph, run once per network update, and must
 * handle isolated nodes (the runner skips empty graphs). They must not access the DOM/window
 * or depend on another metric's execution order. Both views read this list.
 *
 * Example entry (no UI edits needed):
 * { key: 'degreeFraction', label: 'Degree fraction', columnTitle: 'Degree fraction',
 *   calculate: graph => Object.fromEntries(graph.nodes().map(node =>
 *     [node, graph.order > 1 ? graph.degree(node) / (graph.order - 1) : 0])),
 *   format: value => value.toFixed(4) }
 */
export const authorMetricDefinitions = [
  {
    key: 'degree', label: 'Number of collaborators', columnTitle: '# Co-Authors',
    calculate: graph => Object.fromEntries(
      graph.nodes().map(node => [node, graph.undirectedDegree(node)])
    ),
  },
  {
    key: 'wdegree', label: 'Number of collaborative publications', columnTitle: '# Co-Publications',
    // A paper with n authors contributes 1 / (n - 1) to each collaboration edge.
    // Preserve the existing rounded weighted degree (excluding solo papers).
    calculate: graph => Object.fromEntries(graph.nodes().map(node => {
      let weight = 0;
      graph.forEachUndirectedEdge(node, (edge, attributes) => {
        weight += attributes.weight;
      });
      return [node, Math.round(weight)];
    })),
  },
  {
    key: 'close', label: 'Closeness centrality', columnTitle: 'Close',
    calculate: graph => closenessCentrality(graph),
    format: fourDecimals,
    tableValue: scaledCentrality,
  },
  {
    key: 'btwn', label: 'Betweenness centrality', columnTitle: 'Between',
    calculate: graph => betweennessCentrality(graph, { normalized: true, getEdgeWeight: null }),
    format: fourDecimals,
    tableValue: scaledCentrality,
  },
];

// Add network/component metrics here. calculate(graph, publicationAuthors)
// returns a number; publicationAuthors is a publication-ID -> author-ID[] map.
export const networkMetricDefinitions = [
  { key: 'authors', label: 'Number of authors', calculate: graph => graph.order },
  {
    key: 'publications', label: 'Number of publications',
    calculate: (graph, publicationAuthors) => {
      const nodes = new Set(graph.nodes());
      // Preserve the original first-author membership rule. This assumes each
      // publication's authors belong to the same complete graph component.
      return Object.values(publicationAuthors).filter(
        authors => nodes.has(String(authors[0]))
      ).length;
    },
  },
  { key: 'links', label: 'Number of links', calculate: graph => graph.size },
];

export function networkMetrics(graph, publicationAuthors) {
  return Object.fromEntries(networkMetricDefinitions.map(metric =>
    [metric.key, metric.calculate(graph, publicationAuthors)]
  ));
}

// Explicitly assign numeric results for later reads by the author panel.
export function assignAuthorMetrics(graph) {
  if (graph.order === 0) return;
  for (const metric of authorMetricDefinitions) {
    const values = metric.calculate(graph);
    graph.forEachNode(node => {
      graph.setNodeAttribute(node, metric.key, values[node]);
    });
  }
}

// Call assignAuthorMetrics before reading results for a component.
export function authorMetrics(graph, node) {
  return Object.fromEntries(authorMetricDefinitions.map(metric =>
    [metric.key, graph.getNodeAttribute(node, metric.key)]
  ));
}
