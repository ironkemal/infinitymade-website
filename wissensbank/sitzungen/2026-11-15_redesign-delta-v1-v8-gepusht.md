---
titel: Redesign v2 — Delta-Lauf V1.07 bis V8.05 + V7.01p/V7.03p auf main gepusht
typ: sitzung
angelegt: 2026-11-15
tags: [sitzung, redesign, physio, podologie, rechte, zuzahlung]
---

# Redesign v2 — Delta-Lauf 12.–15.11.2026 (gepusht, neues Design weiter aus)

Worktree `redesign-delta-20261112`, Branch `redesign/delta-20261112`, direkt nach `main` gepusht (jeweils mit Melih-GO).
Führende Quelle für Pakete, Nachweise und offene Fragen: **`redesign/STATUS.md`** (nicht diese Notiz).

## Was live ist (Code auf `main`, Vercel)
- Pushes: `81c82424..c5251175` (13.11.), `c5251175..3d4bed76`, `3d4bed76..54911375` (14.11.), `54911375..aeb7a34d`, `aeb7a34d..5d91d464` (15.11.).
- **Neues Design bleibt aus:** sichtbar nur unter `data-design="neu"`, im SaaS nur über `GET /api/design/entscheidung` (Env-Pilot nirgends gesetzt, onprem O-245). Box bleibt Alt.
- Pakete (nur neues Design): App-Shell + Nav-Gruppen (V2), Handy-Suche (V2.12b), Inhaber-Dokumentsuche (V2.09b), Startseite „Heute" mit Handlungsbedarf/Freie Zeit (V6.F), Bausteinkatalog + Probe (V3.01), Emoji-Filter mit Rückweg (V3.03), Abschnittsnavigation Einstellungen/Leistungen/Öffnungszeiten (V4.02p), Kalender-Abnahme (V5.05m), Akte-Knöpfe Anamnese/Notiz/Fußbefund (V7.02p), Fingerziele ≥ 44 px bis 1024 px (V8.05).
- **Wirken auch im alten Design (bewusst, Melih-GO):**
  - V6.B01 (14.11.): `/api/billing/statistik` nur Inhaber — vorher sahen Angestellte per API die Praxisfinanzen (guvenlik S-67). Live geprüft: Mitarbeiter-Testkonto bekommt 403 `NUR_INHABER`.
  - V7.01p (15.11., `499b7657`): Notizen-Panel folgt dem Recht `notes`; Anamnese-Liste nach Standort (`bizScope 'patients'`), Vorwahl nur aus dieser Liste.
  - V7.03p (15.11., `5d91d464`): Podologie-Folgetermin-Frage bekommt dritten Knopf „Zuzahlung kassieren (x €)" — nur bei offenem Betrag (`euroZustand` = kassieren, Stand belastbar) und Inhaber oder Recht `abrechnung`; vorhandener Kassierweg `kassiereZuzahlung`; sonst Dialog unverändert. Geldzeilen-Stand dafür an eine Stelle gezogen (`ladeKassierstand`, keine neue Rechnung).

## Warum so entschieden
- Delta auf `main` statt Rettungsbranch nachbauen (Melih 12.11.); Nav-Gruppen nur im neuen Design.
- V7.03p ursprünglich geparkt: alte Fassung hätte „Zuzahlungsstatus ungeklärt" auch bei bezahlt/befreit gezeigt und beim Öffnen geschrieben (gkv-302); podoloji schlug die kleinere Fassung vor → Melih 15.11. „ja", auch für Angestellte mit `abrechnung`.
- V7.01p: guvenlik (Register W-V701-1) — kein Sicherheitsfix (RLS trennt nur Praxen), aber Rechte-Konsistenz; ändert Alt → Melih-Entscheidung „ja".
- Fußbefund: 20 Checkboxen ohne Label (13 px) und Zehenknöpfe 26 px bleiben so (Melih „so lassen").

## Nachweise
`npm test` 2.962 / 2.077 (+5) / 355 / 109, 0 Fehler. Proben u. a. `v701-rechte` (Gegenprobe am alten Stand rot), `v702-akte`, `v703-abschluss` (echter Podologie-Speicherlauf in der Fixture: Knopf „13,61 €", Abbruch schreibt nichts), `v805-fingerziele` (390 px 800 → 80 Funde), `p02-rechte` 26/18 unverändert, Alt-Bilder ohne Layoutabweichung.

## Grenzen (ehrlich)
- Nicht live geprüft: echtes Kassieren, Mehrstandort-Mandant, Geräte/Screenreader.
- Zwei eigene Regelverstöße im Lauf dokumentiert (Cache-Nummer per `sed -i`, STATUS per Python statt Edit), Diffs geprüft.
- Vor der Folgetermin-Frage 3–4 zusätzliche Leseabfragen (Frage etwas später).

## Offen
V9 Schlussabnahme · V6.B-Rest (bereit-€, Kassenzahlungen, Woche/freie Zeit serverseitig) · V3.02 (erst mit Verbraucher) · Pilot-Aktivierung im Physio-Testkonto (GO + Tenant-ID nur serverseitig + SSH-Zugang zum SaaS-VPS fehlt) · `a387edbe` (O-246) im Haupt-Checkout lokal, nicht gepusht.
