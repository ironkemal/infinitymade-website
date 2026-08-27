// Abrechnungs-Hindernisse und ihre bewusste Übersteuerung.
//
// Zwei Dinge liegen hier zusammen, weil sie dieselbe Frage beantworten:
// „darf dieses Rezept in die Kassenabrechnung?" — die Prüfung und der Weg,
// eine Prüfung begründet zu übergehen.
//
// Zum Therapiebericht, weil es der einzige übersteuerbare Punkt ist:
// Das Kreuz auf der Verordnung sagt nur, dass der Verordner einen Bericht
// wollte (HeilM-RL § 16 Abs. 7 — er „kann" anfordern). Podologie §125 Anlage 3 d)
// sagt ausdrücklich: fehlt das Kreuz, ist der Bericht nicht erforderlich, und ein
// falsch gesetztes Kreuz darf im Einvernehmen mit der Ärztin oder dem Arzt ohne
// erneute Unterschrift nachträglich korrigiert werden. In der Praxis bleibt das
// Kreuz sehr oft schlicht stehen. Ein harter Riegel hält deshalb Geld auf, das
// der Praxis zusteht.
//
// ⚠️ Übersteuert wird nur „es wurde kein Bericht geschrieben". Das
// ZHE-Kennzeichen „Therapiebericht angefordert" (Anlage 1 TP5 V21 §5.5.3.3
// S. 70) bleibt unberührt und geht weiter als „1" in die DTA — es trägt das
// Kreuz der Verordnung. Würde es mitgelöscht, widerspräche die Datei dem
// Urbeleg, und die Kasse setzt nach §7.4.3 ab.
//
// ⚠️ Die abrechenbaren Berichtspositionen (Physio X1906, Podologie 78530)
// werden dabei NICHT erzeugt. X1906 setzt eine schriftliche Anforderung voraus,
// die der Abrechnung beizulegen ist — ein Kreuz allein genügt nicht
// (§125 Physio Anlage 2). „Ignorieren" heisst also auch: diese Position wird
// nicht abgerechnet.

/**
 * Ist für dieses Rezept ein Bericht angefordert, aber keiner geschrieben?
 *
 * ⚠️ Zwilling: `api-backend/billing/api/abrechnung.routes.js:482` und `:585`
 * prüfen dieselbe Bedingung noch einmal. Das ist Absicht — dieses Modul geht in
 * den Browser, die Route in den Container, eine gemeinsame Importkette gibt es
 * nicht (und G8 will keine neue). Wer hier etwas ändert, muss dort mitziehen:
 * käme z. B. ein vierter `bericht_status` dazu, liesse die Oberfläche durch, was
 * der Server abweist — und der Fehler fiele erst bei der DTA-Erzeugung auf.
 */
export function istBerichtOffen(rx) {
  return !!(rx && rx.bericht_angefordert && rx.bericht_status !== 'erledigt');
}

/**
 * Prüft ein Rezept auf Abrechnungshindernisse.
 *
 * Aus `dashboard.js` hierher gezogen, unverändert in der Logik. `isReportMissing`
 * ist seit der Übersteuerbarkeit ein *Hinweis*, kein Riegel mehr — wer das Feld
 * auswertet, muss es entsprechend behandeln (siehe `istHarterRiegel`).
 */
export function checkPrescriptionCompliance(rx, therapistCertsMap) {
  const issues = {
    has14DayGap: false,
    gapDays: 0,
    gapDates: '',
    missingCert: false,
    missingCertName: '',
    missingCertDate: '',
    isReportMissing: istBerichtOffen(rx),
  };

  const doneSessions = (rx.prescription_sessions || [])
    .filter(s => s.status === 'done');

  // Check 14-day gap
  if (doneSessions.length > 1) {
    const sorted = [...doneSessions].sort((a, b) => new Date(a.done_at) - new Date(b.done_at));
    for (let k = 1; k < sorted.length; k++) {
      const prevD = new Date(sorted[k - 1].done_at);
      const currD = new Date(sorted[k].done_at);
      const diffTime = currD - prevD;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 14) {
        issues.has14DayGap = true;
        issues.gapDays = diffDays;
        issues.gapDates = `${new Date(sorted[k - 1].done_at).toLocaleDateString('de-DE')} - ${new Date(sorted[k].done_at).toLocaleDateString('de-DE')}`;
        break; // Show first gap
      }
    }
  }

  // Check therapist certificates
  for (const s of doneSessions) {
    const booking = s.bookings || s.booking_id || {};
    const service = booking.services || booking.service_id || booking.service || {};
    const requiredCert = service.required_certificate;
    if (requiredCert) {
      const therapistId = booking.user_id;
      const certSet = therapistCertsMap ? therapistCertsMap.get(therapistId) : null;
      if (!therapistId || !certSet || !certSet.has(requiredCert)) {
        issues.missingCert = true;
        issues.missingCertName = requiredCert;
        issues.missingCertDate = s.done_at ? new Date(s.done_at).toLocaleDateString('de-DE') : '';
        break;
      }
    }
  }

  return issues;
}

/**
 * Die Hindernisse, die NICHT übersteuert werden dürfen.
 *
 * Fehlendes Zertifikat und die 14-Tage-Unterbrechung bleiben harte Riegel: das
 * eine ist eine Frage der Leistungsberechtigung, das andere macht die Verordnung
 * nach HeilM-RL § 16 Abs. 4 ungültig. Beides lässt sich nicht durch eine
 * Begründung heilen.
 */
export function istHarterRiegel(issues) {
  return !!(issues && (issues.missingCert || issues.has14DayGap));
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

/**
 * Fragt die bewusste Übersteuerung ab.
 *
 * @param {Array<{id:string, name:string, status:string}>} betroffene
 * @returns {Promise<{ids:string[], grund:string}|null>} null = abgebrochen
 */
export function frageBerichtFreigabe(betroffene) {
  if (!betroffene || !betroffene.length) return Promise.resolve({ ids: [], grund: '' });

  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.45);' +
      'display:flex;align-items:center;justify-content:center;padding:16px;';

    const liste = betroffene.map(b =>
      `<li style="margin:2px 0;">${esc(b.name)} <span style="color:var(--text-muted);">(${esc(b.status || 'offen')})</span></li>`
    ).join('');

    overlay.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="tbFreigabeTitel"
           style="background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);
                  border-radius:12px;max-width:520px;width:100%;max-height:90vh;overflow:auto;padding:20px;">
        <h3 id="tbFreigabeTitel" style="margin:0 0 8px;font-size:17px;">Therapiebericht fehlt</h3>
        <p style="margin:0 0 10px;font-size:14px;line-height:1.5;">
          Bei ${betroffene.length === 1 ? 'diesem Rezept' : `diesen ${betroffene.length} Rezepten`}
          hat die Ärztin oder der Arzt einen Therapiebericht angekreuzt, geschrieben wurde keiner.
        </p>
        <ul style="margin:0 0 12px;padding-left:20px;font-size:13px;">${liste}</ul>
        <p style="margin:0 0 12px;font-size:12px;color:var(--text-muted);line-height:1.5;">
          Sie können trotzdem abrechnen. Die Kennzeichnung „Bericht angefordert“ bleibt
          dabei unverändert in der Datei. Eine abrechenbare Berichtsposition
          (X1906 / 78530) wird <strong>nicht</strong> erzeugt. Die Entscheidung wird
          mit Ihrem Namen protokolliert.
        </p>
        <label style="display:block;font-size:13px;margin-bottom:6px;">Begründung (optional)</label>
        <input id="tbFreigabeGrund" type="text" maxlength="500"
               placeholder="z. B. Kreuz versehentlich stehen geblieben"
               style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:6px;
                      border:1px solid var(--border);background:var(--bg-card);color:var(--text-main);font-size:13px;" />
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
          <button id="tbFreigabeAbbruch" type="button"
                  style="padding:8px 14px;border-radius:6px;border:1px solid var(--border);
                         background:var(--bg-card);color:var(--text-main);font-size:13px;cursor:pointer;">Abbrechen</button>
          <button id="tbFreigabeOk" type="button" class="btn-primary"
                  style="padding:8px 14px;font-size:13px;cursor:pointer;">Trotzdem abrechnen</button>
        </div>
      </div>`;

    const schliessen = (wert) => {
      document.removeEventListener('keydown', beiTaste);
      overlay.remove();
      resolve(wert);
    };
    const beiTaste = (e) => {
      if (e.key === 'Escape') schliessen(null);
      if (e.key === 'Enter' && document.activeElement?.id === 'tbFreigabeGrund') bestaetigen();
    };
    const bestaetigen = () => schliessen({
      ids: betroffene.map(b => b.id),
      grund: (overlay.querySelector('#tbFreigabeGrund')?.value || '').trim(),
    });

    overlay.addEventListener('click', e => { if (e.target === overlay) schliessen(null); });
    overlay.querySelector('#tbFreigabeAbbruch').addEventListener('click', () => schliessen(null));
    overlay.querySelector('#tbFreigabeOk').addEventListener('click', bestaetigen);
    document.addEventListener('keydown', beiTaste);

    document.body.appendChild(overlay);
    overlay.querySelector('#tbFreigabeGrund')?.focus();
  });
}
