// Ladeplan Kostenträgerdatei -> DB (reine Funktionen, kein I/O).
// Benutzt von tools/kostentraeger-annahmestellen-laden.mjs; hier getrennt, damit
// die Umschaltlogik zum Quartalswechsel testbar ist (30.09.2026, W-01 #10/#11).
//
// Kernidee: "gültig" ist ein DATUM, kein Dateiname.
//  * `kostentraeger` kennt valid_from/valid_to und wird von kostentraegerAbfrage()
//    (lib/rezept-felder.js) und der View kostentraeger_auswahl datumsbewusst
//    gefiltert → Enddaten dürfen VORAB geladen werden, der Wechsel passiert von
//    selbst um Mitternacht.
//  * `kostentraeger_annahmestellen` / `_anschriften` haben KEINE Gültigkeitsspalten
//    und der Leser (ladeAnnahmestelle) filtert nicht nach Datum. Zwei Stände
//    nebeneinander = zwei Empfänger, treffer[0] entscheidet zufällig. Diese
//    Tabellen werden deshalb NUR auf den zum Stichtag gültigen Stand
//    synchronisiert (einfügen + veraltete Zeilen bereits bekannter IKs löschen).
//    Kein FK zeigt auf diese beiden Tabellen → Löschen ist FK-sicher.
//  * `kostentraeger` selbst wird NIE gelöscht (prescriptions.kostentraeger_ik FK,
//    ON DELETE CASCADE-Kinder). Wegfall = valid_to.

export const ZEICHEN_VDT = /^(\d{4})(\d{2})(\d{2})$/;

/** 'YYYYMMDD' -> 'YYYY-MM-DD' (null bleibt null). */
export function vdtZuIso(v) {
  if (!v) return null;
  const m = String(v).match(ZEICHEN_VDT);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function tagDavor(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Je Kassenart (Dateiname-Präfix) die zum Stichtag gültige Ausgabe (neueste mit
 * gueltigAb <= stichtag) und die nächste zukünftige (frühestes gueltigAb > stichtag).
 * @param {Array<{datei:string,gueltigAb:string}>} ausgaben
 * @param {string} stichtag ISO
 * @returns {{aktiv: object[], kommend: object[], ohneGueltige: string[]}}
 */
export function waehleAusgaben(ausgaben, stichtag) {
  const arten = [...new Set(ausgaben.map(a => a.datei.slice(0, 2)))];
  const aktiv = [], kommend = [], ohneGueltige = [];
  for (const art of arten) {
    const alle = ausgaben.filter(a => a.datei.slice(0, 2) === art);
    const gueltig = alle.filter(a => a.gueltigAb <= stichtag)
      .sort((a, b) => b.gueltigAb.localeCompare(a.gueltigAb) || b.datei.localeCompare(a.datei));
    const spaeter = alle.filter(a => a.gueltigAb > stichtag)
      .sort((a, b) => a.gueltigAb.localeCompare(b.gueltigAb) || b.datei.localeCompare(a.datei));
    if (gueltig[0]) aktiv.push(gueltig[0]); else ohneGueltige.push(art);
    if (spaeter[0]) kommend.push(spaeter[0]);
  }
  return { aktiv, kommend, ohneGueltige };
}

const ns = (v) => (v === null || v === undefined ? '' : v);

/** kostentraeger-Zeile aus einem geparsten Datensatz (gleiche Ableitung wie der Erstimport 06.09.2026). */
export function kostentraegerZeile(r, ausgabe) {
  // VKG 01 auf sich selbst (Partner = eigene IK) heisst "rechnet selbst ab" —
  // der Erstimport hat dafür abrechnender_kt_ik = NULL gespeichert (217 Zeilen).
  const vkg01 = (r.datenannahmestellen || []).find(v => v.verknuepfungsart === '01' && v.partner_ik !== r.ik);
  return {
    ik: r.ik,
    name: (r.namensteile && r.namensteile.length) ? r.namensteile.join(' ') : r.name,
    kurzname: r.name || null,
    payer_type: 'gkv',
    active: true,
    valid_from: vdtZuIso(r.valid_from),
    valid_to: vdtZuIso(r.valid_to),
    abrechnender_kt_ik: vkg01 ? vkg01.partner_ik : null,
    ist_abrechnender_kt: !vkg01,
    quelle: ausgabe.datei,
    quelle_stand: ausgabe.gueltigAb,
    datensatz_status: 'echt',
  };
}

/**
 * Dieselbe IK steht in mehreren Kassenart-Dateien (263 von 1.043 — historische
 * Einträge z. B. in BK neben dem aktuellen in EK). Es zählt EIN Datensatz je IK:
 * offen (valid_to leer) vor befristet, dann späteres valid_to, dann späteres
 * valid_from, dann die spätere Datei. Ohne das würde ein historischer BK-Satz
 * mit valid_to 2017 die aktive EK-Zeile beenden.
 * @returns {Map<string,{ausgabe:object,r:object}>}
 */
export function besteJeIk(dateien) {
  const rang = (r) => [r.valid_to ? 0 : 1, r.valid_to || '', r.valid_from || ''];
  const besser = (a, b) => {
    const ra = rang(a), rb = rang(b);
    for (let i = 0; i < 3; i++) { if (ra[i] !== rb[i]) return ra[i] > rb[i]; }
    return true; // Gleichstand: spätere Datei gewinnt
  };
  const m = new Map();
  for (const { ausgabe, records } of dateien) {
    for (const r of records) {
      const cur = m.get(r.ik);
      if (!cur || besser(r, cur.r)) m.set(r.ik, { ausgabe, r });
    }
  }
  return m;
}

/**
 * Plan für die Tabelle `kostentraeger`.
 * @param {object} p
 * @param {Array} p.dbZeilen        alle Zeilen (ik, name, kurzname, valid_from, valid_to, abrechnender_kt_ik, ist_abrechnender_kt, quelle, quelle_stand, datensatz_status)
 * @param {Array<{ausgabe,records}>} p.aktiv    zum Stichtag gültige Dateien (geparst)
 * @param {Array<{ausgabe,records}>} p.kommend  nächste, noch nicht gültige Dateien (nur für Enddaten)
 * @param {string} p.stichtag
 * @returns {{inserts:object[], patches:Array<{ik,patch,grund}>, unveraendert:number, namensabweichungen:number}}
 */
export function planKostentraeger({ dbZeilen, aktiv, kommend, stichtag }) {
  const db = new Map(dbZeilen.map(z => [z.ik, z]));
  const inserts = [];
  const patchMap = new Map(); // ik -> {patch, gruende:Set}
  const patch = (ik, felder, grund) => {
    const e = patchMap.get(ik) || { patch: {}, gruende: new Set() };
    Object.assign(e.patch, felder);
    e.gruende.add(grund);
    patchMap.set(ik, e);
  };
  let namensabweichungen = 0;

  const aktivIk = new Set();
  for (const [ik, { ausgabe, r }] of besteJeIk(aktiv)) {
    {
      aktivIk.add(ik);
      const soll = kostentraegerZeile(r, ausgabe);
      const ist = db.get(r.ik);
      if (!ist) { inserts.push(soll); continue; }
      if (ist.datensatz_status !== 'echt') continue; // Mock-Zeilen nicht anfassen
      if (ist.name !== soll.name) namensabweichungen++; // nur zählen — Name wird nicht überschrieben
      const p = {};
      if ((ist.abrechnender_kt_ik ?? null) !== soll.abrechnender_kt_ik) p.abrechnender_kt_ik = soll.abrechnender_kt_ik;
      if (Boolean(ist.ist_abrechnender_kt) !== soll.ist_abrechnender_kt) p.ist_abrechnender_kt = soll.ist_abrechnender_kt;
      if ((ist.valid_to ?? null) !== soll.valid_to) p.valid_to = soll.valid_to;
      // Name, Kurzname und valid_from bestehender Zeilen werden NICHT überschrieben:
      // dieselbe IK steht teils in mehreren Dateien (siehe besteJeIk), Umbenennungen
      // sind Handarbeit — und ein valid_from in der Zukunft würde eine heute gültige
      // Zeile aus der Auswahl werfen. Nur Neuzeilen tragen valid_from aus der Datei.
      // quelle_stand hängt an der Datei: nur mitziehen, wenn die Datei wechselt
      // (Altbestand trägt teils Erstelldatum statt gültig-ab — kein Rauschen erzeugen).
      if (ist.quelle !== soll.quelle) { p.quelle = soll.quelle; p.quelle_stand = soll.quelle_stand; }
      if (Object.keys(p).length) patch(r.ik, p, 'aktualisiert');
    }
  }

  // Enddaten VORAB aus der kommenden Ausgabe (datumsgesteuert, heute wirkungslos).
  const kommendIk = new Set();
  for (const [ik, { ausgabe, r }] of besteJeIk(kommend)) {
    {
      kommendIk.add(ik);
      const ist = db.get(ik);
      const bis = vdtZuIso(r.valid_to);
      if (ist && ist.datensatz_status === 'echt' && bis && (ist.valid_to ?? null) !== bis) {
        patch(r.ik, { valid_to: bis }, `Enddatum ${bis} aus ${ausgabe.datei}`);
      }
    }
  }
  // Wegfall: IK steht in der (aktiven oder kommenden) Ausgabe ihrer Kassenart nicht mehr.
  const neuesteJeArt = new Map(); // art -> {ausgabe, iks:Set}
  for (const e of [...aktiv, ...kommend]) {
    const art = e.ausgabe.datei.slice(0, 2);
    const cur = neuesteJeArt.get(art);
    if (!cur || e.ausgabe.gueltigAb >= cur.ausgabe.gueltigAb) {
      neuesteJeArt.set(art, { ausgabe: e.ausgabe, iks: new Set(e.records.map(r => r.ik)) });
    }
  }
  // Nur die jeweils NEUESTEN Ausgaben zählen (eine IK, die in die Datei einer
  // anderen Kassenart gewandert ist, entfällt nicht) — nicht die auslaufenden.
  const irgendwoVorhanden = new Set([...neuesteJeArt.values()].flatMap(n => [...n.iks]));
  for (const ist of dbZeilen) {
    if (ist.datensatz_status !== 'echt') continue;
    const art = String(ist.quelle || '').slice(0, 2);
    const n = neuesteJeArt.get(art);
    if (!n || n.iks.has(ist.ik) || irgendwoVorhanden.has(ist.ik)) continue;
    const bis = tagDavor(n.ausgabe.gueltigAb);
    if (!ist.valid_to || ist.valid_to > bis) {
      patch(ist.ik, { valid_to: bis }, `entfällt ab ${n.ausgabe.gueltigAb} (nicht in ${n.ausgabe.datei})`);
    }
  }

  const patches = [...patchMap].map(([ik, e]) => ({ ik, patch: e.patch, grund: [...e.gruende].join('; ') }));
  return { inserts, patches, unveraendert: dbZeilen.length - patches.length, namensabweichungen };
}

export const VKG_SCHLUESSEL = ['kostentraeger_ik', 'verknuepfungsart', 'partner_ik', 'abrechnungscode', 'art_datenlieferung', 'uebermittlungsmedium', 'bundesland'];
export const ANS_SCHLUESSEL = ['kostentraeger_ik', 'art', 'plz', 'ort', 'strasse'];
export const schluessel = (z, felder) => felder.map(f => String(ns(z[f]))).join('|');

/** VKG-/ANS-Sollzeilen der aktiven Dateien (dedupliziert am DB-UNIQUE-Schlüssel, erste gewinnt). */
export function sollZeilen(aktiv) {
  const vkg = new Map(), ans = new Map();
  let ungueltigeAnschriften = 0;
  for (const { ausgabe, records } of aktiv) {
    for (const r of records) {
      for (const v of r.datenannahmestellen) {
        const z = {
          kostentraeger_ik: r.ik,
          verknuepfungsart: ns(v.verknuepfungsart),
          partner_ik: ns(v.partner_ik),
          leistungserbringergruppe: ns(v.leistungserbringergruppe),
          abrechnungscode: ns(v.abrechnungscode),
          art_datenlieferung: ns(v.art_datenlieferung),
          uebermittlungsmedium: ns(v.uebermittlungsmedium),
          bundesland: ns(v.bundesland),
          quelle: ausgabe.datei,
          quelle_stand: ausgabe.gueltigAb,
        };
        const k = schluessel(z, VKG_SCHLUESSEL);
        if (!vkg.has(k)) vkg.set(k, z);
      }
      for (const a of (r.anschriften || [])) {
        const art = String(a.art ?? '').trim();
        if (art !== '1' && art !== '2' && art !== '3') { ungueltigeAnschriften++; continue; }
        const z = { kostentraeger_ik: r.ik, art, plz: ns(a.plz), ort: ns(a.ort), strasse: ns(a.strasse), quelle: ausgabe.datei, quelle_stand: ausgabe.gueltigAb };
        const k = schluessel(z, ANS_SCHLUESSEL);
        if (!ans.has(k)) ans.set(k, z);
      }
    }
  }
  return { vkg, ans, ungueltigeAnschriften };
}

/**
 * Sync-Plan für eine Kindtabelle.
 *  - einfügen: Sollzeile fehlt in der DB
 *  - aktualisieren: Zeile da, aber quelle/quelle_stand (und bei VKG leistungserbringergruppe) weichen ab
 *  - löschen: DB-Zeile eines IK, der in den aktiven Dateien vorkommt, die aber nicht mehr Soll ist.
 *    Zeilen von IKs, die gar nicht mehr vorkommen (entfallene Kostenträger), bleiben stehen (Historie, kein Leser erreicht sie).
 */
export function planKind({ dbZeilen, soll, felder, vergleich }) {
  const dbMap = new Map();
  for (const z of dbZeilen) dbMap.set(schluessel(z, felder), z);
  const sollIk = new Set([...soll.values()].map(z => z.kostentraeger_ik));
  const inserts = [], updates = [], deletes = [];
  for (const [k, z] of soll) {
    const ist = dbMap.get(k);
    if (!ist) inserts.push(z);
    else if (vergleich.some(f => String(ns(ist[f])) !== String(ns(z[f])))) updates.push(z);
  }
  for (const [k, ist] of dbMap) {
    if (!soll.has(k) && sollIk.has(ist.kostentraeger_ik)) deletes.push(ist);
  }
  return { inserts, updates, deletes };
}
