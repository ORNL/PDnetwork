# checks that the author IDs in publications and nodeinfo are compatible

import json
import sys

with open("src/publications.json", encoding="utf8") as f:
    papers = json.load(f)["ai"]
    
with open("src/nodeinfo.json", encoding="utf8") as f:
    nodes = set(json.load(f))

paperIDs = {str(author) for authors in papers.values() for author in authors}
errors = []

missingPapers = sorted(nodes - paperIDs, key=int)
if missingPapers:
    errors.append(f"{len(missingPapers)} nodeinfo.json IDs are not in publications.json: {missingPapers}")

missingNode = sorted(paperIDs - nodes, key=int)
if missingNode:
    errors.append(f"{len(missingNode)} publications.json IDs are not in nodeinfo.json: {missingNode}")

if errors:
    sys.exit("FAIL" + "\n" + "\n".join(errors))

print(f"PASS: {len(paperIDs)} ids match")
