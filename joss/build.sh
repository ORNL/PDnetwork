#!/bin/bash
# Build JOSS paper locally
# Requires: Pandoc 3.x, LuaLaTeX, latexmk
# Uses inara templates cloned to ~/inara

INARA="$HOME/inara"

# Locate a Pandoc 3.x binary.
# Note: PATH may resolve to an older bundled Pandoc (e.g. anaconda's 2.2.x),
# so we check known install locations first and validate the major version.
pandoc_major() {
  # Prints the major version number, or nothing if $1 isn't a working pandoc.
  [ -x "$1" ] || command -v "$1" >/dev/null 2>&1 || return 1
  "$1" --version 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+' | head -1 | cut -d. -f1
}

PANDOC=""
for candidate in \
  "$PANDOC_BIN" \
  "/c/Users/$USERNAME/AppData/Local/Pandoc/pandoc.exe" \
  "$LOCALAPPDATA/Pandoc/pandoc.exe" \
  "/c/Program Files/Pandoc/pandoc.exe" \
  "pandoc"; do
  [ -n "$candidate" ] || continue
  major=$(pandoc_major "$candidate")
  if [ -n "$major" ] && [ "$major" -ge 3 ] 2>/dev/null; then
    PANDOC="$candidate"
    break
  fi
done

if [ -z "$PANDOC" ]; then
  echo "[ERROR] No Pandoc 3.x found." >&2
  echo "        Install it (winget install --id JohnMacFarlane.Pandoc -e)" >&2
  echo "        or set PANDOC_BIN=/path/to/pandoc.exe before running." >&2
  exit 1
fi

echo "[INFO] Using $("$PANDOC" --version 2>/dev/null | head -1) at $PANDOC"

# Clone inara if missing
if [ ! -d "$INARA" ]; then
  echo "[INFO] Cloning inara templates..."
  git clone --depth=1 https://github.com/openjournals/inara.git "$INARA"
fi

# Generate footer.csl if missing
if [ ! -f "$INARA/resources/footer.csl" ]; then
  sed -e 's/et-al-use-first="[0-9]*"/et-al-use-first="1"/g' \
      -e 's/et-al-min="[0-9]*"/et-al-min="3"/g' \
      -e 's/et-al-use-last="true"/et-al-use-last="false"/g' \
      "$INARA/resources/apa.csl" > "$INARA/resources/footer.csl"
fi

# Copy footer.csl locally so Lua filters can find it
cp "$INARA/resources/footer.csl" ./footer.csl

INARA_ARTIFACTS_PATH=./ "$PANDOC" \
  --data-dir="$INARA/data" \
  --defaults=shared \
  --defaults=pdf.yaml \
  --defaults="$INARA/resources/joss/defaults.yaml" \
  --resource-path=".:$INARA/resources:$INARA/resources/joss" \
  --metadata=article-info-file="$INARA/resources/default-article-info.yaml" \
  --variable=joss \
  --output=paper.pdf \
  paper.md

# Clean up
rm -f footer.csl
