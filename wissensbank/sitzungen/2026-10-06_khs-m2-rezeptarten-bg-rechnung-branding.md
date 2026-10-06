---
titel: KHS M2 — Rezeptarten, BG, Rechnung, Branding (Bau, Fachklärung, Live-Test)
typ: sitzung
angelegt: 2026-10-06
tags: [sitzung, khs, m2, bg, rechnung, branding, gobd, live-test, rezeptart]
status: ✅* abgenommen 06.10.2026 mit Einschränkungen E1–E5 (siehe unten)
---

# KHS M2 — Rezeptarten, BG, Rechnung, Branding

> ⚠️ Keine Quelle, sondern Arbeitsnotiz (siehe [[SITZUNGEN]]). Maßgeblich bleiben Original + Abschnitt + Fassung
> ([[REGISTER]], [[SPEC-RULES]]). Repo ist PUBLIC: keine Namen, keine Zugangsdaten. Testdaten sind synthetisch.
> Tagesprotokoll: `fortschritte/2026-10-05.md` (Abschnitte „M2 gestartet“, „M2 gebaut“, „M2 Abschluss“),
> Entscheidungen: `Podoloji/PRODUKT-ENTSCHEIDUNGEN.md` PE-006 (+ Nachtrag), `compliance/LEGAL_DECISIONS.md`
> (Einträge 2026-10-05 und 2026-10-06), BG-Abgrenzung in [[SPEC-RULES]].

## Auftrag
Sprint-Stufe M2 (`KUTU_HAZIRLIK_SPRINT.md` §4, Plan `KHS_M2_PLAN.md`): Verordnungsart-Umschalter, BG, Selbstzahler/Privat-Kette,
Branding + Stempel, Assistent-Schritt, Fortschrittsring, Anzeigename 78020, Praxis-Datenschutztext.
Baseline vorher: `npm test` 1593 / 929 / 98. Am Ende: 1712 / 982 / 142, alle grün, `npm run probe` grün.

## Phase 1 — Fachklärung (gkv-302, podoloji, legal-de, db-ustasi, guvenlik)
- **BG (K-8/K-10, Pflicht):** BG läuft nie über §302/DTA (Unfallkennzeichen `1` unbenutzt, Muster-13-Kreuz „Unfallfolgen/BVG“ ist
  GKV-Feld, kein BG-Fall). Für Podologie wurde **kein DGUV-Vertrag** gefunden (Negativbefund, nicht verifiziert); Behandlung nur mit
  Kostenzusage im Einzelfall. Gebaut nur belegte Angaben: UV-Träger (Name+Anschrift = Rechnungsempfänger), Unfalltag, Aktenzeichen
  (optional, Freitext, kein Format), Kostenzusage (Datum/Zeichen), Einverständnis (Datum + Wortlaut-Version, § 100 SGB X / § 203 StGB).
  Pflicht erst beim Rechnungserstellen (Träger, Anschrift, Unfalltag); beim Speichern nur Hinweise („warnen, nicht blockieren“).
  Keine Diagnose, keine festen Preise, keine Unfallmeldung auf der BG-Rechnung.
- **Stempel:** rechtlich optional; privater Bucket, nie unter öffentlicher URL, beim Beleg als Data-URL eingebettet.
- **Praxis-Datenschutztext:** Fundort `module/einwilligung-texte.js`; v3 mit Betrieb (Box/SaaS), Empfängern, Pflicht zur Bereitstellung;
  KI-Absatz (Microsoft als Empfänger) vorbereitet, aber `kiAktiv=false` bis K-20/M4.11.
- **Rechnungs-Pflichtangaben (F7):** Pflicht = Name, Anschrift, Inhaber, Steuernummer oder USt-IdNr., Steuerhinweis; Soll = Bank, Telefon, IK.
- **CHECK „Kasse ⇒ Diagnosegruppe“ bewusst nicht gesetzt:** fachlich überall Pflicht (HeilM-RL § 13 Abs. 2 j), aber ein CHECK greift beim INSERT
  und könnte Entwürfe blockieren; die harte Prüfung gehört in die Freigabe/den Preflight.

## Gebaut (Commits)
M2.1 `8967ecc` · M2.2 `81698a6` `d2da247` · M2.3 `6757809` · M2.7 `09266f3` · M2.4 `e14697a` · M2.5 `9726ebc` · M2.6 `329fc99` · M2.8 `bfae06f` ·
Gegenlesung `2a3e6ba` `0cf0975` · Live-Test-Fixes `21a8636` `688f764` `d2866d8` `f3f910f` · Abschluss `7f56065` `c6d0060`.
Migrationen (alle SaaS angewandt): **0067** rezeptart-CHECK +bg · **0068** `prescriptions.bg_*` + `invoices_invoice_type_check` +bg ·
**0069** privater Bucket `praxis-stempel`, `profiles.praxis_stempel_path`/`praxis_inhaber` · **0070** `invoice_festschreibung()` sperrt +7
Pflichtangaben, `bg_einverstaendnis_version` · **0071** kein Zurücksetzen ausgestellter Rechnungen auf `draft`, kein Browser-DELETE,
`rezeptart`/`bg_*` für Browser-Rollen unveränderlich. Alle Zähler per README Kural 6 „dritter Weg“ nachgerechnet; **O-170:** der Zähler
`storage_bucket` zählt ohne Schemafilter → 5 → 6.

## Lernpunkte (das, was man nicht aus dem Code liest)
1. **`server.js` speicherte `nagel`/`behandlungsanlass` seit dem Server-Umzug (06.09.) nicht** — NULL war Normalfall für `rezeptart`. M2.1 musste
   Backend + Maske anfassen, nicht nur die Maske.
2. **Zwei Rechnungswege bauen Zeilen aus Behandlungen:** Knopf „Rechnung“ (`rechnung-bruecke.js`) und Verordnung-anhaken im Editor
   (`rechnung-verordnung.js`). Eine Korrektur nur an einem Weg wirkt nicht (G1 im Live-Test). Jetzt gemeinsame Texte (`rechnung-anzeige.js`)
   und gleicher Preisweg (Privat/Selbstzahler/BG: Preis aus der eigenen Leistung, nie GKV-Preis; Kasse behält Katalogpreis).
3. **Felder, die später erzeugt werden, kann man beim Befüllen nicht setzen** (F2, Datenverlust): Behandlungsanlass/Nagel entstehen erst im nächsten
   Durchlauf der Podo-Automatik; beim ersten Öffnen nach dem Seitenstart blieb das Feld leer und das nächste Speichern überschrieb den Wert mit
   dem Standardtext. Fix: Felder vor dem Befüllen anlegen. **Immer hart neu laden** — ein offener Tab hält alte Module (ein Fehlalarm war genau das).
4. **Selbstzahler-Betrag war falsch:** die versteckten Standardwerte 10 % + 10 € wurden abgezogen; Editor zeigte bei Privat/BG „Zu zahlen 0,00 €“.
   Eine Rechenstelle `module/rechnung-summen.js` für Editor und Speichern.
5. **Browser-Schreibrechte sind der Umgehungsweg:** Backend-409 bei festgeschriebener Rechnung nützt nichts, wenn `prescriptions_owner_all` das direkte
   UPDATE per PostgREST erlaubt → 0071. `invoices` hatte zusätzlich Rücksetzen auf `draft` und DELETE (guvenlik S-50/S-51).
6. **Mitarbeiter-Profil ist leer:** Belege lasen `currentProfile`; für Mitarbeiter war der Praxiskopf leer. Jetzt `ownerProfile || currentProfile` mit
   Spaltenliste `BRANDING_SPALTEN` (keine Stripe-/Plan-Spalten). `ownerProfile` lud für Mitarbeiter bisher nur 4 Spalten.
7. **Eine Handwahl sperrt die Vorauswahl nur, wenn sie von „Kasse“ abweicht** (Pfeiltasten hin/zurück zählten fälschlich als Wahl, N2-a).
8. **`git pull --rebase` bricht bei fremden unstaged Dateien ab** → `--autostash`; generierte Dateien (`funktionen/INDEX.*`) beim Konflikt neu erzeugen,
   nie von Hand mergen; `dashboard.js` darf nicht wachsen (Baseline sinkt mechanisch).
9. **`zsh` zerlegt `$F` nicht** → für Dateilisten `bash -c`; macOS-`sed -i ''`; sed-Versions-Bump kann Teilstrings treffen (`abrechnung-ansicht` vs
   `rechnung-ansicht`) — der Modulgraph-Test fängt das.

## Live-Abnahme (Claude in Chrome, QA-Praxis, nur synthetische Daten)
- **Lauf 1:** Bedienung, Sperren, Regression. Befunde F1–F10: 🔴 F2 (Behandlungsanlass geht verloren) · 🟠 F4/F6 (Summen/Kassenwortlaut je Zahler),
  F3 (Zeilenname), F1 (Vorauswahl) · 🟡 F7 (Liste kennt BG nicht), F9 (Kassenregeln bei BG), F10 (Button-Layout). F5/F8 = Testdaten.
- **Lauf 2 (Nachtest):** N2-a (Vorauswahl), N3-a (Zeilenname), N5-a (Kassen-Pflichten/Zuzahlung bei Privat/BG) → behoben.
- **Lauf 3 (Mini-Nachtest):** G1 — der Verordnungs-Editor nahm weiter den GKV-Titel und hakte schon berechnete Behandlungen vor → behoben.
- **G1-Wiederholung:** erste Meldung H1 stammte aus einem alten Tab (kein Neuladen); im frischen Inhaber-Tab bestätigt: keine berechneten Behandlungen mehr wählbar.
- **Nicht live prüfbar / ungeprüft:** neuer Zeilenname + Privat-Preis (keine offene Behandlung mehr), Handy-Breite 390 px, Netzwerkstatus ≥ 400,
  Setup-Schritt (SaaS hat kein `SETUP_TOKEN`; Test + Probe belegt).

## Offen (Einschränkungen und Ableitungen)
- **E1** Zeilenname/Preis nur per Unit-Test · **E2** Teil C durch Melih (Stempel-Upload/Entfernen, Mitarbeiter-Login) · **E3** Setup-Schritt in K3 (Box) ·
  **E4** Handy-Breite · **E5** Release-Bump `VERSION` 0.4.0 → **0.5.0 (MINOR)** + `onprem/manifest.json` im selben Commit (nicht gemacht, Release-Sache).
- GoBD (legal-de): Praxisname/Anschrift/Bank auf dem gedruckten Beleg werden **live** aus dem Profil gelesen, nicht festgehalten; BG-Empfänger live aus
  `prescriptions.bg_*` (geschützt durch 409 + Browser-Sperre 0071). Risikoakzeptanz „Einverständnis fehlt, trotzdem Rechnung“ wird nicht protokolliert.
- Stempel steht in der Rechnungsansicht, **nicht** im Backend-PDF. `{{saas_hosting_satz}}` und DSB-Feld im Datenschutztext offen.
- Einstellungen schreiben Praxisdaten ohne Formatprüfung und in die Zeile des angemeldeten Nutzers (fonksiyon-ustasi); `avatars` ohne MIME/Größe (S-48);
  Logo-URL jeder https-Host (S-49). Physio-Pfad `/abrechnung/create` hat jetzt den rezeptart-Guard.
- Ops #209 („Podologische Behandlung groß“) wartet auf Beta-1: Kalender, Auswahlliste oder Rechnung? Interne Verordnungs-ID steht in den
  Rechnungsnotizen (alt, nicht M2). „Neue Rechnung“ ohne Verordnung schlägt „Kosmetisch / 19 %“ vor (gewollt, kein Anker → kein Befreiungsvorschlag).
- Browser schreibt `invoices` weiter direkt (Policy FOR ALL); die Sperren schützen nur **ausgestellte** Rechnungen.

## Weiter
M3 (lokales PDF417): Prompt in `KUTU_HAZIRLIK_SPRINT.md` §6; vorher `wissensbank`-Agent nach KBV-BFB/PDF417-Beleg fragen.
Live-Abnahme-Prompts und Seed: `fortschritte/2026-10-06_M2_LIVE_ABNAHME.md`.
