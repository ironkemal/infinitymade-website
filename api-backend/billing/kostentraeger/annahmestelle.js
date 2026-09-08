// Wohin geht diese §302-Datei? — Auflösung der Datenannahmestelle.
//
// Ersetzt `kostentraeger.das_ik`. Diese Spalte war fachlich falsch gedacht:
// sie unterstellt EINE Annahmestelle je Kostenträger. Tatsächlich hängt der
// Empfänger am Viererschlüssel (Kostenträger, Abrechnungscode, Art der
// Datenlieferung, Bundesland) — eine echte 1:n-Beziehung, die in
// `kostentraeger_annahmestellen` steht (VKG-Segmente der Kostenträgerdatei).
// Für alle 1043 echten Zeilen ist `das_ik` NULL, der Empfänger fiel also still
// auf den Kostenträger selbst zurück.
//
// Quelle der Schlüssel: Anhang 3 zu Anlage 1 TP5, Abschnitt 5 (Verknüpfungsart)
// und § 8.14 (Abrechnungscode).
//
// Die Auswahl ist bewusst als REINE Funktion gebaut (`waehleAnnahmestelle`),
// die Datenbankabfrage liegt daneben. Nur so lässt sich die Fallback-Kette
// ohne Datenbank testen — und genau diese Kette ist die Stelle, an der eine
// Datei beim falschen Empfänger landet.

/** Die Kassenart steckt in den ersten zwei Zeichen des Quelldateinamens
 *  ('AO05Q326_KE3.txt' → 'AO'). null, wenn nicht ableitbar — nicht raten. */
export function kassenartAusQuelle(quelle) {
  const m = String(quelle ?? '').trim().match(/^(AO|EK|BK|IK|BN|LK|GK|SB)/i);
  return m ? m[1].toUpperCase() : null;
}

/** Nur diese beiden Arten der Datenlieferung gelten für die elektronische
 *  Abrechnung (Anhang 3, Abschnitt 5.2). 21/24/26/28/29 sind Papier. */
export const ELEKTRONISCHE_DATENLIEFERUNG = Object.freeze(['07', '30']);

/** Datenannahmestelle mit (03) und ohne (02) Entschlüsselungsbefugnis.
 *  Reihenfolge ist die Vorzugsreihenfolge: erst 03, dann 02. */
export const VERKNUEPFUNGSART_KETTE = Object.freeze(['03', '02']);

/**
 * Reihenfolge der Abrechnungscodes, in der gesucht wird — erster Treffer gewinnt.
 *
 * ⚠️ Podologie überspringt die 20. Der Gruppenschlüssel 20 ist
 * „Heilmittelerbringer" im Sinne der Codes 21-29 und deckt die Podologie
 * (71/72) NICHT mit ab — Anhang 03 § 8.14, Fussnote 4. Wer 20 hier
 * einreiht, schickt podologische Dateien an die Physio-Annahmestelle.
 *
 * @param {string} bereich  'podologie' | sonstiges
 * @param {string} eigenerCode  Abrechnungscode des Fachbereichs (z. B. '22')
 * @returns {string[][]}  Stufen; je Stufe die gleichwertigen Codes
 */
export function abrechnungscodeKette(bereich, eigenerCode) {
  if (bereich === 'podologie') return [['71', '72'], ['99'], ['00']];
  const eigen = eigenerCode ? [eigenerCode] : [];
  return [...(eigen.length ? [eigen] : []), ['20'], ['99'], ['00']];
}

/**
 * Wählt aus den VKG-Zeilen EINES Kostenträgers die Annahmestelle.
 *
 * @param {Array} zeilen  Rohzeilen aus `kostentraeger_annahmestellen`
 * @param {object} opts
 * @param {string[][]} opts.ketten        aus abrechnungscodeKette()
 * @param {string|null} [opts.bundeslandVkg]  2-stelliger VKG-Landesschlüssel, falls bekannt
 * @returns {{
 *   partnerIk: string, verknuepfungsart: string, abrechnungscode: string,
 *   bundesland: string, stufe: number, kandidaten: number
 * } | null}  null = nicht auflösbar
 */
export function waehleAnnahmestelle(zeilen, { ketten, bundeslandVkg = null } = {}) {
  // Bundesland-Filter. '' und '99' sind die landesunabhängigen Zeilen; ein
  // konkreter Landesschlüssel kommt nur dazu, wenn der Aufrufer ihn kennt.
  //
  // ⚠️ Diesen Filter WEGZULASSEN ist keine Vereinfachung, sondern ein Fehler:
  // ohne ihn ziehen die landesspezifischen Zeilen anderer Bundesländer mit in
  // die Auswahl, und die Zahl der eindeutig auflösbaren Kostenträger bricht von
  // rund 220 auf gut ein Dutzend ein (db-ustasi, 07.09.2026 gemessen).
  //
  // ⚠️ Die Spalte ist NOT NULL DEFAULT '' — der landesunabhängige Fall ist der
  // LEERE STRING, nicht NULL. Ein `is null` trifft hier keine einzige Zeile.
  const erlaubtesLand = new Set(['', '99']);
  if (bundeslandVkg) erlaubtesLand.add(bundeslandVkg);

  const brauchbar = (zeilen || []).filter(z =>
    ELEKTRONISCHE_DATENLIEFERUNG.includes(String(z.art_datenlieferung || '')) &&
    erlaubtesLand.has(String(z.bundesland ?? ''))
  );
  if (!brauchbar.length) return null;

  // Aussen die Verknüpfungsart, innen die Abrechnungscode-Kette: eine
  // Annahmestelle MIT Entschlüsselungsbefugnis (03) ist immer die richtigere
  // Adresse als eine ohne (02), auch wenn 02 unter einem spezifischeren
  // Abrechnungscode stünde. Auf 02 fällt heute genau ein Kostenträger
  // (105810615) zurück.
  for (const art of VERKNUEPFUNGSART_KETTE) {
    const derArt = brauchbar.filter(z => String(z.verknuepfungsart || '') === art);
    if (!derArt.length) continue;

    for (let stufe = 0; stufe < ketten.length; stufe++) {
      const codes = ketten[stufe];
      const treffer = derArt.filter(z => codes.includes(String(z.abrechnungscode || '')));
      if (!treffer.length) continue;

      // Auf die Codes 20/71/72 eingegrenzt ist die Abfrage eindeutig (264
      // Schlüssel, 0 mehrdeutig). Auf der Sammelschlüssel-Stufe 00 gibt es
      // 14 Schlüssel mit ZWEI Empfängern. Deshalb hier kein maybeSingle-artiges
      // Werfen: die Datei muss rausgehen. Aber es bleibt sichtbar.
      const eindeutig = [...new Set(treffer.map(t => String(t.partner_ik)))];
      return {
        partnerIk:        String(treffer[0].partner_ik),
        verknuepfungsart: art,
        abrechnungscode:  String(treffer[0].abrechnungscode || ''),
        bundesland:       String(treffer[0].bundesland ?? ''),
        // Kassenart aus dem Namen der Quelldatei: 'EK05Q226_KE0.txt' → 'EK'.
        // Zusammen mit der DAV-IK bildet sie die Dateieinheit (Kap. 5.3.1).
        // Bewusst null statt geraten, wenn `quelle` leer ist — eine falsche
        // Kassenart sortiert Rezepte in die falsche Datei.
        kassenart:        kassenartAusQuelle(treffer[0].quelle),
        stufe,
        kandidaten:       eindeutig.length,
      };
    }
  }
  return null;
}

/**
 * Lädt die VKG-Zeilen des Kostenträgers und wählt die Annahmestelle.
 * Breit lesen, im Speicher filtern — je Kostenträger sind es im Schnitt gut
 * zwanzig Zeilen, und die Auswahllogik bleibt so an EINER testbaren Stelle.
 *
 * @returns {{ ok: true, ik, name, treffer } | { ok: false, grund: string }}
 */
export async function ladeAnnahmestelle(supabase, {
  kostentraegerIk, bereich, eigenerAbrechnungscode, bundeslandVkg = null,
}) {
  const { data: zeilen, error } = await supabase
    .from('kostentraeger_annahmestellen')
    .select('partner_ik, verknuepfungsart, abrechnungscode, art_datenlieferung, bundesland, quelle')
    .eq('kostentraeger_ik', kostentraegerIk);
  if (error) return { ok: false, grund: 'DB-Fehler: ' + error.message };

  const treffer = waehleAnnahmestelle(zeilen, {
    ketten: abrechnungscodeKette(bereich, eigenerAbrechnungscode),
    bundeslandVkg,
  });
  if (!treffer) return { ok: false, grund: 'keine elektronische Datenannahmestelle hinterlegt' };

  if (treffer.kandidaten > 1) {
    console.warn(
      `[annahmestelle] Kostenträger ${kostentraegerIk}: ${treffer.kandidaten} mögliche ` +
      `Empfänger unter Abrechnungscode ${treffer.abrechnungscode} — genommen wird ${treffer.partnerIk}.`
    );
  }

  const { data: partner } = await supabase
    .from('kostentraeger').select('name').eq('ik', treffer.partnerIk).maybeSingle();

  return { ok: true, ik: treffer.partnerIk, name: partner?.name || '', treffer };
}

/** Einheitliche 412-Antwort. Ein stiller Rückfall auf die Kostenträger-IK
 *  wäre die teurere Variante: die Datei ginge an den falschen Empfänger und
 *  käme als Abweisung zurück — oder schlimmer, gar nicht. */
export function annahmestelleFehlt(res, { ik, name }) {
  return res.status(412).json({
    error: `${name || 'Krankenkasse'} (IK ${ik}): Für diese Krankenkasse ist keine ` +
           `elektronische Datenannahmestelle hinterlegt.`,
    code: 'KEINE_DATENANNAHMESTELLE',
    kostentraegerIk: ik,
  });
}
