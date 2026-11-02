# Standort-Abnahme: lokale synthetische Vorpruefung

```sh
node --test tools/box-standort-abnahme.test.js
```

Die Probe erzeugt je Lauf zwei **synthetische Teststandorte nur im Arbeitsspeicher**.
Sie ruft den vorhandenen `wireBusinessModal`-Submitpfad und `isEnterprise` aus
`dashboard.js` auf. Anschliessend laufen echte Frontend-/Backend-Planmodule gegen
einen lokalen Datenadapter. Keine Zugangsdaten, kein Netzwerk, keine persistenten
Daten, kein SMTP, keine Veraenderung eines Kunden- oder QA-Kontos.

Geprueft: erster Standort wird Standard; zweiter Standort verlangt die bestehende
Rechtsperson-Bestaetigung; Abbruch schreibt nichts; SaaS-Professional erhaelt keine
Box-Rechte. Planabfragen verlangen Ownerfilter, Mitarbeiterauswahl und `gueltig_ab`.
Wochenversionen und Einzeltag haben in Frontend/Backend dieselbe Wirkung; zugeordnetes
Team wird nie erweitert; bestehende Termine bleiben sichtbar; fehlende Plantabelle
faellt begrenzt zurueck und wird nach Sperrzeit erneut gelesen. Wiederholung beginnt
mit leerem Fixture.

**Grenze:** lokale Codepfad-Abnahme mit synthetischem Datenadapter. Kein Nachweis fuer
PostgreSQL-RLS, PostgREST, reale Migrationen, Docker-/TLS-Konfiguration, sichtbaren
Browser-Switcher oder installierte Kundenbox. Fuer echte Box-Abnahme separat: isolierte
installierte Box mit synthetischem Owner, zwei Standorte derselben Rechtsperson,
zugeordnetes Testteam, Standortwechsel und Plananzeige im Browser, Datenzugriff als
Owner/Mitarbeiter sowie Neustart/Persistenz pruefen. Keine echte Praxis verwenden.
