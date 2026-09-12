/**
 * lead-suche.js — Apify/Google-Maps über B2B-Zuweiser-Akquise + Ärzte-„In der
 * Nähe finden".
 *
 * Herkunft: onprem/REGISTER.md O-09. Beide Suchen laufen über unser eigenes
 * Apify-Token (`api-backend/server.js` → `api.apify.com`) und dienen unserer
 * eigenen Lead-Akquise, nicht der Praxis des Kunden — auf der On-Prem-Box
 * ergeben sie keinen Sinn und das Token darf ohnehin nicht dorthin. Aus
 * `dashboard.js` hierher ausgewandert (Konsey 2026-08-13, Datei wächst nicht
 * mehr) UND gleichzeitig IST_KUTU-fähig gemacht: in der Box werden die
 * betroffenen DOM-Knoten entfernt statt versteckt (gleiches Muster wie
 * `login.js:200`, Begründung dort: Tab-Umschalter würde ein `hidden` sonst
 * wieder aufheben — hier zusätzlich, weil `mountArztPanel()`
 * (`module/arzt-register.js`) sonst auf ein entferntes `#arztTabSuche`
 * schreiben würde). Das Register-Tab („Ärzte") bleibt auf der Box voll
 * funktionsfähig — es ist eine eigene, von Apify unabhängige Datenquelle.
 */

export function initLeadSuche(ctx) {
  const { istKutu, supabase, showToast, t, getOwnerId, loadB2B, renderB2B } = ctx;

  if (istKutu) {
    document.querySelector('#b2bMainContent .apify-bar')?.remove();
    document.querySelector('#panel-doctors .tabs')?.remove();
    document.getElementById('arztTabSuche')?.remove();
    return { loadDoctors: () => {} };
  }

  document.getElementById('apifyRunBtn').addEventListener('click', async () => {
    const rawQuery = document.getElementById('apifyQuery').value.trim();
    const city = document.getElementById('apifyCity').value.trim();
    const limit = Math.min(parseInt(document.getElementById('apifyLimit').value) || 20, 50);
    if (!rawQuery) { showToast('Bitte Suchbegriff eingeben', 'error'); return; }
    const btn = document.getElementById('apifyRunBtn');
    btn.disabled = true; btn.textContent = '⏳';
    const ownerId = getOwnerId();
    try {
      let dbq = supabase.from('scraper_data').select('id').eq('owner_id', ownerId);
      if (rawQuery) dbq = dbq.or(`company_name.ilike.%${rawQuery}%,name.ilike.%${rawQuery}%,category.ilike.%${rawQuery}%`);
      if (city) dbq = dbq.ilike('city', `%${city}%`);
      const { data: dbHits } = await dbq.limit(limit);
      if (dbHits && dbHits.length >= 5) {
        document.getElementById('b2bSearch').value = rawQuery;
        renderB2B();
        showToast(`${dbHits.length} Treffer aus Datenbank geladen`);
        btn.disabled = false; btn.textContent = 'Suchen'; return;
      }
      const searchQuery = city ? `${rawQuery} ${city}` : rawQuery;
      const { data: { session: s } } = await supabase.auth.getSession();
      const res = await fetch('/api/apify/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + s.access_token
        },
        body: JSON.stringify({ query: searchQuery, limit })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Suche fehlgeschlagen');
      const items = data.items || [];
      const inserts = items.filter(i => i.title || i.name || i.placeName).map(i => ({
        owner_id: ownerId,
        company_name: i.title || i.name || i.placeName,
        name: i.title || i.name || i.placeName,
        category: rawQuery,
        city: i.city || city || i.address?.split(',').pop()?.trim() || '',
        phone: i.phone || '',
        email: i.email || '',
        website: i.website || '',
        status: 'new',
        notes: i.address || ''
      }));
      if (inserts.length > 0) {
        const { error: insErr } = await supabase.from('scraper_data').insert(inserts);
        if (insErr) throw new Error('DB-Fehler: ' + insErr.message);
      }
      document.getElementById('b2bSearch').value = rawQuery;
      await loadB2B();
      showToast(`✓ ${inserts.length} Kontakte importiert`);
    } catch (err) {
      showToast('Fehler: ' + err.message, 'error');
    }
    btn.disabled = false; btn.textContent = 'Suchen';
  });

  let docsCache = [];
  let docsSort = { key: 'created_at', dir: 'desc' };

  function renderDocTable(rows) {
    const tbody = document.getElementById('docTableBody');
    const empty = document.getElementById('docEmpty');
    const hint = document.getElementById('docFilterHint');
    tbody.innerHTML = '';
    if (!rows || rows.length === 0) { empty.hidden = false; hint.textContent = ''; return; }
    empty.hidden = true;
    hint.textContent = rows.length + ' Einträge';
    tbody.innerHTML = rows.map(d => {
      const displayName = d.name || d.company_name || '—';
      return `<tr>
        <td>${displayName}</td>
        <td>${d.category || '—'}</td>
        <td>${d.city || '—'}</td>
        <td>${d.email ? `<a href="mailto:${d.email}">${d.email}</a>` : '—'}</td>
        <td>${d.phone || '—'}</td>
        <td>${d.notes || '—'}</td>
        <td>${d.website ? `<a href="https://${d.website.replace(/^https?:\/\//, '')}" target="_blank" rel="noopener">${d.website}</a>` : '—'}</td>
      </tr>`;
    }).join('');
  }

  function filterDocsCache(text) {
    const needle = text.toLowerCase();
    return docsCache.filter(d => {
      const name = (d.name || d.company_name || '').toLowerCase();
      const cat = (d.category || '').toLowerCase();
      const city = (d.city || '').toLowerCase();
      const phone = (d.phone || '').toLowerCase();
      const email = (d.email || '').toLowerCase();
      const notes = (d.notes || '').toLowerCase();
      return name.includes(needle) || cat.includes(needle) || city.includes(needle) || phone.includes(needle) || email.includes(needle) || notes.includes(needle);
    });
  }

  function sortDocsCache(rows, key, dir) {
    return [...rows].sort((a, b) => {
      const av = (a[key] || '').toLowerCase();
      const bv = (b[key] || '').toLowerCase();
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  function renderCurrent() {
    const filterText = document.getElementById('docFilterInput').value.trim();
    let rows = filterText ? filterDocsCache(filterText) : docsCache;
    rows = sortDocsCache(rows, docsSort.key, docsSort.dir);
    renderDocTable(rows);
  }

  async function loadDoctors() {
    const empty = document.getElementById('docEmpty');
    empty.hidden = true;
    const ownerId = getOwnerId();
    const { data: docs, error } = await supabase.from('scraper_data').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false });
    if (error) { empty.hidden = false; return; }
    docsCache = docs || [];
    renderCurrent();
  }

  function setDocProgress(text, pct) {
    const wrap = document.getElementById('docProgressWrap');
    const info = document.getElementById('docProgressInfo');
    const fill = document.getElementById('docProgressFill');
    wrap.hidden = false;
    info.innerHTML = text;
    fill.style.width = pct + '%';
  }
  function hideDocProgress() {
    document.getElementById('docProgressWrap').hidden = true;
    document.getElementById('docProgressFill').style.width = '0%';
  }

  document.getElementById('docFilterInput').addEventListener('input', renderCurrent);

  document.getElementById('docSortCity').addEventListener('click', () => {
    const th = document.getElementById('docSortCity');
    const icon = th.querySelector('.sort-icon');
    th.classList.remove('asc', 'desc');
    if (docsSort.key === 'city' && docsSort.dir === 'asc') {
      docsSort = { key: 'city', dir: 'desc' };
      th.classList.add('desc');
      icon.textContent = '↓';
    } else {
      docsSort = { key: 'city', dir: 'asc' };
      th.classList.add('asc');
      icon.textContent = '↑';
    }
    renderCurrent();
  });

  document.getElementById('docSearchBtn').addEventListener('click', async () => {
    const query = document.getElementById('docQuery').value.trim() || 'Arzt';
    const city = document.getElementById('docCity').value.trim();
    const limit = parseInt(document.getElementById('docLimit').value, 10) || 20;
    const fullQuery = city ? `${query} ${city}` : query;
    const btn = document.getElementById('docSearchBtn');
    btn.disabled = true; btn.textContent = '⏳';
    const ownerId = getOwnerId();

    // 1) Önce veritabanında ara — zaten varsa Apify'a gitme
    let dbq = supabase.from('scraper_data').select('*').eq('owner_id', ownerId);
    if (query) dbq = dbq.or(`company_name.ilike.%${query}%,name.ilike.%${query}%,category.ilike.%${query}%`);
    if (city) dbq = dbq.ilike('city', `%${city}%`);
    const { data: dbHits } = await dbq.limit(limit);
    if (dbHits && dbHits.length >= 3) {
      docsCache = dbHits;
      renderCurrent();
      showToast(`${dbHits.length} Treffer aus Datenbank geladen`);
      btn.disabled = false; btn.textContent = 'Suchen';
      return;
    }

    // 2) DB'de yoksa Apify'dan çek
    const startTime = Date.now();
    const ticker = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const phase = elapsed < 8 ? 'Google Maps wird durchsucht...'
        : elapsed < 25 ? 'Praxisdetails werden extrahiert...'
          : elapsed < 50 ? 'Kontaktdaten werden aufbereitet...'
            : 'Daten werden verarbeitet...';
      const pct = Math.min(95, (elapsed / 120) * 95);
      setDocProgress(`${phase} <b>${elapsed}s</b>`, pct);
    }, 1000);

    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const res = await fetch('/api/apify/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + s.access_token
        },
        body: JSON.stringify({ query: fullQuery, limit, language: 'de', countryCode: 'de' })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Apify-Fehler');
      const items = data.items || [];
      const inserts = items.filter(i => i.title || i.name || i.placeName).map(i => ({
        owner_id: ownerId,
        company_name: i.title || i.name || i.placeName,
        name: i.title || i.name || i.placeName,
        category: query,
        city: i.city || city || i.address?.split(',').pop()?.trim() || '',
        phone: i.phone || '',
        email: i.email || '',
        website: i.website || '',
        status: 'new',
        notes: i.address || ''
      }));
      if (inserts.length > 0) {
        const { error: insErr } = await supabase.from('scraper_data').insert(inserts);
        if (insErr) throw new Error('DB-Fehler: ' + insErr.message);
      }
      setDocProgress(`<b>${inserts.length}</b> Praxen importiert — Tabelle wird geladen...`, 100);
      await loadDoctors();
      showToast(t('apify_done') + inserts.length);
    } catch (e) {
      showToast(t('apify_error') + e.message, 'error');
    } finally {
      clearInterval(ticker);
      setTimeout(hideDocProgress, 800);
      btn.disabled = false; btn.textContent = 'Suchen';
    }
  });

  return { loadDoctors };
}
