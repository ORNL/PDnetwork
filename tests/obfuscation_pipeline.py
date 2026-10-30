# test the obfuscation pipeline on Zachary's karate club network
import csv
import json
import subprocess
import sys
import tempfile

import networkx as nx

from compare_metrics import compare, papers, report

G = nx.karate_club_graph()

with tempfile.TemporaryDirectory() as tmp:
    with open(f"{tmp}/karate.csv", "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["af", "si", "ti", "py"])
        for u, v in papers(G):
            writer.writerow([f"Karate, Member {u}; Karate, Member {v}", f"{1000 + u}; {1000 + v}", f"Karate paper {u}-{v}", 2020])

    subprocess.run(["node", "scripts/build-data.js", f"{tmp}/karate.csv", "--out", tmp], check=True)
    subprocess.run(["node", "scripts/build-nodeinfo.js", "--force", "--out", tmp], check=True)

    errors = []
    for file in ["publications.json", "nodeinfo.json"]:
        with open(f"{tmp}/{file}", encoding="utf8") as f:
            if "Karate" in f.read():
                errors.append((file, "plain-text names or titles", "none"))

    site = json.loads(subprocess.check_output(["node", "tests/site-metrics.js", tmp], encoding="utf8"))

nodes = {s["label"]: s for s in site["nodes"].values()}
site["nodes"] = {str(n): nodes[f"Karate, Member {n}"] for n in G}
errors += compare(G, site)

sys.exit(0 if report("karate through obfuscation", errors) else 1)
