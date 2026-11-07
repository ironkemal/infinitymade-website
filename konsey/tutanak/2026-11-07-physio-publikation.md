# Konsey — atomare Physio-Veröffentlichung

Datum: 07.11.2026. Mitglieder: fonksiyon-ustasi (vorherige gezielte Beratung),
db-ustasi, gkv-302, muhalif, deger-mi. Keine Live-Freigabe.

## Frage und Entscheidung

Wie werden Erzeugung, Wiederholung und Dateifreigabe vollständig abgesichert?
A: Bestehende Registry um fachliche atomare Finalisierung erweitern.
B: Nur JavaScript-Reihenfolge und Podo-Claim/CAS übernehmen.
On-prem: bestehendes Backend, Datenbank und Storage; keine neuen Cloud-Datenflüsse.

**A umsetzen.** B allein schließt Transaktions- und Storage-Lücke nicht.
Vorhandene Reserve/Upload/Readback/CAS-Komponenten weiterverwenden; keine zweite
Registry. Vollständige neue Publikation zunächst nur für fachlich freigegebene
Profile aktivieren. Noch keine SQL-Anwendung durch diesen Beschluss.

## Begründung und Invarianten

Physio create schreibt Header, Verordnungsbindung und Zeilen getrennt;
einige Fehler werden nur geloggt (`abrechnung.routes.js:1205–1260`).
Registry0060 finalisiert eine Datei samt Header, nicht den fachlichen Gesamtfall.
Direkte Signed-URLs (`module/abrechnung-detail.js:777`) und tenantpfadbezogene
Storage-Policy (`db/SCHEMA-RLS.sql:42`) sind zusätzlicher Zugriffspfad.

- Owner + Requestkey eindeutig; unveränderlicher Eingabehash. Gleicher Auftrag
  liefert dasselbe Ergebnis, abweichende Eingabe Konflikt.
- Eingabestand fachlich relevanter Verordnungs-/Sitzungs-/Preis-/Befreiungsdaten
  binden. Finale Transaktion muss veraltete Eingaben erkennen.
- Dateien vor Finalisierung unveröffentlicht; keine URL für neue unpublizierte
  Dateien. DB und Storage sind keine gemeinsame Transaktion.
- Sitzungsansprüche, Snapshot, Originalbezüge, Registry und Header gemeinsam
  finalisieren. Keine nachgelagerten best-effort-Fachschreibvorgänge.
- Daueransprüche verfallen niemals per Timeout. Worker-Ausführungslease und
  Generation sind davon getrennt; abgelöste Worker dürfen nicht finalisieren.
- Bei unbekanntem Commit-Ausgang Auftrag abfragen, nicht erneut abrechnen oder
  Dateien/Ansprüche löschen. Alte Artefakte unverändert erhalten.
- Korrektur/Nachforderung referenziert Originalanspruch und komponentenbezogene
  Differenz. Ein Sitzungsclaim darf legitime zusätzliche Hausbesuchspositionen
  nicht pauschal verbieten; kein zweiter Erstclaim für dieselbe Sitzung.

## Fachliche Bedingung

gkv-302: TA1 TP5 V21 §7.4.1/.3/.4 und §5.5.3.1/BES verlangen begrenzte
Nachforderung/Korrektur/Zusatzleistungen und Originalbezug; VKZ10 zusätzlich
Anhang A. Dauerclaim ist technische Ableitung, kein wörtlicher Datenbankzwang.
Bestehende konkrete Storno-/Rückabwicklungssemantik nicht abgenommen.

## Umsetzung und Nachweis

1. db-ustasi konkretisiert additiven Vertrag und lokale Migrations-/RLS-Proben.
2. Erzeugungsauftrag + Atomfinalisierung + Storagezugriff als ein Gesamtpaket
   implementieren, kein Teilpfad als vollständig freigeben.
3. Reale PostgreSQL-Tests mit synthetischem Bestand: zwei Mandanten, service-role,
   parallele Aufträge, Abbruch an jeder Grenze, Commit-Antwortverlust,
   Leasewechsel, veraltete Eingabe, unveränderte Altartefakte.
4. Backend- und direkte Storagezugriffe auf unveröffentlichte Pfade sperren;
   bereits ausgestellte URLs berücksichtigen. Bestehende Downloads kompatibel.
5. Unabhängige Nachprüfung vor lokaler Paketabnahme. Live/extern gesondert.

## Konsens, Abwägung und Grenzen

Alle fachlichen Voten empfehlen A; kein widersprechendes Votum. Mehr Aufwand
als B, dafür vollständige gemeinsame Abschlussgrenze. Keine zweite Beratungsrunde
erforderlich. Keine neue Infrastruktur. Detailvertrag und Tests sind noch offen;
dieses Protokoll beweist weder Implementierung noch Produktionsreife.
