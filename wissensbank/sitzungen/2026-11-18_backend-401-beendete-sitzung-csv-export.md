---
titel: Backend-401 „Invalid token“ durch serverseitig beendete Sitzung, CSV-Export, Rechnung ohne Leistung
typ: sitzung
angelegt: 2026-11-18
tags: [sitzung, auth, supabase, zahlungsjournal, rechnung, branding]
---

# Backend-401 durch beendete Sitzung, CSV-Export, Rechnung ohne Leistung

## Problem
Live-Meldung 18.11.: alle Aufrufe an `n8n.infinitymade.de/api/*` antworteten `401 {"error":"Invalid token"}`
(Termin-Anfragen, Anwesenheit, Zahlungsjournal, Auswertungen, Mahnwesen, Mitarbeiter anlegen), obwohl
`expires_at` in der Zukunft lag und Supabase-REST 200 lieferte. Teils wurde das rohe JSON angezeigt.

## Befund (gemessen, nicht gelesen)
Mit dem QA-Physio-Konto nachgestellt:

| Aufruf | frische Sitzung | dieselbe Sitzung nach `logout?scope=local` |
|---|---|---|
| Supabase-REST (`/rest/v1/…`) | 200 | **200** — PostgREST prüft nur Signatur + Ablauf |
| `/auth/v1/user` | 200 | **403 `session_not_found`** |
| Backend (`supabase.auth.getUser(token)`) | 200 | **401 `Invalid token`** |
| Refresh-Token | — | **400 `refresh_token_not_found`** |

→ Ursache ist eine **serverseitig beendete Sitzung**, nicht Backend, n8n, JWT-Secret oder Header.
Wahrscheinlicher Auslöser: `supabase.auth.signOut()` hat in supabase-js v2 standardmäßig
`scope: 'global'` und beendet alle Geräte desselben Kontos (Abmelden in anderem Tab/Gerät/Testlauf).
Nicht bewiesen, welcher Abmeldevorgang es konkret war (keine Auth-Logs gelesen).

## Entscheidung
- Zentraler Wächter `module/api-sitzung.js` (`sitzungsWaechterInstallieren`): Backend-401 → einmal
  `auth.getUser()` → nur bei eindeutiger Ablehnung durch Supabase Hinweis + lokale Abmeldung + `login.html`.
  Netzwerk-/Dienstfehler gelten **nicht** als beendet. Keine Wiederholung, kein Umgehen der Prüfung.
- Abmelden jetzt `signOut({ scope: 'local' })` (Dashboard, Plan-Sperre, Kiosk). Beendet die eigene Sitzung
  serverseitig weiterhin, aber nicht die anderen Geräte. Verworfen: global behalten (genau das erzeugte
  den Fehler bei geteilten Konten Praxis-PC/Handy/Tablet).
- `fehlertextAus`/`apiFehlertext`: nie rohes JSON/HTML anzeigen; bekannte englische Backend-Texte → Deutsch.
- Termin-Anfragen: „Anmeldung beendet“ nur, wenn Supabase ablehnt (Wunsch Melih).

## Nebenfunde beim Live-Rundgang
- **CSV-Export im Zahlungsjournal seit 08.06.2026 kaputt:** Backend nimmt seit `f4a12669` (Sicherheit,
  JWT nicht in URL) nur noch den Header an, der Knopf schickte `?token=` per `window.open` → 401
  „Fehlender Token“. Ein Test hatte genau dieses Verhalten festgeschrieben. Jetzt `fetch` mit Header +
  Blob-Download. `?token=` wurde **nicht** wieder erlaubt.
- DATEV-Export 409 `DATEV_ANGABEN_FEHLEN` im QA-Konto ist korrekt (Berater-/Mandantennummer fehlen).
- „Kassenumsatz“: die Kachel zählt nur GKV-Kassenabrechnungen; die Barzahlung 12,96 € ist Belegtyp
  `rechnung`. Beschriftung jetzt „Akzeptierte Kassenabrechnungen (nur GKV)“.

## Rechnung / Branding
- `rechnungsSummen(…, { mitRezept })`: Zuzahlung nur mit GKV-Verordnung **und** ≥ 1 Leistung.
- `brandingAus`: Hausnummer ohne Straße wird nicht gedruckt.
- **Grenze:** schon gespeicherte Rechnungen behalten ihren eingefrorenen `aussteller_snapshot`
  (§ 147 AO). INV-2026-0003 zeigt weiter „1“, INV-2026-0004 hat `strasse = ""`. Nicht nachträglich ändern.

## Nachweis
- Commits `0e6552d1`, `daa56924` (gepusht), `dashboard.js?v=20261118s2` live.
- `npm test` grün (Frontend 3021, Backend 2226 + 7 bewusst, Tools 355, Merkez 109), Typprüfung grün, Probes 46/46.
- Playwright gegen Live-Supabase mit abgefangenem Backend-401: gültige Sitzung bleibt, beendete → Hinweis + Login.
- Live-Rundgang (lesend, keine Schreibaufrufe, 0 JS-Fehler): Anfragen 3 Tabs 200, Anwesenheit 01.–30.11. mit
  17.11. 16:47–16:48, Zahlungsjournal + CSV-Datei, Auswertungen 200, Mahnwesen 200, Neue Rechnung
  (ohne Verordnung mit Leistung 0,00 €; mit Verordnung 6,52 € + 10,00 € = 16,52 €).

## Offen
Vollständige Liste mit Zuständigkeiten: [[2026-11-11_offene-punkte-wiederaufnahme]] → „Nachtrag 18.11.2026“.
- Mitarbeiter anlegen/entfernen live nicht geschrieben (nur lesend geprüft); Bestätigung nennt den Namen (Code `dashboard.js` Entfernen-Dialog).
- Praxisstraße im QA-Konto ist leer — Datenpflege, kein Codefehler.

## Lernpunkte
- **„Supabase-REST 200“ beweist keine gültige Sitzung.** PostgREST prüft nur das JWT. Ob die Sitzung
  noch existiert, sagt nur `/auth/v1/user`. Diagnose künftig: frisches Token gegen das Backend testen,
  dann `/auth/v1/user` mit dem fraglichen Token.
- **`signOut()` ohne `scope` ist global.** Bei geteilten Praxis-Konten (PC, Handy, Kiosk-Tablet) wirft
  ein Abmelden alle anderen Geräte hinaus. Im Dashboard immer `{ scope: 'local' }`.
- **Ein grüner Test kann kaputtes Verhalten festschreiben.** `zahlungsjournal-laden.test.js` prüfte
  `window.open` mit `?token=`, nachdem das Backend genau das abgelehnt hatte. Tests für Knöpfe, die
  Backend-Routen aufrufen, sollen den Vertrag der Route prüfen (Header, Status), nicht die alte Umsetzung.
- **Live-Rundgang nach Push lohnt sich:** Der CSV-Fehler war fünf Monate unentdeckt und fiel nur beim
  echten Klick auf. Lesender Playwright-Rundgang (QA-Konto, keine Schreibaufrufe) dauert < 2 Minuten.
- **Eingefrorene Belege:** Branding-Korrekturen wirken nur auf neue Rechnungen (`aussteller_snapshot`).
