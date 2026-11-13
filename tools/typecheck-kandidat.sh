#!/bin/sh
# Prüft einzelne Kandidaten-Dateien mit den exakten Einstellungen aus jsconfig.json,
# ohne den TS5042-Fehler (`tsc -p jsconfig.json <datei>`) auszulösen.
# Verwendung: sh tools/typecheck-kandidat.sh <datei.js> [<weitere.js> ...]

set -e

if [ "$#" -eq 0 ]; then
  echo "Verwendung: sh tools/typecheck-kandidat.sh <datei.js> [<weitere.js> ...]" >&2
  exit 2
fi

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
base_cfg="$repo_root/jsconfig.json"
tmp_cfg=$(node -e '
  const fs = require("fs");
  const path = require("path");
  const crypto = require("crypto");
  const p = path.join(process.argv[1], ".typecheck-kandidat." + process.pid + "." + crypto.randomBytes(4).toString("hex") + ".json");
  fs.writeFileSync(p, "", { flag: "wx" });
  process.stdout.write(p);
' "$repo_root")
cleanup() {
  rm -f "$tmp_cfg"
}
trap cleanup EXIT INT TERM

node -e '
  const fs = require("node:fs");
  const basePath = process.argv[1];
  const outPath = process.argv[2];
  const extras = process.argv.slice(3);
  const cfg = JSON.parse(fs.readFileSync(basePath, "utf8"));
  const merged = new Set([...(cfg.include || []), ...extras]);
  cfg.include = Array.from(merged);
  fs.writeFileSync(outPath, JSON.stringify(cfg, null, 2));
' "$base_cfg" "$tmp_cfg" "$@"

cd "$repo_root"
npx --no-install tsc -p "$tmp_cfg"
