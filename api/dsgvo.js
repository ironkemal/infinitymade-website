// GET  /api/dsgvo?action=export  — DSGVO Art. 15 Datenauskunft
// POST /api/dsgvo?action=delete  — DSGVO Art. 17 Recht auf Löschung
//
// ─────────────────────────────────────────────────────────────────────────────
// STAND 28.08.2026 — was hier geprüft ist und was offen bleibt
// ─────────────────────────────────────────────────────────────────────────────
// Die Löschkette wurde gegen die laufende Datenbank durchgespielt: dieselbe
// Reihenfolge, dieselbe Spaltenwahl wie unten, in einer Transaktion, die am
// Ende zurückgerollt wurde. Kein Datensatz wurde dabei verändert.
//
// ✅ Läuft durch: Einzelpraxis ohne festgeschriebene Rechnung. Die Probe kam bis
//    `DELETE FROM profiles` und hätte das Profil entfernt. Übersprungen wurden
//    nur die fünf Tabellen ohne `owner_id`/`user_id`, die ihre Eltern per
//    CASCADE ohnehin mitnehmen.
//
// ⛔ ZWEI SPERREN BLEIBEN — beide sind Rechtsfragen, keine Programmierfehler,
//    und beide sind bewusst NICHT hier gelöst:
//
//    1. Festgeschriebene Rechnung (GoBD). Der Trigger `invoice_festschreibung()`
//       weist die Anonymisierung oben mit 23514 ab („Festgeschriebene Rechnung
//       … kann inhaltlich nicht geändert werden"). Weil `invoices.patient_id`
//       dadurch stehen bleibt und der Fremdschlüssel `invoices_patient_id_fkey`
//       NO ACTION ist, lässt sich anschließend die Patiententabelle `leads` gar
//       nicht löschen (23503). Für jede Praxis, die je eine Rechnung
//       festgeschrieben hat, scheitert die Löschung also an der Patientenakte.
//       Auflösung erfordert eine Abwägung Art. 17 Abs. 3 lit. b gegen § 147 AO /
//       § 14b UStG: darf der Trigger das Nullen reiner Personenfelder zulassen,
//       wenn die buchhalterischen Beträge unangetastet bleiben? → legal-de.
//
//    2. Mitarbeiter. `profiles.owner_id` zeigt mit NO ACTION auf `profiles`;
//       solange Angestellte am Inhaber hängen, lässt sich dessen Profil nicht
//       löschen. Was mit den Konten der Angestellten geschehen soll, wenn die
//       Praxis gelöscht wird, ist eine Produkt- und Rechtsfrage. → legal-de.
//
// Bis dahin gilt: der Endpunkt sagt ehrlich, dass er nicht fertig geworden ist
// (siehe Antwort unten), statt wie bisher bedingungslos `success: true` zu
// melden. Eine Löschung, die man für erledigt hält, wird nie nachgefasst.

import { getAuthedUser, adminFetch, adminAuthFetch, json } from './_lib/auth.js';
import { stripeRequest } from './_lib/stripe.js';

// ─── Export ──────────────────────────────────────────────────────────────────

const USER_TABLES = [
  { table: 'profiles',                     filter: 'id'        },
  { table: 'user_preferences',             filter: 'user_id'   },
  { table: 'businesses',                   filter: 'owner_id'  },
  { table: 'calendar_integrations',        filter: 'user_id'   },
  { table: 'services',                     filter: 'owner_id'  },
  // ✅ 28.08.2026 GELÖST (DB-Zugang). Am 27.08. stand hier „vier Tabellen ohne
  //    owner_id/user_id, braucht eine eingebettete Abfrage". Gegen die laufende
  //    DB nachgesehen: es sind DREI, nicht vier — `employee_services` und
  //    `employee_business_assignments` haben sehr wohl `employee_id` und
  //    funktionierten die ganze Zeit. Die drei echten sind unten mit `select`
  //    eingebettet. Die Verknüpfung ist bei allen dreien eindeutig (genau ein
  //    Fremdschlüssel auf die Elterntabelle), es kann also keine fremde Zeile
  //    hereinrutschen — das war die Sorge, die den Fix im August aufhielt.
  // `business_services` ist am 28.08.2026 gedroppt worden (Konsey, Option B).
  //   Die Auskunft verliert dadurch nichts: die Tabelle war ein Spiegel von
  //   `services` (Zeile darueber), enthielt keine Patientendaten, sondern nur
  //   Leistungsnamen und Preise der Praxis - und ihre Zeilen waren wegen der
  //   Policy `auth.uid() = business_id` fuer die Praxis ohnehin unsichtbar.
  { table: 'employee_services',            filter: 'employee_id' },
  { table: 'working_hours',                filter: 'user_id'   },
  { table: 'breaks',                       filter: 'user_id'   },
  { table: 'custom_days',                  filter: 'owner_id'  },
  { table: 'time_offs',                    filter: 'owner_id'  },
  { table: 'bookings',                     filter: 'owner_id'  },
  { table: 'patient_notes',                filter: 'owner_id'  },
  { table: 'anamnese',                     filter: 'owner_id'  },
  { table: 'prescriptions',                filter: 'owner_id'  },
  // `prescription_sessions`/`prescription_validations` haben kein `owner_id`.
  // Zuordnung über `prescription_id`; `!inner` sorgt dafür, dass nur Zeilen
  // durchkommen, deren Verordnung dem anfragenden Nutzer gehört.
  { table: 'prescription_sessions',        filter: 'prescriptions.owner_id',
    select: '*,prescriptions!inner(owner_id)' },
  { table: 'prescription_validations',     filter: 'prescriptions.owner_id',
    select: '*,prescriptions!inner(owner_id)' },
  { table: 'invoices',                     filter: 'owner_id'  },
  { table: 'abrechnung',                   filter: 'owner_id'  },
  { table: 'zuzahlung_befreiung',          filter: 'owner_id'  },
  { table: 'leads',                        filter: 'owner_id'  },
  { table: 'b2b_contacts',                 filter: 'owner_id'  },
  { table: 'email_logs',                   filter: 'owner_id'  },
  { table: 'feedbacks',                    filter: 'user_id'   },
  { table: 'ai_audit_log',                 filter: 'user_id'   },
  { table: 'chatbot_usage',                filter: 'owner_id'  },
  { table: 'vehicles',                     filter: 'owner_id'  },
  { table: 'fahrten',                      filter: 'owner_id'  },
  { table: 'aerzte',                       filter: 'owner_id'  },
  { table: 'ueberweisungen',               filter: 'owner_id'  },
  { table: 'referral_drafts',              filter: 'owner_id'  },
  { table: 'terapeut_zertifikat',          filter: 'owner_id'  },
  // `employee_groups` hat kein `owner_id`, nur `business_id`.
  { table: 'employee_groups',              filter: 'businesses.owner_id',
    select: '*,businesses!inner(owner_id)' },
  { table: 'employee_business_assignments',filter: 'employee_id' },
  { table: 'consent_log',                  filter: 'user_id'   },

  // ── 28.08.2026 ergänzt: alles unten fehlte in der Auskunft ──────────────
  // Gefunden durch einen Abgleich der Live-DB gegen diese Liste: jede Tabelle
  // in `public` mit `owner_id` oder `user_id`, die hier nicht vorkam. Der
  // Schwerpunkt der Lücke lag ausgerechnet auf der Podologie — also genau der
  // Fachrichtung, die gerade zuerst fertiggestellt wird, und auf der
  // vollständigen Patientenakte (Verordnungen, Behandlungen, Fußbefunde).
  // Eine Art.-15-Auskunft ohne diese Tabellen war schlicht unvollständig.
  { table: 'verordnungen',                 filter: 'owner_id'  },
  { table: 'podologie_behandlungen',       filter: 'owner_id'  },
  { table: 'fußstatus',                    filter: 'owner_id'  },
  { table: 'pat_fussbefund',               filter: 'owner_id'  },
  { table: 'messreihen',                   filter: 'owner_id'  },
  { table: 'patients',                     filter: 'owner_id'  },
  { table: 'patient_consents',             filter: 'owner_id'  },
  { table: 'prescription_documents',       filter: 'owner_id'  },
  { table: 'booking_requests',             filter: 'owner_id'  },
  { table: 'warteliste',                   filter: 'owner_id'  },
  { table: 'ausfallrechnungen',            filter: 'owner_id'  },
  { table: 'mahnungen',                    filter: 'owner_id'  },
  { table: 'belegliste',                   filter: 'owner_id'  },
  { table: 'nummernkreise',                filter: 'owner_id'  },
  { table: 'attendance',                   filter: 'owner_id'  },
  { table: 'document_vorlagen',            filter: 'owner_id'  },
  { table: 'data_sharing_settings',        filter: 'owner_id'  },
  // ⚠️ Namensfalle: `therapist_certificates` und `terapeut_zertifikat` sind
  //    ZWEI verschiedene Tabellen, beide existieren, beide werden benutzt.
  //    Bisher stand nur die zweite in dieser Liste.
  { table: 'therapist_certificates',       filter: 'owner_id'  },

  // Bewusst NICHT in der Auskunft, jeweils mit Grund:
  //   `kiosk_pins`        — Zugangsgeheimnis (PIN). Ein Hash in einer
  //                         herunterladbaren Datei bringt dem Betroffenen
  //                         nichts und vergrößert nur die Angriffsfläche.
  //   `data_access_log`   — Protokoll der Zugriffe, zugleich die Beweiskette
  //                         für genau diese Auskunft. Ob es hineingehört, ist
  //                         eine Frage an legal-de, keine Wegwerf-Entscheidung.
  //   `admin_users`       — unsere eigene Betreiber-Rolle, nicht die Daten des
  //                         Betroffenen.
  //   `scraper_data`      — Akquise-Rest aus der InfinityMade-Zeit.
  //   `accommodations`, `applications`, `trip_history`, `trip_plans`,
  //   `user_credits`      — Tabellen aus einem anderen Projekt, alle leer.
];

async function handleExport(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const { user, error } = await getAuthedUser(req);
  if (!user) return json(res, 401, { error: error || 'Unauthorized' });

  const userId = user.id;
  const data = {};
  const errors = {};

  for (const { table, filter, select } of USER_TABLES) {
    // `select` ist nur bei den drei eingebetteten Abfragen gesetzt; sonst `*`.
    const url = `/${encodeURIComponent(table)}?${filter}=eq.${encodeURIComponent(userId)}`
      + `&select=${encodeURIComponent(select || '*')}`;
    const { ok, data: rows, status } = await adminFetch(url);
    if (ok) {
      data[table] = rows || [];
    } else {
      // 27.08.2026: Bis dahin landete das nur in `errors` und niemand sah es.
      // Eine Art.-15-Auskunft, die stillschweigend Tabellen auslässt, ist
      // schlechter als eine, die sagt „hier fehlt etwas" — der Betroffene kann
      // sonst nicht wissen, dass er eine unvollständige Antwort bekommen hat.
      errors[table] = `status ${status}`;
      console.error(`[dsgvo] Auskunft unvollständig: ${table} (${filter}) -> ${status}`);
    }
  }

  const auth_meta = {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at,
    email_confirmed_at: user.email_confirmed_at,
    user_metadata: user.user_metadata || null,
  };

  const payload = {
    generated_at: new Date().toISOString(),
    user_id: userId,
    legal_basis: 'DSGVO Art. 15 (Recht auf Auskunft)',
    note: 'Vollständige Kopie der zu Ihrer Person gespeicherten Daten. Bei Fragen: support@praxura.de',
    auth: auth_meta,
    data,
    errors_per_table: Object.keys(errors).length ? errors : undefined,
  };

  res.setHeader('Content-Disposition', `attachment; filename="dsgvo-export-${userId}.json"`);
  return json(res, 200, payload);
}

// ─── Delete ──────────────────────────────────────────────────────────────────

const ANONYMIZE_TABLES = [
  { table: 'invoices', filter: 'owner_id', nullify: ['patient_name', 'patient_id', 'notes'] },
];

// Reihenfolge ist hier keine Kosmetik: Kinder vor Eltern, sonst blockiert ein
// Fremdschlüssel das Löschen und der Schritt scheitert still.
//
// ⚠️ 28.08.2026 gegen die Live-DB geprüft — die Liste war an zwei Stellen falsch:
//   1. Fünf Einträge (`employee_services`, `employee_groups`,
//      `employee_business_assignments`, `prescription_sessions`,
//      `prescription_validations`) haben WEDER `owner_id` noch `user_id`. Die
//      Schleife unten probiert genau diese zwei Spalten, bekam also 400 und
//      übersprang sie wortlos. Drei davon räumt der CASCADE-Fremdschlüssel
//      ohnehin ab; sie bleiben als Absicherung stehen, scheitern aber jetzt
//      hörbar statt still.
//   2. Ein ganzer Block patientennaher Fachtabellen fehlte — und weil mehrere
//      davon mit NO ACTION auf `profiles` zeigen, ist das Löschen des Profils
//      am Ende dieser Kette für jede echte Praxis fehlgeschlagen. Der Endpunkt
//      meldete trotzdem `success: true`. Das ist der ernsteste Teil des Befunds.
const DELETE_TABLES = [
  // Patientennahe Fachdaten zuerst: `verordnungen`, `podologie_behandlungen`,
  // `fußstatus`, `messreihen` und `booking_requests` zeigen mit NO ACTION auf
  // `profiles` und blockieren sonst das Löschen des Profils.
  'prescription_documents', 'mahnungen', 'ausfallrechnungen',
  'podologie_behandlungen', 'verordnungen',
  'messreihen', 'pat_fussbefund', 'fußstatus',
  'warteliste', 'booking_requests',

  'consent_log', 'ai_audit_log', 'chatbot_usage', 'feedbacks', 'email_logs',
  'patient_notes', 'anamnese', 'prescription_validations', 'prescription_sessions',
  'prescriptions', 'zuzahlung_befreiung', 'referral_drafts', 'ueberweisungen',
  'aerzte', 'b2b_contacts', 'leads', 'fahrten', 'vehicles', 'terapeut_zertifikat',
  'bookings', 'time_offs', 'breaks', 'custom_days', 'working_hours',
  'employee_services', 'services', 'calendar_integrations',

  // `booking_requests` oben muss vor `patients` weg (NO ACTION auf patients).
  'patients', 'therapist_certificates', 'kiosk_pins', 'nummernkreise',
  'document_vorlagen', 'data_sharing_settings', 'attendance',

  'employee_business_assignments', 'employee_groups', 'businesses', 'user_preferences',

  // ⛔ BEWUSST NICHT HIER, weil es eine Rechtsfrage ist und keine technische:
  //   `belegliste`      — Fremdschlüssel auf `profiles` ist RESTRICT, also
  //                       ausdrücklich als Sperre gebaut. GoBD/§ 147 AO.
  //   `patient_consents`— ebenfalls RESTRICT, und zusätzlich RESTRICT auf
  //                       `leads`: solange Einwilligungen stehen, lässt sich
  //                       nicht einmal die Patientenakte löschen. Das ist die
  //                       Nachweiskette der Einwilligung selbst.
  //   `abrechnung`      — § 302 SGB V / § 304 SGB V Aufbewahrung.
  //   `invoices`        — wird oben anonymisiert statt gelöscht (Absicht).
  // Art. 17 Abs. 3 lit. b lässt Aufbewahrungspflichten vorgehen, aber welche
  // dieser vier gelöscht, anonymisiert oder behalten werden muss, entscheidet
  // legal-de — nicht dieser Endpunkt und nicht nebenbei.
];

async function handleDelete(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const { confirm } = req.body || {};
  if (confirm !== 'LÖSCHEN') {
    return json(res, 400, {
      error: 'Bestätigung fehlt',
      message: 'Bitte senden Sie { "confirm": "LÖSCHEN" } um die Löschung zu bestätigen.',
    });
  }

  const { user, error } = await getAuthedUser(req);
  if (!user) return json(res, 401, { error: error || 'Unauthorized' });
  const userId = user.id;

  const { ok: rlOk, data: rlRows } = await adminFetch(
    `/data_access_log?user_id=eq.${encodeURIComponent(userId)}&action=eq.dsgvo_deletion&select=id&limit=1`
  );
  if (rlOk && Array.isArray(rlRows) && rlRows.length > 0) {
    return json(res, 429, { error: 'Ihr Konto befindet sich bereits im Löschprozess.' });
  }

  const log = { user_id: userId, started_at: new Date().toISOString(), steps: [] };

  {
    const { ok: profOk, data: profData } = await adminFetch(
      `/profiles?id=eq.${encodeURIComponent(userId)}&select=stripe_subscription_id,stripe_customer_id`,
      { method: 'GET' }
    );
    if (profOk && Array.isArray(profData) && profData.length > 0) {
      const { stripe_subscription_id, stripe_customer_id } = profData[0];
      if (stripe_subscription_id) {
        try {
          const { ok, status } = await stripeRequest(`/subscriptions/${stripe_subscription_id}`, { method: 'DELETE' });
          log.steps.push({ step: 'stripe:cancel_subscription', ok, status });
        } catch (err) {
          log.steps.push({ step: 'stripe:cancel_subscription', ok: false, error: err.message });
        }
      }
      if (stripe_customer_id) {
        try {
          const { ok, status } = await stripeRequest(`/customers/${stripe_customer_id}`, { method: 'DELETE' });
          log.steps.push({ step: 'stripe:delete_customer', ok, status });
        } catch (err) {
          log.steps.push({ step: 'stripe:delete_customer', ok: false, error: err.message });
        }
      }
    } else {
      log.steps.push({ step: 'stripe:profile_fetch', ok: profOk, note: 'no profile row or no stripe IDs' });
    }
  }

  for (const { table, filter, nullify } of ANONYMIZE_TABLES) {
    const patch = nullify.reduce((acc, col) => ({ ...acc, [col]: null }), {});
    const { ok, status } = await adminFetch(`/${table}?${filter}=eq.${encodeURIComponent(userId)}`, { method: 'PATCH', body: JSON.stringify(patch) });
    log.steps.push({ step: `anonymize:${table}`, ok, status });
  }

  // Bis 28.08.2026 verschwand ein Fehlschlag hier spurlos: griff weder
  // `owner_id` noch `user_id`, lief die innere Schleife durch und es wurde
  // NICHTS protokolliert. Eine Löschung, die die Hälfte stehen lässt, sah
  // deshalb aus wie eine vollständige.
  const uebersprungen = [];
  for (const table of DELETE_TABLES) {
    let erledigt = false;
    let letzter = null;
    for (const filter of ['owner_id', 'user_id']) {
      const { ok, status, data: fehler } = await adminFetch(
        `/${encodeURIComponent(table)}?${filter}=eq.${encodeURIComponent(userId)}`,
        { method: 'DELETE' }
      );
      letzter = { status, fehler };
      if (ok && status !== 404) {
        log.steps.push({ step: `delete:${table}:${filter}`, ok, status });
        erledigt = true;
        break;
      }
    }
    if (!erledigt) {
      uebersprungen.push(table);
      log.steps.push({
        step: `delete:${table}`,
        ok: false,
        status: letzter?.status ?? null,
        note: 'weder owner_id noch user_id griff — Zeilen können stehengeblieben sein',
        detail: letzter?.fehler ?? null,
      });
      console.error(`[dsgvo] Löschung unvollständig: ${table} -> ${letzter?.status}`);
    }
  }

  const { ok: pOk, status: pStatus } = await adminFetch(`/profiles?id=eq.${encodeURIComponent(userId)}`, { method: 'DELETE' });
  log.steps.push({ step: 'delete:profiles', ok: pOk, status: pStatus });
  if (!pOk) {
    console.error(`[dsgvo] Profilzeile NICHT gelöscht (${pStatus}) — Fremdschlüssel blockiert.`);
  }

  const { ok: aOk, status: aStatus } = await adminAuthFetch(`/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
  log.steps.push({ step: 'delete:auth_user', ok: aOk, status: aStatus });

  log.completed_at = new Date().toISOString();

  await adminFetch('/data_access_log', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId, owner_id: userId, action: 'dsgvo_deletion',
      method: 'POST', path: '/api/dsgvo', resource: 'profile',
      resource_id: userId, metadata: log,
    }),
  });

  // Vorher stand hier bedingungslos `success: true` — auch dann, wenn die
  // Profilzeile gar nicht gelöscht werden konnte. Jemandem zu sagen, seine
  // Daten seien weg, während sie noch da sind, ist der schlimmere Fehler von
  // beiden: er merkt es nicht und fragt nicht nach.
  const vollstaendig = pOk && uebersprungen.length === 0;
  if (vollstaendig) {
    return json(res, 200, {
      success: true,
      message: 'Ihre Daten wurden gelöscht. Abrechnungsdaten bleiben anonymisiert aus gesetzlicher Aufbewahrungspflicht (§ 147 AO, § 304 SGB V) gespeichert.',
      log,
    });
  }
  return json(res, 500, {
    success: false,
    message: 'Die Löschung ist nur teilweise durchgelaufen. Ihr Antrag ist protokolliert und '
      + 'wird manuell zu Ende geführt; bitte wenden Sie sich an support@praxura.de. '
      + 'Es wurde nichts unternommen, was Ihren Antrag zurücknimmt.',
    profil_geloescht: pOk,
    nicht_geloescht: uebersprungen,
    log,
  });
}

// ─── Router ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const action = req.query?.action || req.url?.split('?')[1]?.match(/action=([^&]+)/)?.[1];
  if (action === 'export') return handleExport(req, res);
  if (action === 'delete') return handleDelete(req, res);
  return json(res, 400, { error: 'action=export veya action=delete gerekli' });
}
