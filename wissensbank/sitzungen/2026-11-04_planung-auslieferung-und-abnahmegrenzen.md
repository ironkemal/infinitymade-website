---
titel: Planung ausgeliefert, verbleibende Abnahmegrenzen
typ: sitzung
angelegt: 2026-11-04
tags: [planung, urlaub, release, qa, onprem]
---

# Aktueller Originalnachweis

Eigene Sitzungsnotiz, keine externe Fachquelle. Ergänzt [[2026-11-04_planung-urlaub-utc-abschluss]]. Stand der Messung: 04.11.2026, etwa 22:05 UTC.

## Auslieferung bestätigt

- GitHub-Commitstatus von `b2cbaebeaf885431623cd05ac9f29621d61da295`: Vercel `infinitymade-website` meldet „Deployment has completed“. Zweites Projekt `infinitymade-website-q9nm` meldet „Canceled by Ignored Build Step“; kein zweiter erfolgreicher Build behauptet.
- Deployment: https://vercel.com/ironkemal1-8589s-projects/infinitymade-website/HCM9cAgbRLc6mAJ3GfPKHA6N4HgS
- Öffentliche `https://app.praxura.de/dashboard.js` per curl abgerufen; SHA256 `382377ab7d69ce50ded50740c2ff5db58fb06dc650d9482f27b539d4d7e32575`, identisch zur lokalen Datei.
- Öffentliche `dashboard.html`: SHA256 `2cd578c9f99ca46fc7f9bb404c494ca3a0ec9f857adf8149447db73651597bf1`, ebenfalls identisch.
- `git diff b2cbaebe..da880dec --stat` enthält ausschließlich Dokumentation. `34967a60` ist Wissensdokumentation, kein weiterer Produktfix. UTC-Fix `82cc6189` ist damit öffentlich ausgeliefert; frühere Aussage „nur lokal“ ist historisch.
- GitHub-Images für Backend und Frontend bei `b2cbaebe` erfolgreich: Runs `41785328171` und `41785328072`. Imagebau beweist keine laufende installierte Box und keine Backend-Liveversion.

## Noch fehlender tiefer Nachweis

Zwei unabhängige lokale Spezialisten prüften Quellen, ohne Suiten oder Liveaktionen zu wiederholen. Grundlage: `Physio/URLAUB-UTC-NACHWEIS.md`, `Physio/ABNAHME-RESTSTAND.md`, `canli-test/REGISTER.md`, `tools/box-standort-abnahme.md`, On-Prem-Installationshandbuch und Imageworkflows.

1. Urlaub: pro echtem Browserwriter einen eigenen Grenztag speichern, tatsächlichen HTTP-Payload und Rückgabe vergleichen, neu laden und Kalender sowie Inhaber-/Mitarbeitersaldo prüfen. Isolierte PG-Tests ersetzen diesen PostgREST-/RLS-Nachweis nicht. Teilzeit-Jahreswechsel mit unabhängig berechneten erwarteten Arbeitstagen; Datumsspanne ausdrücklich protokollieren.
2. Standort: vorhandene QA-Konfiguration verwenden, Wochenversion und Einzeltag sowie Rückwechsel prüfen. Vorhandene Raumprobe nicht pauschal wiederholen; ungeklärten 09:00-Konflikt aus Belegung/Kapazität erklären. Siehe Live-Register, letzter Nord-Seriennachweis.
3. Rechte: zugehörige autorisierte QA-Mitarbeitersitzung; eigene Daten nur lesend, Fremdmandantenzugriff tatsächlich abgelehnt. UI-Filter allein genügen nicht.
4. Box zuletzt: bestätigter eigener Hetzner-QA-Server, versionierte Images/Installer, synthetischer Owner/Mitarbeiter und zwei Standorte; Speichern/Lesen, Rechte, TLS, Readiness, Neustart/Persistenz und Backup/Restore prüfen. Kein Installer auf unbekanntem Ziel ausführen.

## Tatsächliche Zugangsgrenzen und Zuständigkeit

Browserprüfung in neuem eigenen Preview-Tab: `dashboard.html` leitete zu `login.html` um. Verfügbare Profile nur Default/Incognito, keine bestätigte angemeldete Physio-QA-Sitzung. Tab anschließend geschlossen. Keine Kontodaten gelesen oder verändert; Janik/Yannik nicht verwendet. Für Live-Abnahme angemeldete separate QA-Inhaber- und Mitarbeitersitzung erforderlich.

Konkrete Hetzner-Zielserver-ID/IP und Ausgangsinstallation noch nicht bestätigt. Nutzer um Zielangabe gebeten; keine kostenpflichtige Bestellung, Installation oder Migration ausgeführt.

Mail/KI-Abnahme exklusiv beim anderen Bearbeiter: bearbeitbarer KI-Mailentwurf, Fußzeile speichern und Vorschau; kein Versand. Keine parallelen Mailänderungen/-tests hier. Migration0105 nicht automatisch angewandt. Keine neue Suite, keine DB-Schreibaktion, kein Mailversand in diesem Nachweislauf.
