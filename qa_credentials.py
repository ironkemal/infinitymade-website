"""Zugangsdaten fuer die QA-Skripte — aus der Umgebung, nie aus dem Code.

Hintergrund: bis 31.08.2026 standen E-Mail und Passwort eines echten Kontos
im Klartext in elf getrackten Skripten dieses (oeffentlichen) Repos.
Ops-Karte "Zugangsdaten im Klartext in getrackten QA-Skripten" (30.08.2026).

Benutzung im Skript:

    from qa_credentials import qa_login
    email, password = qa_login()

Werte kommen aus den Umgebungsvariablen — oder, falls dort nicht gesetzt,
aus `.env.local` im Repo-Wurzelverzeichnis (steht in .gitignore):

    PRAXURA_QA_EMAIL=...
    PRAXURA_QA_PASSWORD=...
    PRAXURA_QA_PASSWORD_FALLBACK=...   # optional, nur qa_visual_verify3.py

Fehlt ein Pflichtwert, bricht das Skript mit Hinweis ab — es laeuft NICHT
stillschweigend mit leeren Feldern weiter (das erzeugte frueher irrefuehrende
"Login fehlgeschlagen"-Reports).
"""

import os
import sys
from pathlib import Path

_ENV_FILE = Path(__file__).resolve().parent / ".env.local"
_cache = None


def _from_env_file():
    """`.env.local` einlesen. Kein python-dotenv — bewusst abhaengigkeitsfrei."""
    global _cache
    if _cache is not None:
        return _cache
    _cache = {}
    try:
        raw = _ENV_FILE.read_text(encoding="utf-8")
    except OSError:
        return _cache
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        _cache[key.strip()] = value.strip().strip('"').strip("'")
    return _cache


def get(name, default=None):
    """Wert aus der Umgebung, sonst aus .env.local, sonst `default`."""
    value = os.environ.get(name)
    if value:
        return value
    value = _from_env_file().get(name)
    return value if value else default


def require(name):
    """Wie get(), bricht aber mit klarer Meldung ab statt leer zurueckzugeben."""
    value = get(name)
    if not value:
        sys.exit(
            f"\n[ABBRUCH] Umgebungsvariable {name} ist nicht gesetzt.\n"
            f"  Setze sie in der Shell oder trage sie in {_ENV_FILE} ein:\n"
            f"      {name}=...\n"
            f"  Zugangsdaten gehoeren NICHT in den Quelltext - dieses Repo ist oeffentlich.\n"
        )
    return value


def qa_login():
    """(E-Mail, Passwort) des QA-Testkontos."""
    return require("PRAXURA_QA_EMAIL"), require("PRAXURA_QA_PASSWORD")
