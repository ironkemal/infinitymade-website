# ITSG Trust-Anchor-Zertifikate (§ 302 SGB V SECON)

Dieses Verzeichnis enthält die Vertrauensanker-Zertifikate (Trust Anchors) des ITSG Trust Centers
zur Prüfung der Empfänger-Verschlüsselungszertifikate der Datenannahmestellen (Krankenkassen)
gemäß GGT Anlage 16 (Security-Schnittstelle SECON, Kapitel 4.4 und 2.1).

## Inhalt
- `meta.json`: Metadaten (Quelle, Abrufdatum, Prüfer, Gültigkeitszeiträume, SHA-256-Fingerprints)
- `anchor-<sha256-8hex>.der`: Einzelne X.509-Zertifikate im binären DER-Format

## Befüllung
Die Dateien in diesem Verzeichnis werden über zwei autorisierte Wege befüllt (G7 — einheitlicher Code-Pfad):
1. **GitHub-Actions-Workflow** (`.github/workflows/itsg-trust-anchor-check.yml`):
   Läuft periodisch (wöchentlich montags) und gleicht die offizielle ITSG-Annahmeliste
   (`https://trustcenter-data.itsg.de/dale/annahme-rsa4096.key`) ab. Änderungen werden
   automatisch committet und über den Image-Build-Prozess an Installationen ausgeliefert.
2. **Manuelles CLI-Tool** (`tools/itsg-trust-anchor-laden.mjs`):
   Für Airgap-Installationen oder außerplanmäßige Schlüsselrotationen vor Ort.

## Referenzen
- Ops-Register: `onprem/REGISTER.md` Eintrag **O-116** (Muster B, lokale Frische-Prüfung)
- Quellenangabe: `onprem/NOTICE-QUELLEN.txt` Abschnitt 6
- Modul: `api-backend/billing/dta/itsg-trust-anchor.js`
- V4-Prüfung: `api-backend/billing/dta/empfaenger-zertifikat-pruefung.js`
