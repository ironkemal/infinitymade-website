#!/bin/sh
# Explicit benchmark/build download; never imported by runtime code.
set -eu
BENCH_SETUP=${1:?Usage: sh setup-ner.sh /tmp/praxura-m4-ner-unique}
case "$BENCH_SETUP" in /tmp/praxura-m4-ner-*) ;; *) echo 'Setup path must be /tmp/praxura-m4-ner-*' >&2; exit 2;; esac
BENCH_SOURCE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
mkdir -p "$BENCH_SETUP/model"
cp "$BENCH_SOURCE/ner-package.json" "$BENCH_SETUP/package.json"
cp "$BENCH_SOURCE/ner-package-lock.json" "$BENCH_SETUP/package-lock.json"
(cd -P "$BENCH_SETUP" && npm ci --ignore-scripts)
python3 - "$BENCH_SOURCE/model-manifest.json" "$BENCH_SETUP/model" <<'PY'
import hashlib, json, pathlib, sys, urllib.request
manifest = json.loads(pathlib.Path(sys.argv[1]).read_text())
root = pathlib.Path(sys.argv[2])
for item in manifest['files']:
    path = root / item['file']
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != item['sha256']:
        url = 'https://huggingface.co/' + manifest['model'] + '/resolve/' + manifest['revision'] + '/' + item['file']
        urllib.request.urlretrieve(url, path)
    if path.stat().st_size != item['bytes'] or hashlib.sha256(path.read_bytes()).hexdigest() != item['sha256']:
        raise SystemExit('Asset hash mismatch: ' + item['file'])
print('All fixed-revision model hashes verified')
PY
echo "Offline benchmark: M4_MODEL_DIR=$BENCH_SETUP/model M4_TRANSFORMERS_ENTRY=$BENCH_SETUP/node_modules/@huggingface/transformers/dist/transformers.node.mjs node $BENCH_SOURCE/ner-test.mjs"
