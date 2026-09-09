# Browser-Proben

Kleine Prüfungen, die im **echten Browser** laufen und **keinen Login**
brauchen. Sie schliessen die Lücke zwischen den Modultests (`node --test`, die
kein DOM kennen) und einem vollen Klickdurchgang durch die Anwendung.

Sie sind nicht dekorativ: am 25.08.2026 hat `render-probe` einen Fehler
gefunden, der sonst ausgeliefert worden wäre — das Kontextmenü ging auf und im
selben Wimpernschlag wieder zu, sobald die Seite gescrollt war.

## Starten

```sh
node dev_server.cjs &                      # Port 8081
npm run probe
```

Voraussetzung einmalig: `npm i -D playwright && npx playwright install chromium --only-shell`.
Ein Login oder `.env.local` wird **nicht** gebraucht — die Proben laden nur
`dashboard.css` und die Module.

## Was jede Probe prüft

| Datei | Frage |
|---|---|
| `layout-probe` | Stimmt die Geometrie? Zeitleiste und Tagesspalten gleich hoch (Woche 28 px, Tag 56 px, Kopfzeile 44 px), Leistungsliste ist kein CSS-Grid, Kontextmenü ist `fixed`. Bestätigt ausserdem den bekannten Kompaktmodus-Fehler. |
| `modul-probe` | Laden **alle** in `dashboard.js` importierten Module im Browser? Findet Tippfehler in Pfaden und im `?v=`-Anhängsel, die sonst erst beim Nutzer auffallen. **Die Pfadliste steht fest in `modul-probe.html` — bei neuem Modul selbst eintragen, sie wird nicht aus dashboard.js abgeleitet.** |
| `render-probe` | Zeichnen Wochenansicht, Monatsansicht, Leistungstabelle und GKV-Katalog richtig, und lösen Klicks die erwarteten Rückrufe aus? Nutzt erfundene Daten und einen Ersatz für `supabase`. |
| `leistungen-probe` | Ist der „+"-Knopf der Terminmaske verdrahtet, erscheint der Vorschlagszeile, landet die Dauer da, wo der Speicherpfad sie liest? |
| `verordnung-maske-probe` | Die Muster-13-Maske (einziger Weg, eine Verordnung anzulegen) — Foto/Datei/Handeingabe. |
| `abrechnung-probe` | Rechnungen: schaltet der Liste/Editor/Ansicht-Umschalter in jedem Modus genau eine Fläche frei (Regressionstest für Ops-Meldung 09.09.2026), rendert die Liste korrekt mit/ohne Einträge? |
| `kassenbuch-probe` | Barverkauf-Modal: bleibt der Save-Knopf ohne gewählte Zahlart gesperrt (kein Default!), trägt der POST die richtige Zahlart, schließt das Modal und lädt die Liste neu (Redesign, Ops-Meldung 10.09.2026)? |

## Grenzen

Was hier **nicht** geprüft wird: alles, was einen angemeldeten Nutzer und echte
Daten braucht — Speichern, Abrechnung, Verordnungen, Rechte. Dafür gibt es
`.plans/BROWSER-TEST-PROMPT.md` und einen Menschen.

Die Proben enthalten ausschliesslich erfundene Daten. Es gehört kein
Patientendatensatz und kein Schlüssel in diesen Ordner.
