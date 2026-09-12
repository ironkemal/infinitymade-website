// Kleiner, modul-scoped Halter fuer das Ergebnis des Schema-Zaehler-Selbstchecks
// (RELEASE-STANDARD.md §5.4/1). Existiert NUR, um einen Zirkelimport zu vermeiden:
// server.js importiert setup/router.js UND ruft runMigrations() auf; wuerde
// router.js server.js importieren, um an das Ergebnis zu kommen, waere das ein
// Zirkel. Beide Seiten importieren stattdessen dieses Modul (onprem-Konsultation,
// Faz 2.2 dilim 2b, 12.09.2026).
//
// Bewusst NICHT in eine Datei/DB geschrieben: das Ergebnis ist reine Prozess-
// Diagnose (kein Nutzdatensatz), gilt nur fuer den laufenden Container, und wird
// bei jedem Neustart ohnehin frisch von migrate.js geliefert.

let schemaZaehlerErgebnis = null;

export function schemaZaehlerSetzen(ergebnis) {
  schemaZaehlerErgebnis = ergebnis;
}

export function schemaZaehlerLesen() {
  return schemaZaehlerErgebnis;
}
