/**
 * kalender-team.js — Wer bekommt eine Spalte im Terminkalender, und in welcher
 * Reihenfolge.
 *
 * Warum es das gibt
 * ─────────────────
 * Zwei Dinge, die in einer Ein-Personen-Praxis sofort auffallen:
 *
 *   1. Die Tagesansicht zeigte denselben Behandler manchmal zweimal — zwei
 *      identische Spalten mit denselben Terminen. Der Grund lag nicht in den
 *      Daten: `renderDayView()` wird aus mehreren Ecken angestossen (Signal
 *      nach dem Speichern, Realtime, Panelwechsel). Lief ein zweiter Aufbau
 *      an, waehrend der erste noch auf Supabase wartete, hingen am Ende beide
 *      Ergebnisse im selben Container. Die Spalten werden deshalb jetzt in
 *      einem Fragment aufgebaut und am Stueck eingehaengt (`replaceChildren`)
 *      — der letzte Lauf gewinnt, statt sich an den vorigen anzuhaengen.
 *      `teamReihenfolge()` deckt zusaetzlich den Datenfall ab: eine doppelt
 *      gelieferte Profilzeile ergibt trotzdem nur eine Spalte.
 *   2. Der eigene Zugang stand irgendwo in der Reihe. Man sucht aber immer
 *      zuerst den eigenen Tag — also steht er ganz links, alle anderen
 *      wandern nach rechts.
 *
 * Konsey 2026-08-13: neuer Code kommt in ein eigenes Modul.
 */

/**
 * Teamliste fuer Kalenderspalten: ohne Doppelte, eigener Zugang zuerst.
 *
 * @param {Array<{id?: string}>} members  Rohe Teamliste (z. B. aus `profiles`).
 * @param {string|null} selfId            Eigene user_id; fehlt sie, bleibt die Reihenfolge.
 * @returns {Array} Neue Liste — die Eingabe wird nicht veraendert.
 */
export function teamReihenfolge(members, selfId) {
  const gesehen = new Set();
  const liste = [];
  for (const m of members || []) {
    if (!m || !m.id || gesehen.has(m.id)) continue;
    gesehen.add(m.id);
    liste.push(m);
  }
  const ich = selfId ? liste.findIndex(m => m.id === selfId) : -1;
  return ich > 0 ? [liste[ich], ...liste.slice(0, ich), ...liste.slice(ich + 1)] : liste;
}

/**
 * Mitarbeiter-Chips ueber dem Kalender ("Alle" + je ein Chip pro Behandler).
 *
 * Bewusst ohne Zugriff auf `dashboard.js`-Globals: Liste, aktiver Filter,
 * Farben und Klick-Reaktion kommen von aussen herein.
 *
 * @param {Object}   o
 * @param {HTMLElement|null} o.container  Zielelement; fehlt es, passiert nichts.
 * @param {Array}    o.members            Teamliste (bereits in Anzeigereihenfolge).
 * @param {string}   o.activeId           Aktiver Filter — 'all' oder eine user_id.
 * @param {string[]} o.colors             Farbpalette, wird zyklisch vergeben.
 * @param {string}   o.allLabel           Beschriftung des "Alle"-Chips.
 * @param {(id: string) => void} o.onPick Klick-Reaktion mit der gewaehlten id.
 */
export function renderEmpChips({ container, members, activeId, colors, allLabel, onPick }) {
  if (!container) return;
  const chips = [{ id: 'all', name: allLabel, color: 'var(--primary)' }];
  (members || []).forEach((emp, idx) => {
    chips.push({
      id: emp.id,
      name: emp.business_name || emp.email?.split('@')[0] || '—',
      color: colors[idx % colors.length],
    });
  });

  const frag = document.createDocumentFragment();
  chips.forEach(c => {
    const btn = document.createElement('button');
    const isActive = activeId === c.id;
    btn.className = `cal-emp-chip ${isActive ? 'active' : ''}`;
    if (isActive && c.id !== 'all') {
      btn.style.borderColor = c.color;
      btn.style.backgroundColor = c.color + '20';
    }
    const dot = document.createElement('span');
    dot.className = 'cal-emp-chip-dot';
    dot.style.backgroundColor = c.color;
    btn.appendChild(dot);
    btn.appendChild(document.createTextNode(c.name));
    btn.addEventListener('click', () => onPick(c.id));
    frag.appendChild(btn);
  });
  container.replaceChildren(frag);
}
