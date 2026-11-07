# Physio Paket 0 – lokale Backend-Testbasis

Stand: 07.11.2026, geprüfter HEAD `c2bb41261692382a85ebda0da81b5a26aa8179ea`, Node `v24.12.0`.

## Lokal getestet

```sh
rtk proxy sh -c 'npm run test:backend > /tmp/praxura-p0-backend.log 2>&1'
```

Reguläres Ende mit Exit 0: **1969 Tests, 29 Suites, 1965 bestanden, 0 fehlgeschlagen, 4 übersprungen, 0 abgebrochen, 0 todo**, Runnerdauer **28260.877334 ms**. Zusammenfassung im Log, letzte zehn Zeilen. Das Log liegt lokal unter `/tmp` und ist kein versionierter Abnahmebeleg.

Die vier Skips sind explizite Opt-in-Gates; das Backend-Skript setzt ihre Schalter nicht:

| Test / Quelle | Lokale Aktivierung |
|---|---|
| Raumautomatik: echte PostgreSQL-Zuordnung und Parallelität – `api-backend/db/raum-automatik.integration.test.js:6,20` | `PRAXURA_RAUM_AUTOMATIK_PG_TEST=1` |
| Raumdetails: echte PostgreSQL-Constraints und wiederholbare Migration – `api-backend/db/raum-details.integration.test.js:7,21` | `PRAXURA_RAUM_DETAILS_PG_TEST=1` |
| F12 PostgreSQL: atomarer Tagesdeckel in getrennten Sessions – `api-backend/db/termin-mitteilungen-quota.integration.test.js:7,29` | `PRAXURA_QUOTA_PG_TEST=1` |
| Urlaub: tatsächliche Schreibpayloads über PostgreSQL bis Saldo und Kalender – `api-backend/db/urlaub-datum.integration.test.js:22` | `PRAXURA_URLAUB_DATUM_PG_TEST=1` |

Alle vier benötigen Docker CLI, erreichbare Docker Engine, verfügbare Kapazität für eigene Wegwerfcontainer und das Image `postgres:17.11`. Docker CLI vorhanden; Engine und Image wurden hier nicht geprüft. Die Tests starten Container mit `--network none`, ohne veröffentlichte Ports oder Volumes, verwenden synthetische Tabellen/Daten und räumen ihre Container im `finally` auf. Keine vorhandene Datenbank ist erforderlich. Bei fehlendem Image wäre ein separater Image-Download nötig. Die Flags können jeweils vor einem gezielten `rtk proxy node --test <Testdatei>` gesetzt werden; diese Aktivierung wurde in diesem Auftrag nicht ausgeführt.

## Grenzen und offene Handles

Kein dauerhaft hängender Lauf reproduziert: Der Prozess endete selbstständig nach rund 28 Sekunden. Währenddessen war zeitweise der Empfängerprüfungs-Test aktiv; das allein belegt keinen Handle-Fehler. Kein `force-exit`, keine Timeout-Umgehung und kein Billing-Fix verwendet.

Dies ist ein einzelner lokaler Backend-Lauf. Vier PostgreSQL-Integrationen bleiben ungetestet; keine zehn Wiederholungen, keine CI-Abnahme, keine Browser-, Live-, Produktions- oder Physio-Fachabnahme. Keine DB-Verbindung, kein Deploy und kein Commit ausgeführt.
