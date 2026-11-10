# Startreview und Korrekturen

Unabhängiger Quellreview von `67819716`: zwei P2-Befunde, lokal behoben.

1. `updateAnfragenBadge` publiziert jetzt Lade-/Erfolg-/Fehlerstatus und verifizierten offenen Count. Der vorhandene Pending-Lader akzeptiert nur erfolgreiche HTTP-Antwort mit Requestliste. Bestätigt-/Abgelehnt-Tabs überschreiben Pending-Count weiterhin nicht. Vor erstem erfolgreichem Pending-Laden bleibt Startanzeige bewusst Unknown; kein zusätzlicher Datenaufruf.
2. Startsnapshot speichert Berliner Quelltag. Minutentick nach Tageswechsel verwirft alte Anzeige und zeigt Ladefehler mit bestehender Wiederholaktion. Keine zusätzlichen Timer oder Abfragen. Wiederholaktion verwendet vorhandenes `loadTodayBookings()`.

Gezielte Regression: `REDESIGN_PORT=18108 rtk proxy node --test tools/browser-probe/p01-start-regressions.test.mjs` — 2/2 bestanden. Test 1 führt tatsächliche Loader-/Badgefunktionen mit synthetischen Antworten aus: Laden, zwei offene Anfragen, Null, HTTP-Fehler und fehlende Requestliste. Test 2 montiert tatsächliches Startmodul in isolierter Browser-DOM und überschreitet Berliner Mitternacht per virtueller Uhr; Vortagsname verschwindet, Fehlerzustand sichtbar. Netzwerkfences vor Seitenerstellung; keine echten Konten/Daten/Schreibzugriffe.

Weiter offen: gefüllter Employee-Fall, vollständige Blockerzählsemantik (`services.is_internal` fehlt im aktuellen Snapshot-Select), Finanzdatenbindung. Kein Gesamtabschluss, keine Live-Abnahme.
