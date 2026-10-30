# checks that the built site files are in the root folder

import os
import sys

files = ["index.html", "bundle.js", "favicon.ico", "papervisinfo.pdf"]

missing = [file for file in files if not os.path.isfile(file)]

if missing:
    sys.exit(f"FAIL\n{len(missing)} files are not in the root folder: {missing}")

print(f"PASS: {len(files)} files in the root folder")
