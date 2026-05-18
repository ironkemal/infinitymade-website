# §302 Code Lists

## Files

- `anlage3_v22.js` — Schlüsselverzeichnis (codes for VKZ, Verordnungsart, Zuzahlung, Abrechnungscode B, Tarifbereich, etc.) extracted from `handbücher/Anlage_3_TP5_V22_20260218.pdf`.
- `../../database_v12_billing_codes.sql` — DB seed for `dta_schluessel` table.

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
2. Seed into `heilmittel_tarif` table together with Preisvereinbarungen per Bundesland × KK
3. Optional: Länderkennzeichen seed when Auslandsversicherte use-case becomes relevant
