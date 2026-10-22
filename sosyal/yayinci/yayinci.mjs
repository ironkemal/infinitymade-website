// Praxura-Veröffentlicher: postet jeden Tag den Inhalt des Tages (sosyal/<jahr>/<MM-TT>.json + Medien).
// Läuft als Dienst (systemd praxura-sosyal, merkez-VPS) und prüft alle paar Minuten:
//   ab SENDEZEIT   → heutigen Inhalt auf jede Plattform posten (genau einmal, bis zu 3 Versuche)
//   ab VORSCHAUZEIT → Vorschau für morgen an Telegram + Warnung, wenn der Vorrat knapp wird
//   immer          → Telegram-Befehle lesen: /stopp MM-TT · /freigeben MM-TT · /pause · /weiter · /status
//                    · /test (Verbindung prüfen) · /jetzt [MM-TT] (Tag sofort posten, z. B. nach Fehlschlag)
//   START_AB=JJJJ-MM-TT → Tage davor werden nie automatisch gepostet (erster Sendetag)
// Aufruf:
//   node sosyal/yayinci/yayinci.mjs --dienst              Dauerbetrieb
//   node sosyal/yayinci/yayinci.mjs --trocken             ein Durchlauf, nichts wird gepostet
//   node sosyal/yayinci/yayinci.mjs --pruefe 30           die nächsten 30 Tage prüfen (Lücken, fehlende Medien)
//   node sosyal/yayinci/yayinci.mjs --posten 10-21        diesen Tag sofort posten (Nachholen)
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { berlin, inTagen, minutenVon, ladeTag } from './tag.mjs';
import { MetaClient, metaPlattformen } from './meta.mjs';
import { Telegram } from './telegram.mjs';

const MAX_VERSUCHE = 3;
const NAMEN = { instagram: 'Instagram', facebook: 'Facebook' };

// Antwort auf jede Nachricht, die kein Befehl ist
export const HILFE = `Praxura Social — so steuerst du mich:

/status — Heute gepostet? Wie viele Tage Vorrat, welche Tage gestoppt
/test — Prüft Token, Facebook-Seite und Instagram, ohne zu posten
/stopp MM-TT — Diesen Tag nicht posten (z. B. /stopp 10-24)
/freigeben MM-TT — Stopp wieder aufheben
/jetzt — Heutigen Beitrag sofort posten · /jetzt MM-TT holt einen vergangenen Tag nach
/pause — Alles anhalten (Urlaub, Krise) · /weiter — fortsetzen

Jeden Abend um 19:00 kommt die Vorschau für morgen mit einem „Nicht posten"-Knopf. Ohne Reaktion wird gepostet.`;
const HILFE_KNOEPFE = [
  [{ text: '📊 Status', befehl: 'status' }, { text: '🔌 Verbindung testen', befehl: 'test' }],
  [{ text: '⏸ Pause', befehl: 'pause' }, { text: '▶ Weiter', befehl: 'weiter' }],
];

export function konfiguration(env = process.env) {
  const hier = path.dirname(fileURLToPath(import.meta.url));
  const sosyal = path.join(hier, '..');
  return {
    inhalt: env.SOSYAL_INHALT || sosyal,
    medien: env.SOSYAL_MEDIEN || path.join(sosyal, 'ausgabe'),
    daten: env.SOSYAL_DATEN || path.join(hier, '.daten'),
    sendezeit: minutenVon(env.SENDEZEIT || '12:15'),
    sendezeitText: env.SENDEZEIT || '12:15',
    vorschauzeit: minutenVon(env.VORSCHAUZEIT || '19:00'),
    plattformen: (env.PLATTFORMEN || 'instagram,facebook').split(',').map(s => s.trim()).filter(Boolean),
    takt: Number(env.TAKT_MINUTEN || 5),
    vorratWarnung: Number(env.VORRAT_WARNUNG_TAGE || 7),
    startAb: env.START_AB || '',
    meta: { token: env.META_PAGE_TOKEN, pageId: env.META_PAGE_ID, igUserId: env.META_IG_USER_ID, version: env.META_API_VERSION || 'v23.0' },
    telegram: { token: env.TELEGRAM_BOT_TOKEN, chatId: env.TELEGRAM_CHAT_ID },
  };
}

// ---------- Zustand (daten/zustand.json) ----------
const leer = () => ({ tage: {}, gesperrt: [], pausiert: false, tgOffset: 0, vorschau: {}, gemeldet: {} });

export async function ladeZustand(dir) {
  const f = path.join(dir, 'zustand.json');
  if (!existsSync(f)) return leer();
  return { ...leer(), ...JSON.parse(await readFile(f, 'utf8')) };
}

export async function speichereZustand(dir, z) {
  await mkdir(dir, { recursive: true });
  const f = path.join(dir, 'zustand.json');
  await writeFile(`${f}.tmp`, JSON.stringify(z, null, 2));
  await rename(`${f}.tmp`, f);
}

/** "10-21" → "2026-10-21": das nächste Vorkommen ab heute (über den Jahreswechsel). */
export function schluessel(mmtt, jetzt) {
  const heute = berlin(jetzt);
  if (/^\d{4}-\d{2}-\d{2}$/.test(mmtt)) return mmtt;
  return `${mmtt >= heute.tag ? heute.jahr : Number(heute.jahr) + 1}-${mmtt}`;
}
/** "10-21" → das letzte Vorkommen bis heute (Nachholen geht rückwärts, über den Jahreswechsel). */
export function letzterSchluessel(mmtt, jetzt) {
  const heute = berlin(jetzt);
  return `${mmtt <= heute.tag ? heute.jahr : Number(heute.jahr) - 1}-${mmtt}`;
}
const teile = key => ({ jahr: key.slice(0, 4), tag: key.slice(5) });

/** Einmal melden (pro Schlüssel), damit Warnungen nicht alle fünf Minuten kommen. */
async function einmal(z, id, telegram, text, log) {
  if (z.gemeldet[id]) return;
  z.gemeldet[id] = new Date().toISOString();
  log(text);
  await telegram.sende(text).catch(e => log(`Telegram: ${e.message}`));
}

/** Postet einen Tag auf alle noch offenen Plattformen. */
export async function poste(key, t, { z, cfg, plattformen, telegram, log }) {
  z.tage[key] ||= {};
  z.tage[key].art = t.medien.art; z.tage[key].hook = t.hook.slice(0, 160); // für Wochenbericht + Log
  for (const p of cfg.plattformen) {
    const st = z.tage[key][p] || {};
    if (st.id || (st.versuche || 0) >= MAX_VERSUCHE) continue;
    if (!plattformen[p]) { await einmal(z, `${key}:${p}:unbekannt`, telegram, `⚠ Plattform „${p}“ ist nicht eingerichtet.`, log); continue; }
    try {
      const r = await plattformen[p](t);
      z.tage[key][p] = { id: r.id, link: r.link || null, zeit: new Date().toISOString() };
      const text = `✅ ${t.tag} auf ${NAMEN[p] || p} veröffentlicht${r.link ? `\n${r.link}` : ''}`;
      log(text); await telegram.sende(text).catch(e => log(`Telegram: ${e.message}`));
    } catch (e) {
      const versuche = (st.versuche || 0) + 1;
      z.tage[key][p] = { versuche, fehler: e.message, zeit: new Date().toISOString() };
      log(`❌ ${key} ${p} (Versuch ${versuche}): ${e.message}`);
      if (versuche === 1 || versuche === MAX_VERSUCHE) {
        const ende = versuche === MAX_VERSUCHE ? `Aufgegeben. Nachholen nach Behebung: /jetzt ${t.tag}` : 'Neuer Versuch beim nächsten Durchlauf.';
        const knopf = versuche === MAX_VERSUCHE ? [[{ text: '🔁 Jetzt nachholen', befehl: `jetzt ${t.tag}` }, { text: '🔌 Verbindung testen', befehl: 'test' }]] : undefined;
        await telegram.sende(`❌ ${t.tag} auf ${NAMEN[p] || p} fehlgeschlagen:\n${e.message}\n${ende}`, knopf).catch(() => {});
      }
    }
  }
}

async function befehleVerarbeiten(ctx) {
  const { z, telegram, jetzt, cfg, laden, log } = ctx;
  const { offset, befehle } = await telegram.befehle(z.tgOffset);
  z.tgOffset = offset;
  for (const { befehl, arg } of befehle) {
    if (befehl === 'hilfe') { await telegram.sende(HILFE, HILFE_KNOEPFE); log('Hilfe gesendet'); continue; }
    if ((befehl === 'stopp' || befehl === 'freigeben') && !arg) {
      const heute = berlin(jetzt).tag, morgen = inTagen(1, jetzt).tag;
      await telegram.sende(`Welcher Tag? (oder tippen: /${befehl} MM-TT)`,
        [[{ text: `Heute ${heute}`, befehl: `${befehl} ${heute}` }, { text: `Morgen ${morgen}`, befehl: `${befehl} ${morgen}` }]]);
      continue;
    }
    if (befehl === 'stopp') {
      const key = schluessel(arg, jetzt);
      if (!z.gesperrt.includes(key)) z.gesperrt.push(key);
      await telegram.sende(`⏸ ${arg} wird nicht gepostet.`, [[{ text: '▶ Doch posten', befehl: `freigeben ${arg}` }]]);
    } else if (befehl === 'freigeben') {
      const key = schluessel(arg, jetzt);
      z.gesperrt = z.gesperrt.filter(k => k !== key);
      await telegram.sende(`▶ ${arg} ist wieder freigegeben.`);
    } else if (befehl === 'pause') {
      z.pausiert = true; await telegram.sende('⏸ Alle Veröffentlichungen pausiert.', [[{ text: '▶ Weiter', befehl: 'weiter' }]]);
    } else if (befehl === 'weiter') {
      z.pausiert = false; await telegram.sende('▶ Veröffentlichungen laufen wieder.');
    } else if (befehl === 'status') {
      const h = berlin(jetzt), key = `${h.jahr}-${h.tag}`;
      const heute = cfg.plattformen.map(p => `${NAMEN[p] || p}: ${z.tage[key]?.[p]?.id ? '✅' : (z.tage[key]?.[p]?.fehler ? '❌' : '–')}`).join(' · ');
      const vorrat = await zaehleVorrat(laden, jetzt, 60);
      const start = cfg.startAb && key < cfg.startAb ? `\nErster Sendetag: ${cfg.startAb.slice(5)}` : '';
      await telegram.sende(`Status ${h.tag}${z.pausiert ? ' (PAUSIERT)' : ''}\nHeute: ${heute}\nVorrat: ${vorrat} Tage\nGestoppt: ${z.gesperrt.join(', ') || '—'}${start}`,
        [[{ text: '🔌 Verbindung testen', befehl: 'test' }, z.pausiert ? { text: '▶ Weiter', befehl: 'weiter' } : { text: '⏸ Pause', befehl: 'pause' }]]);
    } else if (befehl === 'test') {
      const text = ctx.verbindung ? await ctx.verbindung().catch(e => `❌ Verbindung gestört:\n${e.message}`) : '– Verbindungstest hier nicht verfügbar';
      await telegram.sende(text);
    } else if (befehl === 'jetzt') {
      // ausdrücklicher Befehl: hebt /stopp für diesen Tag auf und setzt erschöpfte Versuche zurück
      const h = berlin(jetzt), key = letzterSchluessel(arg || h.tag, jetzt), { jahr, tag } = teile(key);
      const t = await laden(jahr, tag);
      if (!t || t.fehlt.length) { await telegram.sende(`⚠ ${tag}: ${t ? `Dateien fehlen:\n${t.fehlt.join('\n')}` : 'kein Inhalt'}`); continue; }
      z.gesperrt = z.gesperrt.filter(k => k !== key);
      for (const p of cfg.plattformen) if (z.tage[key]?.[p] && !z.tage[key][p].id) delete z.tage[key][p];
      if (cfg.plattformen.every(p => z.tage[key]?.[p]?.id)) { await telegram.sende(`✅ ${tag} ist schon überall veröffentlicht.`); continue; }
      await telegram.sende(`▶ ${tag} wird jetzt veröffentlicht …`);
      await poste(key, t, ctx);
    }
    log(`Befehl /${befehl} ${arg || ''}`);
  }
}

export async function zaehleVorrat(laden, jetzt, max) {
  let n = 0;
  for (let i = 1; i <= max; i++) {
    const d = inTagen(i, jetzt);
    const t = await laden(d.jahr, d.tag);
    if (!t || t.fehlt.length) break;
    n++;
  }
  return n;
}

/** Tage, die vor genau `n` Tagen (Berlin) lagen oder früher, als "JJJJ-MM-TT". */
const tageAlt = (key, jetzt) => (new Date(`${berlin(jetzt).jahr}-${berlin(jetzt).tag}T12:00:00Z`) - new Date(`${key}T12:00:00Z`)) / 86400000;

export const kurzZahl = n => (n == null ? '–' : n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')}k` : String(n));
export const kennzahlText = k => [
  `Reichweite ${kurzZahl(k.reichweite)}`, k.aufrufe != null && `Aufrufe ${kurzZahl(k.aufrufe)}`,
  `gespeichert ${kurzZahl(k.gespeichert)}`, k.geteilt != null && `geteilt ${kurzZahl(k.geteilt)}`,
  k.wiedergabeMs != null && `Ø ${(k.wiedergabeMs / 1000).toFixed(1).replace('.', ',')} s`,
].filter(Boolean).join(' · ');

/** Nach 7 Tagen: Instagram-Kennzahlen einsammeln (höchstens 3 Beiträge pro Durchlauf, je 3 Versuche). */
async function kennzahlenSammeln({ z, jetzt, kennzahlen, log }) {
  if (!kennzahlen) return;
  let n = 0;
  for (const [key, tag] of Object.entries(z.tage)) {
    const ig = tag.instagram;
    if (!ig?.id || ig.kennzahlen || (ig.kzVersuche || 0) >= 3 || tageAlt(key, jetzt) < 7 || n >= 3) continue;
    n++;
    try { ig.kennzahlen = { ...await kennzahlen(ig.id, tag.art === 'video'), stand: new Date().toISOString() }; }
    catch (e) { ig.kzVersuche = (ig.kzVersuche || 0) + 1; log(`Kennzahlen ${key}: ${e.message}`); }
  }
}

/** Sonntags abends: was hat in der Woche (Beiträge mit 7-Tage-Kennzahlen) am besten funktioniert. */
async function wochenbericht({ z, jetzt, telegram, log }) {
  const h = berlin(jetzt), key = `${h.jahr}-${h.tag}`;
  const sonntag = new Date(`${key}T12:00:00Z`).getUTCDay() === 0;
  if (!sonntag || z.wochenbericht?.[key]) return;
  (z.wochenbericht ||= {})[key] = new Date().toISOString();
  const woche = Object.entries(z.tage)
    .filter(([k, t]) => t.instagram?.kennzahlen && tageAlt(k, jetzt) >= 7 && tageAlt(k, jetzt) < 14)
    .map(([k, t]) => ({ tag: k.slice(5), art: t.art, hook: t.hook || '', ...t.instagram.kennzahlen }))
    .sort((a, b) => (b.reichweite ?? 0) - (a.reichweite ?? 0));
  if (!woche.length) return;
  const summe = woche.reduce((s, w) => s + (w.reichweite ?? 0), 0);
  const zeilen = woche.map((w, i) => `${i === 0 ? '🏆' : '·'} ${w.tag} ${w.art === 'video' ? '🎬' : '🖼'} ${kennzahlText(w)}`);
  const text = `📊 Wochenbericht (Beiträge von vor 7–13 Tagen)\nReichweite gesamt ${kurzZahl(summe)}\n\n${zeilen.join('\n')}\n\nBester Hook: ${woche[0].hook.slice(0, 120)}`;
  log(text); await telegram.sende(text).catch(e => log(`Telegram: ${e.message}`));
}

/** Ein Durchlauf. Reine Funktion über den Zustand — testbar ohne Netz. */
export async function tick(ctx) {
  const { z, cfg, jetzt, laden, telegram, log } = ctx;
  await befehleVerarbeiten(ctx).catch(e => log(`Telegram-Befehle: ${e.message}`));
  const h = berlin(jetzt), key = `${h.jahr}-${h.tag}`;

  if (h.minuten >= cfg.sendezeit && !z.pausiert && !z.gesperrt.includes(key) && !(cfg.startAb && key < cfg.startAb)) {
    const t = await laden(h.jahr, h.tag);
    if (!t) await einmal(z, `${key}:leer`, telegram, `⚠ Für heute (${h.tag}) gibt es keinen Inhalt.`, log);
    else if (t.fehlt.length) await einmal(z, `${key}:fehlt`, telegram, `⚠ ${h.tag}: Dateien fehlen, nicht gepostet:\n${t.fehlt.join('\n')}`, log);
    else await poste(key, t, ctx);
  }

  if (h.minuten >= cfg.vorschauzeit) {
    const m = inTagen(1, jetzt), mkey = `${m.jahr}-${m.tag}`;
    if (!z.vorschau[mkey]) {
      z.vorschau[mkey] = new Date().toISOString();
      const t = await laden(m.jahr, m.tag);
      if (!t || t.fehlt.length) {
        await einmal(z, `${mkey}:vorschau-leer`, telegram, `⚠ Für morgen (${m.tag}) gibt es keinen fertigen Inhalt.`, log);
      } else if (!z.gesperrt.includes(mkey)) {
        const bild = t.medien.art === 'video' ? t.medien.cover : t.medien.dateien[0];
        const text = `Morgen ${cfg.sendezeitText} (${m.tag}, ${t.medien.art === 'video' ? 'Video' : 'Post'}):\n${t.hook}\n\nNichts tun = wird gepostet.`;
        const knopf = [[{ text: '⏸ Nicht posten', befehl: `stopp ${m.tag}` }]];
        await (existsSync(bild) ? telegram.sendeBild(bild, text, knopf) : telegram.sende(text, knopf)).catch(e => log(`Telegram: ${e.message}`));
      }
      const vorrat = await zaehleVorrat(laden, jetzt, cfg.vorratWarnung + 1);
      if (vorrat < cfg.vorratWarnung) {
        await einmal(z, `${key}:vorrat`, telegram, `📦 Nur noch ${vorrat} Tage Inhalt auf Vorrat. Zeit für die nächste Runde.`, log);
      }
    }
    await wochenbericht(ctx).catch(e => log(`Wochenbericht: ${e.message}`));
  }
  await kennzahlenSammeln(ctx).catch(e => log(`Kennzahlen: ${e.message}`));
  return z;
}

// ---------- CLI ----------
async function main() {
  const args = process.argv.slice(2);
  const cfg = konfiguration();
  const trocken = args.includes('--trocken') || !cfg.meta.token;
  const log = m => console.log(`[${new Date().toISOString()}] ${m}`);
  const laden = (jahr, tag) => ladeTag(cfg.inhalt, cfg.medien, jahr, tag);
  const telegram = trocken && !args.includes('--dienst')
    ? { sende: async t => log(`(Telegram) ${t}`), sendeBild: async (_, t) => log(`(Telegram+Bild) ${t}`), befehle: async o => ({ offset: o, befehle: [] }) }
    : new Telegram(cfg.telegram);
  const meta = trocken ? null : new MetaClient(cfg.meta);
  const plattformen = trocken
    ? Object.fromEntries(cfg.plattformen.map(p => [p, async t => { log(`(trocken) ${p}: ${t.tag} ${t.medien.art} — ${t.hook}`); return { id: 'trocken' }; }]))
    : metaPlattformen(meta);
  const kennzahlen = meta && cfg.plattformen.includes('instagram') ? (id, video) => meta.igKennzahlen(id, video) : null;
  if (trocken) {
    // eigener Zustand: ein Trockenlauf darf keinen Tag als "gepostet" markieren
    cfg.daten = path.join(cfg.daten, 'trocken');
    log('Trockenlauf: es wird nichts veröffentlicht' + (cfg.meta.token ? '' : ' (META_PAGE_TOKEN fehlt)'));
  }

  const i = args.indexOf('--pruefe');
  if (i >= 0) {
    const tage = Number(args[i + 1]) || 30;
    let luecke = null;
    for (let n = 0; n < tage; n++) {
      const d = inTagen(n, new Date()), t = await laden(d.jahr, d.tag);
      const s = !t ? 'KEIN INHALT' : t.fehlt.length ? `FEHLT: ${t.fehlt.map(f => path.basename(f)).join(', ')}` : `${t.medien.art.padEnd(9)} ${t.hook.slice(0, 70)}`;
      if ((!t || t.fehlt.length) && luecke === null) luecke = n;
      console.log(`${d.jahr}-${d.tag}  ${s}`);
    }
    if (luecke !== null && luecke < cfg.vorratWarnung) { console.error(`\n⚠ Lücke in ${luecke} Tagen`); process.exitCode = 1; }
    return;
  }

  // prüft Token, Seite und Instagram-Konto — ohne etwas zu veröffentlichen (CLI --verbindung und Telegram /test)
  const verbindung = async () => {
    const c = new MetaClient(cfg.meta);
    const seite = await c.graph(cfg.meta.pageId, { params: { fields: 'name,instagram_business_account' } });
    const ig = await c.graph(cfg.meta.igUserId, { params: { fields: 'username' } });
    return `✓ Facebook-Seite: ${seite.name}\n✓ Instagram: @${ig.username}${seite.instagram_business_account?.id === cfg.meta.igUserId ? ' (mit der Seite verknüpft)' : ' ⚠ nicht die mit der Seite verknüpfte ID'}`;
  };

  if (args.includes('--verbindung')) {
    console.log(await verbindung());
    const tgEcht = new Telegram(cfg.telegram);
    if (tgEcht.aktiv) { await tgEcht.sende('✓ Praxura-Veröffentlicher: Verbindung steht.'); console.log('✓ Telegram: Testnachricht gesendet'); }
    else console.log('– Telegram nicht eingerichtet');
    return;
  }

  const ctxBasis = { cfg, laden, telegram, plattformen, kennzahlen, log, verbindung: trocken ? null : verbindung };
  const p = args.indexOf('--posten');
  if (p >= 0) {
    const z = await ladeZustand(cfg.daten), key = schluessel(args[p + 1], new Date()), { jahr, tag } = teile(key);
    const t = await laden(jahr, tag);
    if (!t || t.fehlt.length) throw new Error(`${key}: ${t ? t.fehlt.join(', ') : 'kein Inhalt'}`);
    for (const pl of cfg.plattformen) if (z.tage[key]?.[pl]?.versuche >= MAX_VERSUCHE) delete z.tage[key][pl];
    await poste(key, t, { ...ctxBasis, z });
    await speichereZustand(cfg.daten, z);
    return;
  }

  const durchlauf = async () => {
    const z = await ladeZustand(cfg.daten);
    await tick({ ...ctxBasis, z, jetzt: new Date() });
    await speichereZustand(cfg.daten, z);
  };
  if (!args.includes('--dienst')) return durchlauf();
  log(`Dienst gestartet: ${cfg.plattformen.join(', ')} · Sendezeit ${cfg.sendezeitText} · Takt ${cfg.takt} min · Telegram ${telegram.aktiv ? 'an' : 'aus'}`);
  await telegram.menueSetzen?.().catch(e => log(`Telegram-Menü: ${e.message}`));
  for (;;) {
    await durchlauf().catch(e => log(`Fehler im Durchlauf: ${e.stack || e.message}`));
    // bis zum nächsten Takt warten — aber sofort weiter, wenn eine Telegram-Nachricht/ein Knopfdruck kommt
    const ende = Date.now() + cfg.takt * 60000;
    while (Date.now() < ende) {
      const sekunden = Math.max(1, Math.min(50, Math.round((ende - Date.now()) / 1000)));
      const { tgOffset } = await ladeZustand(cfg.daten);
      const neu = await telegram.warte(tgOffset, sekunden)
        .catch(async e => { log(`Telegram-Warten: ${e.message}`); await new Promise(r => setTimeout(r, 30000)); return false; });
      if (neu) { await new Promise(r => setTimeout(r, 1500)); break; } // kurze Bremse, falls ein Update hängen bleibt
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}
