// Praxura-Veröffentlicher: postet jeden Tag den Inhalt des Tages (sosyal/<jahr>/<MM-TT>.json + Medien).
// Läuft als Dienst (systemd praxura-sosyal, merkez-VPS) und prüft alle paar Minuten:
//   ab SENDEZEIT   → heutigen Inhalt auf jede Plattform posten (genau einmal, bis zu 3 Versuche)
//   ab VORSCHAUZEIT → Vorschau für morgen an Telegram + Warnung, wenn der Vorrat knapp wird
//   immer          → Telegram-Befehle lesen: /stopp MM-TT · /freigeben MM-TT · /pause · /weiter · /status
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
        const ende = versuche === MAX_VERSUCHE ? 'Aufgegeben. Nachholen: /posten nach Behebung oder Neustart.' : 'Neuer Versuch beim nächsten Durchlauf.';
        await telegram.sende(`❌ ${t.tag} auf ${NAMEN[p] || p} fehlgeschlagen:\n${e.message}\n${ende}`).catch(() => {});
      }
    }
  }
}

async function befehleVerarbeiten(ctx) {
  const { z, telegram, jetzt, cfg, laden, log } = ctx;
  const { offset, befehle } = await telegram.befehle(z.tgOffset);
  z.tgOffset = offset;
  for (const { befehl, arg } of befehle) {
    if ((befehl === 'stopp' || befehl === 'freigeben') && !arg) { await telegram.sende('Bitte mit Datum: /stopp MM-TT'); continue; }
    if (befehl === 'stopp') {
      const key = schluessel(arg, jetzt);
      if (!z.gesperrt.includes(key)) z.gesperrt.push(key);
      await telegram.sende(`⏸ ${arg} wird nicht gepostet. Rückgängig: /freigeben ${arg}`);
    } else if (befehl === 'freigeben') {
      const key = schluessel(arg, jetzt);
      z.gesperrt = z.gesperrt.filter(k => k !== key);
      await telegram.sende(`▶ ${arg} ist wieder freigegeben.`);
    } else if (befehl === 'pause') {
      z.pausiert = true; await telegram.sende('⏸ Alle Veröffentlichungen pausiert. Fortsetzen: /weiter');
    } else if (befehl === 'weiter') {
      z.pausiert = false; await telegram.sende('▶ Veröffentlichungen laufen wieder.');
    } else if (befehl === 'status') {
      const h = berlin(jetzt), key = `${h.jahr}-${h.tag}`;
      const heute = cfg.plattformen.map(p => `${NAMEN[p] || p}: ${z.tage[key]?.[p]?.id ? '✅' : (z.tage[key]?.[p]?.fehler ? '❌' : '–')}`).join(' · ');
      const vorrat = await zaehleVorrat(laden, jetzt, 60);
      await telegram.sende(`Status ${h.tag}${z.pausiert ? ' (PAUSIERT)' : ''}\nHeute: ${heute}\nVorrat: ${vorrat} Tage\nGestoppt: ${z.gesperrt.join(', ') || '—'}`);
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

/** Ein Durchlauf. Reine Funktion über den Zustand — testbar ohne Netz. */
export async function tick(ctx) {
  const { z, cfg, jetzt, laden, telegram, log } = ctx;
  await befehleVerarbeiten(ctx).catch(e => log(`Telegram-Befehle: ${e.message}`));
  const h = berlin(jetzt), key = `${h.jahr}-${h.tag}`;

  if (h.minuten >= cfg.sendezeit && !z.pausiert && !z.gesperrt.includes(key)) {
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
        const text = `Morgen ${cfg.sendezeitText} (${m.tag}, ${t.medien.art === 'video' ? 'Video' : 'Post'}):\n${t.hook}\n\nNicht posten? /stopp ${m.tag}`;
        await (existsSync(bild) ? telegram.sendeBild(bild, text) : telegram.sende(text)).catch(e => log(`Telegram: ${e.message}`));
      }
      const vorrat = await zaehleVorrat(laden, jetzt, cfg.vorratWarnung + 1);
      if (vorrat < cfg.vorratWarnung) {
        await einmal(z, `${key}:vorrat`, telegram, `📦 Nur noch ${vorrat} Tage Inhalt auf Vorrat. Zeit für die nächste Runde.`, log);
      }
    }
  }
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
  const plattformen = trocken
    ? Object.fromEntries(cfg.plattformen.map(p => [p, async t => { log(`(trocken) ${p}: ${t.tag} ${t.medien.art} — ${t.hook}`); return { id: 'trocken' }; }]))
    : metaPlattformen(new MetaClient(cfg.meta));
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

  if (args.includes('--verbindung')) {
    // prüft Token, Seite, Instagram-Konto und Telegram — ohne etwas zu veröffentlichen
    const c = new MetaClient(cfg.meta);
    const seite = await c.graph(cfg.meta.pageId, { params: { fields: 'name,instagram_business_account' } });
    const ig = await c.graph(cfg.meta.igUserId, { params: { fields: 'username' } });
    console.log(`✓ Facebook-Seite: ${seite.name}`);
    console.log(`✓ Instagram: @${ig.username}${seite.instagram_business_account?.id === cfg.meta.igUserId ? ' (mit der Seite verknüpft)' : ' ⚠ nicht die mit der Seite verknüpfte ID'}`);
    const tgEcht = new Telegram(cfg.telegram);
    if (tgEcht.aktiv) { await tgEcht.sende('✓ Praxura-Veröffentlicher: Verbindung steht.'); console.log('✓ Telegram: Testnachricht gesendet'); }
    else console.log('– Telegram nicht eingerichtet');
    return;
  }

  const ctxBasis = { cfg, laden, telegram, plattformen, log };
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
  for (;;) {
    await durchlauf().catch(e => log(`Fehler im Durchlauf: ${e.stack || e.message}`));
    await new Promise(r => setTimeout(r, cfg.takt * 60000));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}
