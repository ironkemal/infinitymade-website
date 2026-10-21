# Ops: Betreiber-Checklisten für lokal nicht abschließbare Karten (2026-10-21)

**Status: Dokumentation/Vorbereitung.** Nichts davon wurde live geprüft oder gesetzt. Keine
Ops-Häkchen. Keine Werte, Schlüssel oder Konten in diesem Dokument.

## #19 Stripe Tax / B2B Reverse Charge
- **Codebefund (lokal gelesen):** `api/stripe/create-checkout-session.js:83,142` setzt
  `automatic_tax: { enabled: false }`; `billing_address_collection: 'required'` (:82,:141).
  Es gibt keine Erhebung von Steuer-IDs (`tax_id_collection` fehlt). Stripe Tax ist im Code
  also **bewusst nicht aktiv**; Reverse-Charge-Logik existiert dort nicht.
- **Entscheidung nötig (Steuerberater, Ops #11):** Preise brutto/netto, Umsatzsteuer-Behandlung
  EU-B2B, ob Stripe Tax aktiviert wird. Ohne diese Entscheidung kein Codeeingriff
  (Preise sind ohnehin vorläufig, CLAUDE.md Stripe-Abschnitt).
- **Danach (Betreiber, Stripe-Panel):** Tax-Registrierung, Produkt-Steuercodes; erst dann
  `automatic_tax` + `tax_id_collection` mit Fake-Transport-Test (Muster `tools/stripe-url-contract.test.js`).

## #20 Stripe Radar
- Reine Panel-Konfiguration (Standardregeln, Blocklisten, 3DS-Anforderung). Kein Codepfad.
- Checkliste Betreiber: Radar-Regelliste einsehen; 3D-Secure-Verhalten für SEPA/Karte notieren;
  Test nur im Testmodus. Ergebnis als Datum + Screenshot-Hinweis in Ops-Karte, nicht im Repo.

## #23 Microsoft 365 DKIM
- Externer Schritt im M365-Admin-Center/DNS (CNAME-Einträge `selector1/selector2._domainkey`),
  danach DKIM-Toggle aktivieren. Kein lokaler Code-Ersatz.
- Hinweis aus `api-backend/lib/mail.js:4–5`: SaaS-Versand über eigenen Provider (SPF/DKIM passen);
  Kundenbox versendet bewusst nicht darüber (`onprem/REGISTER.md` O-51).
- Nachweis später: Testmail an ein eigenes Postfach, Header `dkim=pass`/`spf=pass`/`dmarc=pass`
  prüfen. Erst dann DMARC-Policy verschärfen (#40-Restpunkt).

## #8 / #31 / #150 IK-/P12-, Annahmebestätigung und Kassen-Test
- **Lokal belegt (heute ausgeführt):** `billing/dta/smoke.test.js`,
  `billing/api/empfaenger-pruefung.test.js`, `billing/api/uebermittlung.test.js`,
  `billing/api/podo-empfangsnachweis.routes.test.js` → **51/51 PASS**, synthetische Daten.
  Gesamtsuite Backend 1433/1433.
- **Nicht lokal prüfbar:** echtes ITSG-Zertifikat/P12, autorisierte Testpraxis, echte Annahme-
  bestätigung der Datenannahmestelle, Kassen-Testverfahren.
- **Abnahmeablauf (Betreiber, nur mit ausdrücklichem GO):**
  1. Testpraxis mit eigenem IK und Zertifikat (nie Kundenzertifikat) im Testverfahren.
  2. Synthetische Abrechnung → DTA-Entwurf erzeugen, Empfänger-Prüfung am Übermittlungstag
     (`canli-test/REGISTER.md`, Eintrag „Empfänger-Prüfung").
  3. Übermittlung nur an die Testannahmestelle; Annahmebestätigung ablegen.
  4. Ergebnis in `wissensbank`-/Ops-Karte mit Datum und Version (Anlage 1/3 TP5 V21).
- V22 gilt ab 01.02.2027 (Übergang bis 30.04.2027); Test vor diesem Datum mit V21.

## #30 / #29 Support-SLA / Mitarbeiterverpflichtung
- Antwortzeiten sind eine betriebliche Zusage, Verpflichtung ist Vertrags-/Unterschriftssache.
  Beides liegt außerhalb von Code. Vorbereitung: bestehende Texte in `index.html` (Support-
  Aussagen) und `compliance/LEGAL_DECISIONS.md` vor Veröffentlichung von `legal-de` gegenlesen
  lassen; keine Zahl (z. B. „24 h") ohne Betreiberentscheidung ergänzen.

## #125 / #242 Adminkonto / Testkonten
- Keine Konten anlegen oder löschen. Vor Bereinigung: Aufbewahrungspflicht (`aufbewahrung_sperre`,
  Auth-Nutzer werden banniert, nicht gelöscht — CLAUDE.md DSGVO-Abschnitt) und echte Nutzung
  prüfen; Prüfschritte nur mit synthetischen QA-Konten.
