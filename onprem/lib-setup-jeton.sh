#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  Praxura On-Premise — Einrichtungs-Jeton (K2b.7a, O-161 K2b.7, guvenlik S-50)
# ════════════════════════════════════════════════════════════════════════════
#
#  Erzeugt: 07.10.2026 · Auftrag K2b.7a (onprem/REGISTER.md O-161 K2b.7, guvenlik S-50)
#
#  Verwaltet den Einrichtungs-Jeton (SETUP_TOKEN) und dessen Gültigkeitsbeginn
#  (SETUP_TOKEN_SEIT): Ablauf-Zeitstempel, Neuausgabe und Hygiene (Jeton nach
#  Abschluss aus .env leeren). Das eigentliche Tor ist die Datenbank
#  (public.praxura_setup.abgeschlossen_am, Zeile id=1).
#
#  Keine Seiteneffekte beim Sourcen, kein Logging, nur Rückgabecodes und stdout.
#  set -euo pipefail-fest.
# ════════════════════════════════════════════════════════════════════════════

# Liest einen Schlüssel aus der .env-Datei (wie install.sh env_get)
_sj_env_lesen() {
  local k="${1:-}"
  awk -F= -v k="$k" '$1==k{sub(/^[^=]*=/,""); print; f=1} END{if(!f) print ""}' "${ENV_FILE:-.env}" 2>/dev/null || true
}

# Setzt einen Schlüssel in der .env-Datei atomar (wie install.sh set_env)
_sj_env_setzen() {
  local key="${1:-}"
  local wert="${2:-}"
  local env_f="${ENV_FILE:-.env}"
  local env_dir
  env_dir="$(dirname "$env_f")"
  [ -n "$env_dir" ] || env_dir="."
  export SET_ENV_VALUE="$wert"
  local key_vorhanden=0
  grep -q "^${key}=" "$env_f" 2>/dev/null && key_vorhanden=1 || true
  if [ "$key_vorhanden" -eq 1 ]; then
    local tmp
    tmp="$(mktemp -p "$env_dir")"
    awk -v k="$key" 'BEGIN{FS=OFS="="} $1==k{$0=k"="ENVIRON["SET_ENV_VALUE"]} {print}' "$env_f" > "$tmp"
    mv -f "$tmp" "$env_f"
  else
    printf '%s=%s\n' "$key" "$SET_ENV_VALUE" >> "$env_f"
  fi
  chmod 600 "$env_f" 2>/dev/null || true
  unset SET_ENV_VALUE
}

# Prüft den Einrichtungsstatus direkt in der Datenbank der Box.
# Gibt 'ja', 'nein' oder 'unbekannt' auf stdout aus; Rückgabecode ist immer 0.
# Nie über Caddy oder eine externe Adresse abfragen.
setup_abgeschlossen_lesen() {
  local db raw
  db="$(_sj_env_lesen POSTGRES_DB)"
  [ -n "$db" ] || db="postgres"
  raw="$(docker compose exec -T db psql -U postgres -d "$db" -tAc "SELECT CASE WHEN abgeschlossen_am IS NULL THEN 'nein' ELSE 'ja' END FROM public.praxura_setup WHERE id=1;" 2>/dev/null | tr -d '[:space:]' || true)"
  case "$raw" in
    ja|nein)
      printf '%s' "$raw"
      ;;
    *)
      printf 'unbekannt'
      ;;
  esac
  return 0
}

# Hygiene, KEIN Tor: Entfernt den Einrichtungs-Jeton aus .env nach Abschluss.
#
# (a) J4 von update.sh kollidiert nicht — .env.template hat SETUP_TOKEN= leer,
#     nach dem Leeren ist der Box-Wert gleich dem Template;
# (b) ein Rollback von update.sh (Schnappschuss) bringt den alten Jeton zurück —
#     harmlos, denn das Tor liegt in der DB (router.use-Kapı in
#     api-backend/setup/router.js gibt nach Abschluss 410), und der nächste
#     Lauf leert ihn wieder;
# (c) wenn SETUP_TOKEN leer ist, hängt server.js den Setup-Router gar nicht ein.
#
# Ablauf:
# - SETUP_TOKEN in .env leer -> stdout 'leer', return 0
# - setup_abgeschlossen_lesen:
#     ja        -> SETUP_TOKEN= und SETUP_TOKEN_SEIT= leeren, stdout 'geleert'
#     nein      -> nichts tun, stdout 'offen'
#     unbekannt -> nichts anfassen, stdout 'unbekannt'
# Rückgabecode ist immer 0.
setup_jeton_aufraeumen() {
  local token abg
  token="$(_sj_env_lesen SETUP_TOKEN)"
  if [ -z "$token" ]; then
    printf '%s' "leer"
    return 0
  fi

  abg="$(setup_abgeschlossen_lesen)"
  case "$abg" in
    ja)
      _sj_env_setzen "SETUP_TOKEN" ""
      _sj_env_setzen "SETUP_TOKEN_SEIT" ""
      printf '%s' "geleert"
      ;;
    nein)
      printf '%s' "offen"
      ;;
    *)
      printf '%s' "unbekannt"
      ;;
  esac
  return 0
}

# Erzeugt einen neuen Einrichtungs-Jeton (24 Bytes hex) und setzt SETUP_TOKEN
# sowie SETUP_TOKEN_SEIT (aktuelle Unix-Zeit).
# Gibt den neuen Jeton auf stdout aus (Aufrufer zeigt ihn mit reveal_once, nie im Log).
setup_jeton_neu() {
  local jeton seit
  jeton="$(openssl rand -hex 24)"
  seit="$(date +%s)"
  _sj_env_setzen "SETUP_TOKEN" "$jeton"
  _sj_env_setzen "SETUP_TOKEN_SEIT" "$seit"
  printf '%s' "$jeton"
  return 0
}
