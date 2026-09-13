# §302 Code Lists

## Files

- `anlage3_v22.js` — Schlüsselverzeichnis (codes for VKZ, Verordnungsart, Zuzahlung, Abrechnungscode B, Tarifbereich, etc.). Name says "V22" but content is identical under V21 (gültig) and V22 (ab 01.02.2027) — the only V21↔V22 difference in all of Anlage 3 is §8.1.5.1 Haushaltshilfe, which isn't Heilmittel and isn't in this file (verified 13.09.2026, O-80; see file header for detail). Source: `wissensbank/gemeinsam/302-tp5/Anlage_3_TP5_V21_20250919.txt`.
- `../../archive/kod/database_v12_billing_codes.sql` — alte DB-seed für `dta_schluessel`, archiviert. Tabelle wird von keinem Codepfad gelesen und ist bewusst NICHT in der Migrationskette (`db/REGISTER.md`) — Werte hier sind Referenz, nicht die Quelle der Wahrheit (die ist `anlage3_v22.js`).

## ⚠️ Missing: Heilmittel-Positionsnummern

Anlage 3 V22 §8.4 says position-number tables were **removed** from the Richtlinien-Anhang and are now maintained externally by GKV-Spitzenverband:

> "Bundeseinheitliches Heilmittelpositionsnummernverzeichnis"

**Source:** https://www.gkv-datenaustausch.de — search for "Heilmittelpositionsnummern" or "Positionsnummernverzeichnis Heilmittel".

The file is updated periodically. Positionsnummern are 5-digit (n5) and split by Heilmittel-Bereich:
- `1` = Physiotherapie (KG, MT, MLD, KG-ZNS, …)
- `2` = Podologie
- `3` = Stimm/Sprech/Sprach/Schluck
- `4` = Ergotherapie
- `5` = Ernährungstherapie

## ⚠️ Missing: Länderkennzeichen

Anlage 3 V22 §8.5 references Anlage 8 of "Gemeinsames Rundschreiben DEÜV" (external) — only needed for Auslandsversicherte.

## Sprint 3-4 TODO

1. Fetch Heilmittel-Positionsnummernverzeichnis from gkv-datenaustausch.de (CSV/XML)
2. ~~Seed into `heilmittel_tarif` table together with Preisvereinbarungen per Bundesland × KK~~ —
   **überholt (13.09.2026, O-96):** Anlage 2 §125 Physio hat keine Bundesland-Dimension,
   `heilmittel_tarif` wurde entfernt (gkv-302-Review, `billing/preise/resolver.js` Kopf).
   Preise kommen ausschließlich aus den Codedateien (`physio_positions.js`/`podologie_positions.js`).
3. Optional: Länderkennzeichen seed when Auslandsversicherte use-case becomes relevant
