/**
 * mailversand.js — Einstellungen → „E-Mail-Versand": die Praxis verbindet ihr eigenes Postfach.
 *
 * Herkunft: AUFTRAG-MAILVERSAND (Kemal 09.11.2026). Nach der Installation, optional: ohne Postfach läuft alles,
 * nur der Versand ist aus (Mail-Entwurf / PDF). Alle Patientenmails (Terminerinnerung, Rechnung, Dokument,
 * Sondertag, Termin-Anfragen) laufen danach über dieses Postfach — der Server wählt in api-backend/lib/mail.js
 * mailKanal(). Backend: api-backend/routes/mailversand.js (nur Inhaber, Passwort verlässt den Server nie).
 *
 * v1: SMTP mit Anbieter-Vorlagen (Melih 09.11.2026: Microsoft-Anmeldung per Gerätecode folgt in Phase 2).
 * Im SaaS zusätzlich „Mit Google verbinden" (bestehender OAuth-Weg, nur wenn der Server Google kennt — O-08).
 * Texte nur Deutsch, hier als Konstanten (dashboard.js wächst nicht, Konsey 2026-08-13).
 */
'use strict';

export const SECTION_ID = 'settingsMailversandSection';
export const EINRICHTEN_TEXT = 'E-Mail-Versand einrichten →';
export const ANBIETER_REIHENFOLGE = ['outlook', 'gmail', 'ionos', 'strato', 'einsundeins', 'telekom', 'gmx', 'webde', 'andere'];
export const OHNE_POSTFACH_TEXT = 'Ohne Postfach funktioniert Praxura vollständig — E-Mails an Patienten werden dann nicht '
  + 'verschickt, sondern als Entwurf für Ihr Mailprogramm oder als PDF bereitgestellt.';
export const MICROSOFT_TEXT = 'Die Anmeldung „Mit Microsoft verbinden" folgt. Bis dahin funktioniert Microsoft 365 / Outlook '
  + 'über Adresse und Passwort (bei Zwei-Faktor-Anmeldung ein App-Kennwort), sofern „Authentifiziertes SMTP" für das Postfach erlaubt ist. '
  + 'Hinweis: Microsoft schaltet die Passwort-Anmeldung für SMTP ab Ende 2026 standardmäßig aus; dann muss Ihre IT sie für das Postfach wieder erlauben.';
export const GMAIL_SCHRITTE = [
  ['Im Google-Konto die „Bestätigung in zwei Schritten" einschalten.', 'https://myaccount.google.com/signinoptions/two-step-verification'],
  ['Ein App-Passwort erstellen (Name z. B. „Praxura") und das 16-stellige Passwort kopieren.', 'https://myaccount.google.com/apppasswords'],
  ['Hier die Gmail-Adresse und das App-Passwort eintragen und speichern.', null],
];

const STIL = `
.mv-karte{background:var(--bg-card-solid);border:1px solid var(--border);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
.mv-kopf{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.mv-titel{font-size:14px;font-weight:600;color:var(--text-main)}
.mv-text{font-size:13px;color:var(--text-muted);line-height:1.5;margin:0}
.mv-text a{color:var(--primary)}
.mv-kacheln{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:6px 0 14px}
.mv-kachel{background:var(--bg-card-solid);border:1px solid var(--border);border-radius:8px;padding:10px 12px;text-align:left;font-size:13px;font-weight:600;color:var(--text-main);cursor:pointer;min-height:44px}
.mv-kachel:hover{border-color:var(--primary)}
.mv-kachel[aria-pressed="true"]{border-color:var(--primary);background:var(--primary-dim)}
.mv-tipp{font-size:12px;color:var(--warning-text,var(--text-muted));background:var(--warning-dim);border-radius:8px;padding:8px 10px;margin:0 0 10px;line-height:1.45}
.mv-fehler{font-size:13px;color:var(--danger);margin:0;line-height:1.45}
.mv-knoepfe{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
.mv-schritte{margin:0 0 10px 18px;padding:0;list-style:decimal;font-size:13px;color:var(--text-muted);line-height:1.6}
.mv-schritte a{color:var(--primary)}
.mv-punkt-neutral{background:var(--text-muted)!important}
.mv-punkt-offen{background:var(--warning)!important}
.mv-einrichten{color:var(--primary);font-weight:600;text-decoration:none;cursor:pointer}
.mv-einrichten:hover{text-decoration:underline}
`;

function stilEinmal(doc) {
  if (doc.getElementById('mailversand-stil')) return;
  const s = doc.createElement('style');
  s.id = 'mailversand-stil';
  s.textContent = STIL;
  doc.head.appendChild(s);
}

/** Kleiner DOM-Baukasten: nur textContent, nie innerHTML mit Daten. */
function el(doc, tag, attrs = {}, ...kinder) {
  const e = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const k of kinder.flat()) if (k !== null && k !== undefined && k !== false) e.append(k);
  return e;
}

/** Link „E-Mail-Versand einrichten →" für Stellen, an denen nichts versendet wurde. */
export function einrichtenLink(doc = document, text = EINRICHTEN_TEXT) {
  stilEinmal(doc);
  const a = el(doc, 'a', { class: 'mv-einrichten', href: '#', 'data-mailversand-link': '1', text });
  a.addEventListener('click', (ev) => { ev.preventDefault(); globalThis.gehZuEinstellung?.(SECTION_ID); });
  return a;
}

/** HTML-Schnipsel für Module, die Markup als Text bauen; der Klick wird global abgefangen (siehe unten). */
export function einrichtenLinkHtml(text = EINRICHTEN_TEXT) {
  return `<a href="#" class="mv-einrichten" data-mailversand-link="1">${text.replace(/[<>&"]/g, '')}</a>`;
}

let klickAbfang = false;
function klickAbfangen(doc) {
  if (klickAbfang || !doc?.addEventListener) return;
  klickAbfang = true;
  doc.addEventListener('click', (ev) => {
    const a = ev.target?.closest?.('[data-mailversand-link]');
    if (!a) return;
    ev.preventDefault();
    globalThis.gehZuEinstellung?.(SECTION_ID);
  });
}
klickAbfangen(globalThis.document);

/**
 * Zustand für die Statuskarte.
 * @returns {{stufe:'aus'|'ok'|'fehler'|'offen', titel:string, text:string}}
 */
export function statusInfo(d) {
  const z = d?.einstellung;
  if (z && z.modus === 'smtp') {
    if (z.status === 'unterbrochen') {
      return { stufe: 'fehler', titel: 'Verbindung unterbrochen', text: d.fehler?.meldung || 'Der Mailserver hat die Verbindung abgelehnt.' };
    }
    if (z.status === 'verbunden') return { stufe: 'ok', titel: 'Verbunden', text: z.absender_email || '' };
    return { stufe: 'offen', titel: 'Gespeichert, noch nicht geprüft', text: z.absender_email || '' };
  }
  if (d?.env) return { stufe: 'ok', titel: 'Vom Installateur eingerichtet', text: `${d.env.host}:${d.env.port}` };
  if (d?.google?.verbunden) return { stufe: 'ok', titel: 'Verbunden über Gmail', text: d.google.adresse || '' };
  return { stufe: 'aus', titel: 'Nicht eingerichtet', text: OHNE_POSTFACH_TEXT };
}

/** Darf „Testmail senden" angeboten werden? */
export function testMoeglich(d) {
  return d?.einstellung?.modus === 'smtp' || !!(d?.env && d?.kutu);
}

/** Formularwerte → Anfragekörper (Passwort nur, wenn eingegeben). */
export function anfrageKoerper(preset, werte) {
  const k = {
    preset,
    absender_email: String(werte.absender_email || '').trim(),
    absender_name: String(werte.absender_name || '').trim(),
  };
  if (werte.passwort) k.passwort = werte.passwort;
  if (preset === 'andere') {
    k.smtp_host = String(werte.smtp_host || '').trim();
    k.smtp_port = Number(werte.smtp_port);
    k.smtp_sicherheit = werte.smtp_sicherheit;
    k.smtp_benutzer = String(werte.smtp_benutzer || '').trim();
  }
  return k;
}

const datumZeit = (iso) => {
  try { return new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }); } catch { return ''; }
};

/** API-Aufruf (Muster module/sondertag-mitteilung.js anfrage). Wirft Error mit .status/.code/.daten. */
export async function anfrage(deps, methode, pfad, body) {
  const token = await deps.getToken();
  const f = deps.fetchImpl || globalThis.fetch;
  const res = await f(deps.apiBase + pfad, {
    method: methode,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const daten = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(daten.error || 'Anfrage fehlgeschlagen.');
    e.status = res.status; e.code = daten.code || null; e.daten = daten;
    throw e;
  }
  return daten;
}

function sectionBauen(doc) {
  const sec = el(doc, 'div', { class: 'settings-section', id: SECTION_ID });
  sec.append(
    el(doc, 'div', { class: 'settings-section-title', text: 'E-Mail-Versand' }),
    el(doc, 'div', { class: 'settings-section-body' }),
  );
  return sec;
}

/** Section einhängen: an den Anfang der Gruppe „Integrationen & Datenschutz" (vor Google Calendar). */
function sectionFinden(doc) {
  let sec = doc.getElementById(SECTION_ID);
  if (sec) return sec;
  const anker = doc.getElementById('googleCalBtn')?.closest('.settings-section') || doc.getElementById('settingsKiSection');
  if (!anker) return null;
  sec = sectionBauen(doc);
  anker.before(sec);
  return sec;
}

export function renderMailversandSettings(deps, doc = document) {
  if (deps.profile?.role !== 'owner') {
    const alt = doc.getElementById(SECTION_ID);
    if (alt) alt.hidden = true;
    return;
  }
  stilEinmal(doc);
  const sec = sectionFinden(doc);
  if (!sec) return;
  sec.hidden = false;
  const body = sec.querySelector('.settings-section-body');
  const zustand = { daten: null, preset: null };

  const laden = async () => {
    body.textContent = '';
    body.append(el(doc, 'p', { class: 'mv-text', text: 'Wird geladen …' }));
    try {
      zustand.daten = await anfrage(deps, 'GET', '/mailversand');
      const z = zustand.daten.einstellung;
      zustand.preset = z?.modus === 'smtp' ? z.preset : null;
      zeichnen();
      renderMailversandBanner(zustand.daten, deps, doc);
    } catch (e) {
      body.textContent = '';
      body.append(el(doc, 'p', { class: 'mv-fehler', text: 'Die E-Mail-Einstellung konnte nicht geladen werden. Bitte die Seite neu laden.' }));
    }
  };

  const zeichnen = () => {
    const d = zustand.daten;
    body.textContent = '';
    if (d.verfuegbar === false) {
      body.append(statusKarte(d), el(doc, 'p', { class: 'mv-text', id: 'mvNichtVerfuegbar', text: 'Das Verbinden eines eigenen Postfachs wird mit dem nächsten Update freigeschaltet.' }));
      return;
    }
    body.append(statusKarte(d), auswahl(d));
    if (zustand.preset) body.append(formular(d, zustand.preset));
  };

  const statusKarte = (d) => {
    const s = statusInfo(d);
    const z = d.einstellung;
    const badge = { ok: 'badge badge-green', fehler: 'badge badge-red', offen: 'badge badge-yellow', aus: 'badge badge-gray' }[s.stufe];
    const karte = el(doc, 'div', { class: 'mv-karte', id: 'mvStatusKarte', 'data-stufe': s.stufe },
      el(doc, 'div', { class: 'mv-kopf' },
        el(doc, 'span', { class: { ok: 'status-dot connected', fehler: 'status-dot', offen: 'status-dot mv-punkt-offen', aus: 'status-dot mv-punkt-neutral' }[s.stufe], 'aria-hidden': 'true' }),
        el(doc, 'span', { class: 'mv-titel', text: 'Status' }),
        el(doc, 'span', { class: badge, text: s.titel }),
      ),
      s.text ? el(doc, 'p', { class: 'mv-text', text: s.text }) : null,
    );
    if (s.stufe === 'fehler' && d.fehler?.hinweis) karte.append(el(doc, 'p', { class: 'mv-tipp', text: d.fehler.hinweis }));
    if (z?.letzter_test_at) {
      karte.append(el(doc, 'p', { class: 'mv-text',
        text: `Letzte Testmail: ${datumZeit(z.letzter_test_at)} — ${z.letzter_test_ok ? 'erfolgreich' : 'fehlgeschlagen'}` }));
    }
    if (d.env && z?.modus !== 'smtp') {
      karte.append(el(doc, 'p', { class: 'mv-text', text: 'Diese Einstellung stammt aus der Installation. Sie können hier stattdessen ein eigenes Postfach verbinden.' }));
    }
    if (!d.verschluesselung) {
      karte.append(el(doc, 'p', { class: 'mv-fehler', text: 'Auf diesem Server fehlt der Schlüssel zum sicheren Speichern von Passwörtern. Bitte den Support kontaktieren.' }));
    }
    const knoepfe = el(doc, 'div', { class: 'mv-knoepfe' });
    if (testMoeglich(d)) knoepfe.append(el(doc, 'button', { type: 'button', class: 'btn-ghost', id: 'mvTestBtn', text: 'Testmail senden', onclick: testmail }));
    if (z?.modus === 'smtp') knoepfe.append(el(doc, 'button', { type: 'button', class: 'btn-danger', id: 'mvTrennenBtn', text: 'Trennen', onclick: () => trennen(false) }));
    else if (d.google?.verbunden && !d.kutu) knoepfe.append(el(doc, 'button', { type: 'button', class: 'btn-danger', id: 'mvTrennenBtn', text: 'Gmail trennen', onclick: () => trennen(true) }));
    if (knoepfe.childElementCount) karte.append(knoepfe);
    return karte;
  };

  const auswahl = (d) => {
    const wrap = el(doc, 'div', {},
      el(doc, 'p', { class: 'mv-text', text: d.einstellung?.modus === 'smtp' ? 'Anbieter ändern:' : 'Mit welchem Anbieter versenden Sie E-Mails?' }));
    const kacheln = el(doc, 'div', { class: 'mv-kacheln', role: 'group', 'aria-label': 'E-Mail-Anbieter' });
    for (const key of ANBIETER_REIHENFOLGE) {
      const p = d.presets?.[key];
      if (!p) continue;
      kacheln.append(el(doc, 'button', {
        type: 'button', class: 'mv-kachel', 'data-preset': key, 'aria-pressed': String(zustand.preset === key), text: p.name,
        onclick: () => { zustand.preset = key; zeichnen(); doc.getElementById('mvEmail')?.focus(); },
      }));
    }
    wrap.append(kacheln);
    return wrap;
  };

  const formular = (d, preset) => {
    const z = d.einstellung?.modus === 'smtp' ? d.einstellung : null;
    const gleicherAnbieter = z && z.preset === preset;
    const form = el(doc, 'form', { class: 'mv-karte', id: 'mvFormular', novalidate: true });
    form.append(el(doc, 'div', { class: 'mv-titel', text: d.presets[preset].name }));

    if (preset === 'outlook') form.append(el(doc, 'p', { class: 'mv-tipp', text: MICROSOFT_TEXT }));
    if (preset === 'gmail') {
      if (d.google?.verfuegbar && !d.kutu) {
        form.append(
          el(doc, 'p', { class: 'mv-text', text: 'Am einfachsten: mit Ihrem Google-Konto anmelden.' }),
          el(doc, 'div', { class: 'mv-knoepfe' }, el(doc, 'button', { type: 'button', class: 'btn-primary', id: 'mvGoogleBtn', text: 'Mit Google verbinden', onclick: mitGoogle })),
          el(doc, 'p', { class: 'mv-text', text: 'Oder per App-Passwort:' }),
        );
      }
      form.append(el(doc, 'ol', { class: 'mv-schritte' }, GMAIL_SCHRITTE.map(([t, link]) => el(doc, 'li', {},
        t, link ? ' ' : null, link ? el(doc, 'a', { href: link, target: '_blank', rel: 'noopener noreferrer', text: 'Öffnen ↗' }) : null))));
    } else if (d.hinweise?.[preset] && preset !== 'outlook') {
      form.append(el(doc, 'p', { class: 'mv-tipp', text: `Tipp — ${d.hinweise[preset]}` }));
    }

    const feld = (id, label, input, hinweis) => el(doc, 'div', { class: 'form-group' },
      el(doc, 'label', { class: 'form-label', for: id, text: label }), input, hinweis ? el(doc, 'div', { class: 'form-hint', text: hinweis }) : null);
    const vorgabe = d.vorgaben || {};
    form.append(feld('mvEmail', 'E-Mail-Adresse (Absender)', el(doc, 'input', {
      class: 'form-input', id: 'mvEmail', type: 'email', autocomplete: 'email', required: true,
      value: z?.absender_email || vorgabe.absender_email || '' })));
    if (preset === 'andere') {
      form.append(
        feld('mvHost', 'Postausgangsserver (SMTP)', el(doc, 'input', { class: 'form-input', id: 'mvHost', placeholder: 'smtp.ihr-anbieter.de', value: z?.preset === 'andere' ? z.smtp_host || '' : '' })),
        el(doc, 'div', { class: 'form-row' },
          feld('mvPort', 'Port', el(doc, 'input', { class: 'form-input', id: 'mvPort', type: 'number', min: 1, max: 65535, value: z?.preset === 'andere' ? z.smtp_port || 587 : 587 })),
          feld('mvSicherheit', 'Verschlüsselung', (() => {
            const s = el(doc, 'select', { class: 'form-select form-input', id: 'mvSicherheit' },
              el(doc, 'option', { value: 'starttls', text: 'STARTTLS (meist Port 587)' }),
              el(doc, 'option', { value: 'ssl', text: 'SSL/TLS (meist Port 465)' }));
            s.value = z?.preset === 'andere' && z.smtp_sicherheit ? z.smtp_sicherheit : 'starttls';
            return s;
          })())),
        feld('mvBenutzer', 'Benutzername', el(doc, 'input', { class: 'form-input', id: 'mvBenutzer', autocomplete: 'username', placeholder: 'meist die E-Mail-Adresse', value: z?.preset === 'andere' ? z.smtp_benutzer || '' : '' })),
      );
    }
    const pwGespeichert = gleicherAnbieter && z.passwortGespeichert;
    form.append(feld('mvPasswort', preset === 'gmail' ? 'App-Passwort' : 'Passwort', el(doc, 'input', {
      class: 'form-input', id: 'mvPasswort', type: 'password', autocomplete: 'new-password',
      placeholder: pwGespeichert ? 'gespeichert — leer lassen zum Behalten' : '' }),
    'Wird verschlüsselt gespeichert und nie angezeigt.'));
    form.append(feld('mvName', 'Angezeigter Name', el(doc, 'input', {
      class: 'form-input', id: 'mvName', maxlength: 120, value: z?.absender_name || vorgabe.absender_name || '' }),
    'So sehen Patienten den Absender, z. B. den Namen Ihrer Praxis.'));
    const meldung = el(doc, 'div', { id: 'mvMeldung', role: 'status', 'aria-live': 'polite' });
    const speichernBtn = el(doc, 'button', { type: 'submit', class: 'btn-primary', id: 'mvSpeichernBtn', text: 'Speichern', disabled: !d.verschluesselung });
    form.append(meldung, el(doc, 'div', { class: 'mv-knoepfe' }, speichernBtn,
      el(doc, 'button', { type: 'button', class: 'btn-ghost', text: 'Abbrechen', onclick: () => { zustand.preset = z?.preset || null; zeichnen(); } })));
    form.addEventListener('submit', (ev) => { ev.preventDefault(); speichern(preset, speichernBtn, meldung); });
    return form;
  };

  const wert = (id) => doc.getElementById(id)?.value ?? '';

  const speichern = async (preset, btn, meldung) => {
    const koerper = anfrageKoerper(preset, {
      absender_email: wert('mvEmail'), absender_name: wert('mvName'), passwort: wert('mvPasswort'),
      smtp_host: wert('mvHost'), smtp_port: wert('mvPort'), smtp_sicherheit: wert('mvSicherheit'), smtp_benutzer: wert('mvBenutzer'),
    });
    btn.disabled = true; btn.textContent = 'Verbindung wird geprüft …';
    meldung.textContent = '';
    try {
      const r = await anfrage(deps, 'PUT', '/mailversand', koerper);
      if (r.verbunden) {
        deps.showToast?.('Postfach verbunden. Senden Sie zur Kontrolle eine Testmail.', 'success');
        await laden();
      } else {
        await laden();
        deps.showToast?.('Gespeichert, aber die Anmeldung beim Mailserver ist fehlgeschlagen.', 'error');
      }
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Speichern';
      meldung.append(el(doc, 'p', { class: 'mv-fehler', text: e.message }));
    }
  };

  const testmail = async (ev) => {
    const btn = ev.currentTarget;
    btn.disabled = true; btn.textContent = 'Wird gesendet …';
    try {
      const r = await anfrage(deps, 'POST', '/mailversand/test');
      deps.showToast?.(`Testmail an ${r.gesendetAn} gesendet. Bitte im Posteingang (und Spam-Ordner) nachsehen.`, 'success');
    } catch (e) {
      deps.showToast?.(e.daten?.hinweis ? `${e.message} ${e.daten.hinweis}` : e.message, 'error');
    }
    await laden();
  };

  const trennen = async (gmail) => {
    const ok = await deps.showConfirmModal?.({
      title: gmail ? 'Gmail trennen?' : 'Postfach trennen?',
      message: 'Danach werden keine E-Mails mehr verschickt. Praxura stellt sie stattdessen als Entwurf oder PDF bereit. Das gespeicherte Passwort wird gelöscht.',
      confirmText: 'Trennen', variant: 'danger',
    });
    if (deps.showConfirmModal && !ok) return;
    try {
      await anfrage(deps, 'DELETE', gmail ? '/mailversand?gmail=1' : '/mailversand');
      if (gmail && deps.profile) deps.profile.b2b_from_email = null;
      deps.showToast?.('Postfach getrennt.', 'success');
      zustand.preset = null;
      await laden();
    } catch (e) {
      deps.showToast?.(e.message, 'error');
    }
  };

  const mitGoogle = async () => {
    // Bestehender OAuth-Weg (server.js /api/gmail/connect); ?ziel=mailversand → Rücksprung in diese Einstellung.
    const token = await deps.getToken();
    if (!token) return;
    globalThis.location.href = `${deps.apiBase}/gmail/connect?ziel=mailversand&token=${encodeURIComponent(token)}`;
  };

  laden();
}

/** Dashboard-weiter Hinweis bei unterbrochenem Postfach (Muster: renderOwnerCertExpiryBanner). Nur Inhaber. */
export function renderMailversandBanner(daten, deps, doc = document) {
  let banner = doc.getElementById('mailversand-banner');
  const s = statusInfo(daten);
  const zeigen = deps.profile?.role === 'owner' && daten?.einstellung?.modus === 'smtp' && s.stufe === 'fehler';
  if (!zeigen) { if (banner) banner.hidden = true; return; }
  if (!banner) {
    const anker = doc.getElementById('ik-missing-banner');
    if (!anker) return;
    banner = el(doc, 'div', { id: 'mailversand-banner', class: 'dash-banner pastdue', role: 'alert' });
    anker.after(banner);
  }
  banner.textContent = '';
  banner.append(
    el(doc, 'div', { class: 'dash-banner-content' },
      el(doc, 'strong', { text: 'E-Mail-Versand unterbrochen' }),
      el(doc, 'p', { text: 'Das Postfach der Praxis nimmt keine Verbindung an. Patienten-E-Mails werden gerade nicht verschickt.' })),
    el(doc, 'button', { type: 'button', class: 'dash-banner-action', text: 'Einstellungen öffnen', onclick: () => globalThis.gehZuEinstellung?.(SECTION_ID) }),
  );
  banner.hidden = false;
}
