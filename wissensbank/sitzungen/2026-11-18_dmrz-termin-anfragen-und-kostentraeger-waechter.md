---
titel: Prüfnachweise für DMRZ-Download, Termin-Anfragen und Kostenträger-Wächter
typ: sitzung
angelegt: 2026-11-18
tags: [sitzung, abnahme, dmrz, termin-anfrage, kostentraeger]
---

# Prüfnachweise für DMRZ-Download, Termin-Anfragen und Kostenträger-Wächter

## Synthetische Browserproben

- **DMRZ-Download** (`tools/browser-probe/rechnung-dmrz-download-probe.mjs`). Chromium lud eine XML herunter. Dateiname und Inhalt stimmten. Die Fixture erhielt genau ein Update auf `dmrz_exported_at` am verknüpften Rezept. Abbruch, Privatbeleg, fehlender und veralteter Rezeptbezug lösten weder Download noch Schreibversuch aus.
- **Termin-Anfrage** (`tools/browser-probe/termin-anfrage-bis-liste-probe.mjs`). Das öffentliche Formular und die originalen Create- und List-Handler liefen mit synthetischer Authentifizierung und Datenspeicherung im Arbeitsspeicher. Eine erfolgreiche Anfrage erschien genau einmal unter „Offen“. Beim simulierten Fehler beim Patienteneintrag erlaubte das Formular einen neuen Versuch. Der nächste Listenabruf lieferte unverändert den einzigen erfolgreichen Eintrag.
- Beide Proben bestanden einzeln in den isolierten Ständen `a4508a48` und `0e6552d1`. Beim Parallelstart mit der Gesamtsuite griff das Ladezeitlimit des Dashboards. Für die Wiederholung Browserproben nacheinander ausführen.
- Gesamtsuite für `a4508a48` im isolierten Checkout mit 5.701 bestandenen Tests, 0 Fehlern, 5 übersprungenen Tests und 3 TODO. Eine gitignorierte DATEV-Musterdatei fehlte dort. Typprüfung auf beiden Ständen und 35 gezielte Tests für `0e6552d1` bestanden.

## GitHub, Telegram und Vercel

- `5933e6f2` korrigierte den Versand bei Teilfehlern. Der Wächter versucht jede vorliegende Nachricht und meldet am Ende Exit 1, wenn ein Versand scheitert. Der Fehlerpfad wurde mit simuliertem `curl` getestet.
- Zwei manuelle GitHub-Actions-Läufe auf `a4508a48` endeten erfolgreich. Telegram bestätigte im jüngeren Lauf eine Sammelnachricht über drei neue Kostenträgerdateien durch `ok: true` und eine Nachrichten-ID. [Erster Lauf](https://github.com/ironkemal/infinitymade-website/actions/runs/44397254650) · [Jüngerer Lauf](https://github.com/ironkemal/infinitymade-website/actions/runs/44397842255)
- Vercel übersprang für `a4508a48` den Build anhand der Ausschlussregeln in `vercel.json`. Für `0e6552d1` wurde das Produktionsdeployment abgeschlossen. Sieben öffentlich ausgelieferte Dateien für Dashboard, Sitzung, Rechnungsdownload und Termin-Anfrage stimmten per SHA-256 mit `0e6552d1` überein. [Vercel-Deployment](https://vercel.com/ironkemal1-8589s-projects/infinitymade-website/DhqybbEvvjCm89W5RxFhQLvnWunU)

## Offene Abnahme

Der Exporter `module/rechnung-dmrz.js` erzeugt Praxura-eigenes XML. Für einen externen Importtest fehlen die vom Anbieter bestätigte Importspezifikation und ein freigegebener DMRZ-Testmandant. DMRZ beschreibt für Heilmittel CSV-Import nach eigener Spezifikation und individuell abgestimmte Importe. Der nächste Abnahmenachweis ist ein protokollierter Import mit synthetischen Daten im freigegebenen Testmandanten. [DMRZ-Leistungsbeschreibung](https://www.dmrz.de/fileadmin/Leistungsbeschreibung_Heilmittel_Tarife.pdf)
