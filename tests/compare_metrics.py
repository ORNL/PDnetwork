# compare the site metrics with networkx

import json
import subprocess
import sys
from pathlib import Path

import networkx as nx

RUNNER = Path(__file__).with_name("site-metrics.js")

NETWORKS = {
    "karate": nx.karate_club_graph(),
    "star (order 9)": nx.star_graph(9),
    "les miserables": nx.convert_node_labels_to_integers(nx.les_miserables_graph()),
}

def papers(G):
    return [[u, v] for u, v, w in G.edges(data="weight", default=1) for _ in range(int(w))]

def compare(G, site):
    checks = [
        ("authors", site["network"]["authors"], len(G)),
        ("links", site["network"]["links"], G.number_of_edges()),
        ("publications", site["network"]["publications"], G.size(weight="weight")),
    ]

    close = nx.closeness_centrality(G)
    btwn = nx.betweenness_centrality(G, normalized=True)
    for n in G:
        s = site["nodes"][str(n)]

        checks += [
            ("node {} degree".format(n), s["degree"], G.degree(n)),
            ("node {} wdegree".format(n), s["wdegree"], G.degree(n, weight="weight")),
            ("node {} close".format(n), s["close"], close[n]),
            ("node {} btwn".format(n), s["btwn"], btwn[n]),
        ]

    return [(label, a, b) for label, a, b in checks if abs(a - b) > 1e-9]

def report(name, errors):
    print("{}: {}".format(name, "FAIL" if errors else "PASS"))

    for error in errors:
        print("  {}: got {}, expected {}".format(*error))
    return not errors

if __name__ == "__main__":
    passed = True

    for name, G in NETWORKS.items():
        site = json.loads(subprocess.run(["node", str(RUNNER)], input=json.dumps(papers(G)), stdout=subprocess.PIPE, encoding="utf8", check=True).stdout)
        passed = report(name, compare(G, site)) and passed
        
    sys.exit(0 if passed else 1)
