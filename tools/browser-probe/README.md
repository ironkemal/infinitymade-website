# Browser-Proben

Drei kleine Prüfungen, die im **echten Browser** laufen und **keinen Login**
brauchen. Sie schliessen die Lücke zwischen den Modultests (`node --test`, die
kein DOM kennen) und einem vollen Klickdurchgang durch die Anwendung.

Sie sind nicht dekorativ: am 25.08.2026 hat `render-probe` einen Fehler
gefunden, der sonst ausgeliefert worden wäre — das Kontextmenü ging auf und im
selben Wimpernschlag wieder zu, sobald die Seite gescrollt war.

## Starten

```sh
node dev_server.cjs &                      # Port 8081
node tools/browser-probe/layout-probe.mjs
node tools/browser-probe/modul-probe.mjs
node tools/browser-probe/render-probe.mjs
```

Voraussetzung einmalig: `npm i -D playwright && npx playwright install chromium --only-shell`.
Ein Login oder `.env.local` wird **nicht** gebraucht — die Proben laden nur
`dashboard.css` und die Module.

## Was jede Probe prüft

| Datei | Frage |
|---|---|
| `layout-probe` | Stimmt die Geometrie? Zeitleiste und Tagesspalten gleich hoch (Woche 28 px, Tag 56 px, Kopfzeile 44 px), Leistungsliste ist kein CSS-Grid, Kontextmenü ist `fixed`. Bestätigt ausserdem den bekannten Kompaktmodus-Fehler. |
| `modul-probe` | Laden **alle** in `dashboard.js` importierten Module im Browser? Findet Tippfehler in Pfaden und im `?v=`-Anhängsel, die sonst erst beim Nutzer auffallen. |
| `render-probe` | Zeichnen Wochenansicht, Monatsansicht, Leistungstabelle und GKV-Katalog richtig, und lösen Klicks die erwarteten Rückrufe aus? Nutzt erfundene Daten und einen Ersatz für `supabase`. |

## Grenzen

Was hier **nicht** geprüft wird: alles, was einen angemeldeten Nutzer und echte
Daten braucht — Speichern, Abrechnung, Verordnungen, Rechte. Dafür gibt es
`.plans/BROWSER-TEST-PROMPT.md` und einen Menschen.

Die Proben enthalten ausschliesslich erfundene Daten. Es gehört kein
Patientendatensatz und kein Schlüssel in diesen Ordner.
