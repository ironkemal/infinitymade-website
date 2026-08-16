/**
 * rechnung-druck.js — was auf dem Beleg des Patienten stehen darf.
 *
 * Der Rechnungen-Bildschirm baut seinen Ausdruck nicht über eine
 * Server-Vorlage, sondern direkt im DOM (`dashboard.html`, die `invv*`-IDs).
 * Deshalb war er von der Korrektur an `zuzahlungsrechnung.template.js` /
 * `rzg-quittung.template.js` nicht betroffen und zeigte weiter den vollen
 * Behandlungsbetrag — der Fehler, den Kemal am 15.08.2026 im Live-Test
 * gemeldet hat.
 *
 * Die Regel
 * ─────────
 * Zahlt die Kasse einen Teil, sieht der Patient auf seinem Beleg nur, was er
 * selbst zahlt. „Zwischensumme" und „Kassenzuzahlung" nebeneinander verraten
 * den Kassenanteil unmittelbar; die Einzelpreise der Leistungen ebenso.
 * (Nausad, 12.08.2026: „nicht sehen, was die Kasse zahlt.")
 *
 * Bei Privat- und Selbstzahlerrechnungen — also ohne Kassenanteil — bleibt
 * alles stehen: dort IST der Rechnungsbetrag das, was der Patient zahlt, und
 * die Einzelpreise sind Pflichtangabe (§ 14 Abs. 4 Nr. 5 UStG). Ein Beleg
 * ohne Preise wäre dort keine gültige Rechnung.
 *
 * Der Kassenanteil entscheidet, nicht `invoice_type`: Letzteres ist ein
 * Etikett, das leer bleiben kann; `kassenzuzahlung > 0` ist die Zahl, an der
 * die Sache tatsächlich hängt.
 */

/** Sichtbarkeit über style.display, nicht über das hidden-Attribut:
 *  `.invoice-print-total-row` setzt `display:flex` und würde `hidden`
 *  überstimmen — die Zeile bliebe trotz `hidden` sichtbar. */
function zeile(id, sichtbar) {
  const el = document.getElementById(id);
  if (el) el.style.display = sichtbar ? '' : 'none';
}

/**
 * Steueraufschlüsselung — § 14 Abs. 4 Nr. 7 UStG verlangt das „nach
 * Steuersätzen und einzelnen Steuerbefreiungen aufgeschlüsselte Entgelt".
 * Eine Gesamtsumme allein genügt nicht, sobald eine Rechnung steuerfreie und
 * steuerpflichtige Positionen mischt — was in der Podologie vorkommt
 * (Heilbehandlung + kosmetische Position in derselben Sitzung).
 *
 * Gelesen wird ausschliesslich `inv.tax_summary`, also der eingefrorene Stand
 * der Rechnung — nie neu gerechnet und nie aus dem Profil nachgeladen
 * (§ 146 Abs. 4 AO). Alte Rechnungen ohne diese Angabe zeigen den Block nicht.
 */
function fuelleSteuerbloecke(inv, { formatEur }) {
  const wrap = document.getElementById('invvSteuerBlock');
  const body = document.getElementById('invvSteuerBody');
  const gruppen = Array.isArray(inv.tax_summary) ? inv.tax_summary : [];

  // Nur zeigen, wenn tatsächlich Steuer im Spiel ist. Eine reine
  // GKV-Zuzahlungsrechnung oder eine Altrechnung bleibt so unverändert.
  const zeigen = gruppen.length > 0 && Number(inv.steuer_gesamt || 0) > 0;
  if (wrap) wrap.style.display = zeigen ? '' : 'none';
  if (!zeigen || !body) return;

  body.innerHTML = gruppen.map(g => `
    <tr>
      <td>${Number(g.satz) > 0 ? `${g.satz} % USt` : 'steuerfrei'}</td>
      <td class="num">${formatEur(g.netto || 0)}</td>
      <td class="num">${formatEur(g.steuer || 0)}</td>
      <td class="num">${formatEur(g.brutto || 0)}</td>
    </tr>`).join('');
}

/**
 * @param {object} inv          invoices-Zeile
 * @param {object} deps
 * @param {Function} deps.formatEur
 * @param {Function} deps.escapeHtml
 * @param {Function} deps.aggregateInvLines
 * @returns {boolean} ob Preise gezeigt werden (für Tests/Aufrufer)
 */
export function fuelleBelegPositionen(inv, { formatEur, escapeHtml, aggregateInvLines }) {
  const zeigePreise = !(Number(inv.kassenzuzahlung || 0) > 0);

  const lines = aggregateInvLines(inv.line_items || []);

  // Leistungsdatum je Zeile nur, wenn es tatsächlich verschiedene Tage sind.
  // § 14 Abs. 4 Nr. 6 UStG verlangt den Zeitpunkt; steht bei jeder Zeile
  // derselbe Tag, trägt ihn die Kopfzeile und die Spalte wäre nur Wiederholung
  // (`podoloji`, 16.08.2026 — die Tabelle soll auf A5 passen).
  const daten = [...new Set(lines.map(l => l.leistungsdatum).filter(Boolean))];
  const zeigeDatum = daten.length > 1;
  const datumDE = iso => { try { return new Date(iso).toLocaleDateString('de-DE'); } catch { return iso; } };

  const body = document.getElementById('invvLineBody');
  if (body) {
    body.innerHTML = lines.map((l, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(l.title || '')}${
        Number(l.ust_satz) > 0 ? ` <span style="font-size:11px;">(${l.ust_satz} % USt)</span>` : ''
      }</td>
      ${zeigeDatum ? `<td class="num">${l.leistungsdatum ? datumDE(l.leistungsdatum) : '—'}</td>` : ''}
      <td class="num">${l.quantity || 1}×</td>
      ${zeigePreise ? `<td class="num">${formatEur(l.unit_price || 0)}</td>
      <td class="num">${formatEur((l.quantity || 1) * (l.unit_price || 0))}</td>` : ''}
    </tr>`).join('');
  }
  zeile('invvThDatum', zeigeDatum);

  zeile('invvThEinzel', zeigePreise);
  zeile('invvThGesamt', zeigePreise);
  zeile('invvSubtotalRow', zeigePreise);
  zeile('invvEigenRow', zeigePreise);
  zeile('invvKasseRow', zeigePreise);

  const setzen = (id, wert) => {
    const el = document.getElementById(id);
    if (el) el.textContent = wert;
  };
  fuelleSteuerbloecke(inv, { formatEur });
  setzen('invvSubtotal', formatEur(inv.subtotal || 0));
  setzen('invvEigenPct', inv.eigenanteil_pct || 0);
  setzen('invvEigenEur', formatEur(inv.eigenanteil_eur || 0));
  setzen('invvKasse', formatEur(inv.kassenzuzahlung || 0));
  // Bleibt immer stehen — das ist die einzige Zahl, die der Patient braucht.
  setzen('invvTotal', formatEur(inv.total_patient || 0));

  return zeigePreise;
}
