#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Praxura M1.1 Disposable Local PostgreSQL 16 Test Runner
# Runs migration and synthetic assertions inside an isolated ephemeral container
# ============================================================================

TASK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION="${TASK_DIR}/../../db/migrations/0058_abrechnung_zuzahlungsforderung.sql"

CONTAINER_NAME="praxura-m1-1-test-$(date +%s)-$RANDOM"

cleanup() {
  local exit_code=$?
  echo "[praxura-test] Cleaning up container ${CONTAINER_NAME}..."
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  exit "${exit_code}"
}
trap cleanup EXIT INT TERM

echo "[praxura-test] Launching disposable postgres:16 container: ${CONTAINER_NAME}"
docker run -d \
  --name "${CONTAINER_NAME}" \
  --network none \
  --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  postgres:16 >/dev/null

echo "[praxura-test] Waiting for PostgreSQL permanent readiness..."
for i in $(seq 1 100); do
  if docker logs "${CONTAINER_NAME}" 2>&1 | grep -q "PostgreSQL init process complete; ready for start up"; then
    if docker exec -i "${CONTAINER_NAME}" pg_isready -U postgres >/dev/null 2>&1; then
      break
    fi
  fi
  sleep 0.1
done

echo "[praxura-test] Step 1: Pre-migration synthetic schema setup..."
docker exec -i "${CONTAINER_NAME}" psql -U postgres -v ON_ERROR_STOP=1 < "${TASK_DIR}/zuzahlungsforderung.schema.probe.sql"

echo "[praxura-test] Step 2: Applying real migration "${MIGRATION}"..."
docker exec -i "${CONTAINER_NAME}" psql -U postgres -v ON_ERROR_STOP=1 < "${MIGRATION}"

# Load the existing production freeze function and trigger verbatim from baseline.
# This fixture already includes every column referenced by the original function.
python3 - "${TASK_DIR}/../../db/migrations/0000_baseline.sql" <<'PY_BASELINE' | docker exec -i "${CONTAINER_NAME}" psql -U postgres -v ON_ERROR_STOP=1
from pathlib import Path
import re
import sys
baseline = Path(sys.argv[1]).read_text()
functions = re.findall(
    r"^CREATE FUNCTION public\.fn_abrechnung_zeile_festschreibung\(\) RETURNS trigger\n.*?^end \$\$;",
    baseline, re.MULTILINE | re.DOTALL,
)
triggers = re.findall(
    r"^CREATE TRIGGER trg_abrechnung_zeile_festschreibung .*?;$",
    baseline, re.MULTILINE,
)
if len(functions) != 1 or len(triggers) != 1:
    raise SystemExit("Expected exactly one original freeze function and trigger in baseline")
print(functions[0])
print(triggers[0])
PY_BASELINE

echo "[praxura-test] Step 3: Running synthetic assertion test suite from "${TASK_DIR}/zuzahlungsforderung.schema.probe.sql"..."
docker exec -i "${CONTAINER_NAME}" psql -U postgres -v ON_ERROR_STOP=1 < "${TASK_DIR}/zuzahlungsforderung.schema.probe.sql"

echo "[praxura-test] SUCCESS: All test assertions passed flawlessly!"
