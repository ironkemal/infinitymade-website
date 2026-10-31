// Versand über das EIGENE Gmail-Konto der Praxis (OAuth, Scope gmail.send).
//
// Warum eine eigene Datei: vorher lag das nur in server.js (/api/gmail/send) und
// konnte keinen Anhang. Die Rechnung an den Patienten (31.10.2026, P1) braucht
// ihn — im SaaS ist das der einzige erlaubte Weg (compliance/LEGAL_DECISIONS.md
// 2026-10-31: Absender und Anbieter ist die Praxis, nicht Praxura).
// Inhalt, Empfänger und Anhang werden NIE geloggt.

const CRLF = '\r\n';

function ohneZeilenumbruch(s) {
  return String(s || '').replace(/[\r\n]+/g, ' ').trim();
}

function b64Wort(s) {
  return `=?UTF-8?B?${Buffer.from(ohneZeilenumbruch(s)).toString('base64')}?=`;
}

function b64Zeilen(buf) {
  return buf.toString('base64').replace(/.{1,76}/g, (z) => z + CRLF).trimEnd();
}

/**
 * RFC-2822-Nachricht, mit Anhängen als multipart/mixed.
 * @param {{from:string,to:string,subject:string,text:string,replyTo?:string,
 *          attachments?:Array<{filename:string,content:Buffer,contentType?:string}>}} m
 */
export function baueMimeNachricht({ from, to, subject, text, replyTo, attachments = [] }) {
  const kopf = [
    `From: ${ohneZeilenumbruch(from)}`,
    `To: ${ohneZeilenumbruch(to)}`,
    ...(replyTo ? [`Reply-To: ${ohneZeilenumbruch(replyTo)}`] : []),
    `Subject: ${b64Wort(subject)}`,
    'MIME-Version: 1.0',
  ];
  const textTeil = Buffer.from(String(text || ''), 'utf8');
  if (!attachments.length) {
    return [...kopf, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64Zeilen(textTeil)].join(CRLF);
  }
  const grenze = `praxura-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const teile = [
    [`--${grenze}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64Zeilen(textTeil)].join(CRLF),
    ...attachments.map((a) => {
      const name = ohneZeilenumbruch(a.filename).replace(/"/g, '');
      return [`--${grenze}`, `Content-Type: ${a.contentType || 'application/octet-stream'}; name="${name}"`,
        `Content-Disposition: attachment; filename="${name}"`, 'Content-Transfer-Encoding: base64', '',
        b64Zeilen(Buffer.isBuffer(a.content) ? a.content : Buffer.from(a.content))].join(CRLF);
    }),
  ];
  return [...kopf, `Content-Type: multipart/mixed; boundary="${grenze}"`, '', ...teile, `--${grenze}--`, ''].join(CRLF);
}

/** Fehler mit Code, den Aufrufer an die Oberfläche weitergeben. */
function fehler(code, status, text) {
  const e = new Error(text);
  e.code = code; e.status = status;
  return e;
}

/**
 * Sendet über das Gmail-Konto von `userId`. Wirft mit e.code:
 *   GMAIL_NICHT_VERBUNDEN — kein Token / keine Absenderadresse hinterlegt
 *   gmail_reauth_required — Token tot (wird gelöscht, Dashboard fordert Neuverbindung)
 *   GMAIL_FEHLER          — Gmail-API hat abgelehnt
 */
export async function sendeUeberGmail({ supabase, newOAuthClient, fetchWithTimeout, userId, to, subject, text, attachments = [], senderName, replyTo }) {
  const [{ data: profile, error: pErr }, { data: gmailToken }] = await Promise.all([
    supabase.from('profiles').select('b2b_from_email').eq('id', userId).single(),
    supabase.rpc('get_gmail_token', { p_user_id: userId }),
  ]);
  if (pErr || !profile) throw fehler('GMAIL_NICHT_VERBUNDEN', 400, 'Profil nicht gefunden');
  if (!gmailToken || !profile.b2b_from_email) {
    throw fehler('GMAIL_NICHT_VERBUNDEN', 400, 'No Gmail token — please reconnect Gmail in B2B setup');
  }
  const oauth = newOAuthClient();
  oauth.setCredentials({ refresh_token: gmailToken });
  let credentials;
  try {
    ({ credentials } = await oauth.refreshAccessToken());
  } catch (refreshErr) {
    // Refresh token dead (invalid_grant): it can never recover — clear it so the
    // dashboard stops showing "connected" and prompts a reconnect.
    console.error('[gmail] refresh failed, clearing dead token:', refreshErr?.message || '');
    await supabase.rpc('clear_gmail_token', { p_user_id: userId });
    throw fehler('gmail_reauth_required', 401, 'Gmail token expired — please reconnect Gmail in B2B setup');
  }
  const from = senderName ? `${b64Wort(senderName)} <${profile.b2b_from_email}>` : profile.b2b_from_email;
  const raw = baueMimeNachricht({ from, to, subject, text, replyTo, attachments });
  const encoded = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const res = await fetchWithTimeout('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + credentials.access_token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: encoded }),
  }, 20000);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw fehler('GMAIL_FEHLER', 502, json.error?.message || 'Gmail API error');
  return { messageId: json.id };
}
