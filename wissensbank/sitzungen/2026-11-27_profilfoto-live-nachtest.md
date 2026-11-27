# Profilfoto entfernen · Nachtest 27.11.2026

Geprüft wurde der veröffentlichte Dashboard-Stand `20261125pf1`. Dashboard, Stylesheet und beide Fotomodule stimmten bytegenau mit dem Checkout von `origin/main` bei `5b46c2c4` überein.

## Live mit synthetischen QA-Konten

| Foto angelegt | Foto entfernt | Ergebnis |
|---|---|---|
| Inhaber im Selbstprofil | Inhaber im Selbstprofil | bestanden |
| Mitarbeiter im Selbstprofil | Mitarbeiter im Selbstprofil | bestanden |
| Inhaber über Team-Detail mit Zuschnitt | Inhaber im Team-Detail | bestanden |
| Inhaber über Team-Detail mit Zuschnitt | Mitarbeiter im Selbstprofil | bestanden |
| Synthetisches Zeitstempelfoto mit normaler Inhabersitzung als Altbestand angelegt | Mitarbeiter im Selbstprofil | bestanden |

Bei jedem Fall war das Bild vor dem Entfernen mit frischem URL-Parameter öffentlich als Bild abrufbar (HTTP 200). Nach dem Entfernen antwortete dieselbe Objektadresse mit neuem Parameter mit HTTP 400 und „not found“. Profilverweise wurden nach Neuladen geprüft. Die Schlusskontrolle ergab beide Verweise null, beide festen URLs 400 und keine passenden Avatare in den beiden QA-Ordnern. Bei 390 px waren „Foto ändern“, „Foto entfernen“ und „Speichern“ für beide Rollen jeweils 44 px hoch und vollständig sichtbar.

## Lokal simulierte Randfälle

Vier Befunde in `module/praxis-logo-upload.js` mit synthetischem Storage. Bei der Simulation wurden keine Live-Dateien angefasst.

- Die Dateinamensprüfung in `verwaisteTeamfotoPfade` akzeptiert durch den nicht maskierten Punkt auch `123xjpg`. Diese Datei gelangte in die Löschliste.
- Das Auflisten des Ordners endet bei 100 Einträgen. Ein verwaistes Zeitstempelfoto an Position 101 blieb bei erfolgreicher Rückmeldung erhalten.
- Meldet die Ordnerabfrage einen Fehler, kann das verknüpfte Foto erfolgreich entfernt werden, während ein älteres Foto erhalten bleibt.
- Ist die Datei bereits weg, während das Profil noch auf sie verweist, scheitert der Wiederholungsversuch bei leerer Löschliste. Das kann nach erfolgreicher Storage-Löschung mit anschließend fehlgeschlagenem Profil-Update auftreten.

## Lokale Gates

Alle elf direkten Fototests und die vollständige Browser-Probe bestanden. Die Probe lief mit separaten lokalen Ports und synthetischer Konfiguration. Alle vier Testsuiten zusammen ergaben 6.280 bestandene Tests, einen Fehler und drei bekannte TODOs. Der Kostenträger-Seed-Test erwartet als nächste Migration `0133`, obwohl der geprüfte Stand bereits `0134` enthält und korrekt `0135` liefert. Die separat ausgeführte Typprüfung meldete fünf Fehler in `tools/kostentraeger-annahmestellen-laden.mjs` und `tools/kostentraeger-check.mjs`. Die Funktionskarte war aktuell.
