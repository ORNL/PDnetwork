"""Read graph JSON on stdin; write spring-layout coordinates on stdout."""
import inspect
import json
import sys

import networkx as nx


def layout_positions(data):
    graph = nx.Graph()
    for nodes in data["components"]:
        graph.add_nodes_from(nodes)
    graph.add_edges_from(data["edges"])

    # NetworkX 2.x always uses the force algorithm and rejects `method`.
    options = {"method": "force"} if "method" in inspect.signature(nx.spring_layout).parameters else {}
    positions = {}
    for index, nodes in enumerate(data["components"]):
        component = nx.Graph()
        component.add_nodes_from(nodes)
        component.add_edges_from(graph.subgraph(nodes).edges())
        if len(nodes) > 1:
            print("Spring layout: component {}/{} ({} authors), up to {} iterations".format(
                index + 1, len(data["components"]), len(nodes), data["iterations"]),
                file=sys.stderr, flush=True)
        layout = nx.spring_layout(
            component, iterations=data["iterations"], threshold=1e-4,
            seed=data["seed"], weight=None, scale=1, **options
        )
        positions.update({node: point.tolist() for node, point in layout.items()})
    return positions


if __name__ == "__main__":
    json.dump(layout_positions(json.load(sys.stdin)), sys.stdout, allow_nan=False)
