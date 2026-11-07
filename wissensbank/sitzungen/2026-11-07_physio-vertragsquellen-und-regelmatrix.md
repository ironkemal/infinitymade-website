# Physiotherapie — Originalquellen und Regelmatrix

Stand: 07.11.2026 · Quelle: öffentliche GKV-SV-Vertragsseite, unten. Beschaffung durch wissensbank/source_build. Diese Notiz ist eine Lesehilfe, keine Vertragsautorität oder externe Abnahme.

## Beschaffung und Veröffentlichung

Neun zuvor fehlende Original-PDFs aus aktueller Herausgeberliste lokal abgelegt, mit `pdftotext -enc UTF-8 -layout` deterministisch nach TXT extrahiert. TXT-Kopf nennt URL/Erzeugungsdatum; REGISTER W-17..W-25 enthält SHA256, URLs und Abschnittsweg. Keine numerische Tabelle durch KI in Produktcode/DB übernommen.

Originale und TXT bleiben lokal: PDF über `*.pdf`, TXT über exakt neue `.gitignore`-Einträge. `.vercelignore` sperrt gesamten Ordner. Weiterverbreitungsrecht nicht nachgewiesen; zuständig vor Veröffentlichung: legal-de. Neue Quellen benötigen keine neue Runtime-Abhängigkeit.

Herausgeberliste: https://www.gkv-spitzenverband.de/krankenversicherung/ambulante_leistungen/heilmittel/125_physio/125_physiotherapie.jsp (abgerufen07.11.2026).

## Quellenkurznamen

- **V125:** `physiotherapie/20220331_Vertrag__Lesefassung_Stand_04.04.2022_telemedizinische_Leistungen_Physiotherapie.txt`, Lesefassung04.04.2022, REGISTER W-17.
- **A3:** `physiotherapie/20241202_Lesefassung_Anlage_3a_gueltig_ab_01.12.2024_Physiotherapie.txt`, gültig01.12.2024, W-18. Zahnärzte separate Anlage3b W-19.
- **V125a:** `physiotherapie/20240830_Vertrag_nach__125a_SGB_V_Physiotherapie.txt`, i.d.F.01.11.2024, W-20.
- **Blanko:** Anlage1 W-21; Diagnosenanhang gültig01.01.2026 W-22; Vergütungsanlage gültig01.01.2026 W-23; Anlage3a W-24; Wiederaufnahme-AnhangA W-25. Vollständige Pfade/URLs im REGISTER.

## Regel → Code → Sollfall → Nachweis

Zeilen beziehen sich auf TXT einschließlich dreizeiligem Quellenkopf. Umsetzung/Freigabe der Interpretation: gkv-302 und Implementierer; wissensbank weist Quellen nach.

| Regel/Profil | Originalfundstelle | Bestehender Codebezug | Unabhängiger Sollfall/Nachweis |
|---|---|---|---|
| Standard: Beginn grundsätzlich binnen28 Kalendertagen, dringlich binnen14 | V125 §6(3–4), Z.515–539 | `billing/dta/preflight.js`, bestehende `ai/validators/standardRules.js` | Tag28/29 bzw.14/15, Ausstellungsdatum und Aufnahmedatum als echte Kalenderdaten; keine freie Fristverlängerung |
| Entlassmanagement: Bezug auf Entlassung, Beginn binnen7, Abschluss binnen12 Kalendertagen | V125 §7(4), Z.608–618; A3 Z.59–73 | Verordnungsmerkmale bis ZHE und Abrechnungsgate verfolgen | Fehlendes Entlassdatum sperrt dieses Profil; Tag7/8 und12/13 gegen ursprüngliche HeilM-RL prüfen |
| Standard: Gültigkeit3 Monate bei bis6 Einheiten,6 Monate bei mehr6 | V125 §7(3a), Z.571–580 | verfahrensabhängiges Abrechnungsgate | 6/7 verordnete Einheiten; Kalendermonat statt90/180-Tage-Näherung, Monatsende gesondert prüfen |
| Standardpause über14 Tage: Ausnahmen T/K/F dokumentierbar | V125 §7(3a), Z.584–605 | bisher pauschale Pause in `preflight.js` | gleicher Abstand mit/ohne dokumentierten zulässigen Grund; Behandler beurteilt Therapieziel |
| Zuzahlung: tatsächlicher Leistungszeitpunkt; gültiger Befreiungsnachweis kann Verordnungsstatus übersteuern | V125 §8(1–4), Z.746–774 | `billing/zuzahlung/calculator.js`, DTA- und Druckpfad | Geburtstag und Befreiungsbeginn zwischen zwei Leistungen; Jahreswechsel verlangt erneute Bescheinigungsprüfung |
| Verordnungsblattgebühr richtet sich nach erstem Behandlungstag | V125 §8(4), Z.770–782 | bisher Referenzdatum letzte Sitzung prüfen | Patient am ersten Tag minderjährig, später18; Prozentbetrag und Blattgebühr unabhängig ableiten |
| Blanko: Gültigkeit16 Wochen; Unterbrechung verlängert Frist nicht und benötigt keine14-Tage-Begründung | V125a §2, Z.118–149 | `ai/validators/blankoRules.js`, `billing/dta/preflight.js` | lange Pause innerhalb16 Wochen zulässig; Leistung außerhalb Gültigkeit sperrt |
| Blanko: Wiederaufnahme nach bereits abgerechneter Beendigung bei Rezidiv | V125a §2(4–5), Z.150–159; AnhangA Z.24–34 | VKZ10 in `billing/codes/anlage3_v22.js` bereits vorhanden | Wiederaufnahme mit Originalbezug,16-Wochen-Grenze und AnhangA; keine zweite vollständige Ursprungsabrechnung |
| Blanko: Verordnungsart05 und eigener Vertrags-LEGS | V125a §2(5), Z.154–159; Vergütungsanlage W-23 Z.33–36 | `billing/dta/zhe-kennzeichen.js`, `billing/codes/legs.js` | ZHE05 und LEGS2200502 aus gespeichertem Blankomerkmal, kein Standardtarif |
| Blanko: Preise und Leistungsarten aus eigener Vergütungsanlage | W-23 TeilA/B, gültig01.01.2026 | `billing/preise/resolver.js`, Katalogpfad | Preisfenstergrenze, Diagnose/Bedarfsdiagnostik/Pauschale und Ampelregeln gegen Original; vollständiger unabhängiger Preisabgleich noch offen |
| LHB/BVB | vorhandene HeilM-RL und KBV-Diagnoseliste in `gemeinsam/heilmittel-richtlinie/`; INDEX-Einträge | `ai/validators/lhbBvbRules.js` | keine automatische Übertragung von Standard-Mengenlimits; aktuelle Diagnosen-/Alters-/Fristvorgaben durch gkv-302 bestätigen |

## Präzise offene Nachweise

- **Preis-/Diagnosetabellen:** Beschafft und deterministisch als TXT lesbar, aber noch kein vollständiger maschineller Vergleich gegen Laufzeitkatalog. Eigentümer: Implementierer mit gkv-302; Freigabe vor produktiver Blankotaxierung.
- **Aktualität gemeinsamer HeilM-RL/Diagnoseliste:** bestehende Quellen wurden nicht neu heruntergeladen; heutiger Publisher-Abgleich je fachlichem Release bleibt Aufgabe wissensbank/gkv-302. Aktuelle Vertragsveröffentlichung allein beweist keine spätere Richtlinienänderung.
- **Zahnärztliches Profil:** Original W-19 vorhanden; dessen vollständige Fachprüfung ist durch Ärzte-Anlage3a nicht ersetzt.
- **DAS-Profil:** weiterhin unbenannt. Kein pauschaler CONTRL-/APERAK-Decoder aus Quellenbeschaffung abgeleitet; konkrete Spezifikation und externes Testverfahren fehlen.
- **Weiterverbreitung:** Rohdateien lokal geschützt; keine Veröffentlichung ohne Rechtsklärung. Metadaten und eigene Quellenmatrix dürfen versioniert werden.

Die Quellenbeschaffung schließt den dokumentierten Archivmangel. Sie bestätigt keine implementierte Vollständigkeit, Vergütungsberechtigung oder DAS-Annahme.
