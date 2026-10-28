/**
 * V7.03: gespeicherte Behandlung abschließen, vorhandene Folge-/Geldwege öffnen.
 * Keine Queries, Preise, Zahlungsstempel oder Behandlungsschreibwege.
 * Ohne belegten Geldstand bleibt Status ungeklärt; nur Owner-Einstieg wird injiziert.
 */
export async function zeigeBehandlungsabschluss({ frage, istAktuell, darfZahlungPruefen,
  folgeMoeglich, oeffneFolgetermin, oeffneZahlungspruefung }) {
  const aktuell = () => { try { return istAktuell() === true; } catch { return false; } };
  const geld = () => { try { return darfZahlungPruefen() === true; } catch { return false; } };
  if (!aktuell()) return;
  const zeigtGeld = geld();
  const antwort = await frage({
    title: 'Behandlung gespeichert',
    fokusBinden: true,
    message: zeigtGeld
      ? 'Zuzahlungsstatus ungeklärt. Prüfen Sie die Zahlung in der vorhandenen Terminansicht.'
      : 'Die Behandlung wurde gespeichert.',
    confirmText: folgeMoeglich === true ? 'Folgetermin anlegen' : 'Fertig',
    cancelText: folgeMoeglich === true ? 'Später' : null,
    zusatzText: zeigtGeld ? 'Zuzahlung prüfen' : null,
  });
  if (!aktuell()) return;
  if (antwort === 'zusatz' && zeigtGeld && geld()) return oeffneZahlungspruefung();
  if (antwort === true && folgeMoeglich === true) return oeffneFolgetermin();
}
