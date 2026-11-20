// Team & Rollen — nur Admin. Mitglieder, Rollen, Zugang an/aus, Rechte-Matrix.
// Konten entstehen weiter im Supabase-Panel (Signup bleibt AUS — das ist die
// eigentliche Sicherheitsgrenze); hier wird nur die Mitgliedschaft eingetragen.
import { sb, state, $, esc, toast, fail, openModal } from './app.js?v=20261120a';
import { ROLES, VIEWS, accessSummary, isAdmin } from './rollen.js?v=20261120a';
import { options, readFields, fld, inp, sel, pill } from './kit.js?v=20261120a';

let root;

export function mountTeam() {
  root = $('#view-team');
  render();
}

async function reloadMembers() {
  const { data, error } = await sb.from('ops_members').select('*').order('display_name');
  if (error) return fail('Mitglieder', error);
  state.members = data || [];
}

function render() {
  const ready = state.rolesReady;
  const roleKeys = Object.keys(ROLES);
  root.innerHTML = `
    <div class="page-head">
      <div><h1>Team &amp; Rollen</h1><p>Wer hat Zugang, mit welcher Rolle. Die Datenbank setzt die Grenzen durch, nicht nur die Oberfläche.</p></div>
      <div class="spacer"></div>
      <div class="page-actions">${ready && isAdmin() ? '<button class="btn btn-primary" id="mNew">+ Mitglied</button>' : ''}</div>
    </div>
    ${ready ? '' : `<div class="notice"><strong>Rollen sind noch nicht eingerichtet.</strong>
      <code>ops/schema-rollen-betrieb.sql</code> im Ops-Projekt ausführen — danach sind Kemal und Melih Admin
      und hier lassen sich weitere Rollen vergeben.</div>`}

    <div class="tbl-wrap" style="margin-bottom:20px"><table class="tbl" id="mTbl">
      <thead><tr><th>Mitglied</th><th>E-Mail</th><th>Rolle</th><th>Zugang</th><th>Farbe</th><th></th></tr></thead>
      <tbody>${state.members.map(m => `<tr data-m="${m.id}" style="cursor:default">
        <td><span class="chip"><i style="background:${esc(m.color)}"></i><span class="strong">${esc(m.display_name)}</span></span>
          ${m.id === state.me.id ? ' ' + pill('du', 'gold') : ''}</td>
        <td class="num">${esc(m.email)}</td>
        <td>${ready ? `<select data-k="role">${options(Object.fromEntries(roleKeys.map(r => [r, ROLES[r].label])), m.role)}</select>` : pill('Admin', 'gold')}</td>
        <td>${ready ? `<label class="chk-inline"><input type="checkbox" data-k="active" ${m.active !== false ? 'checked' : ''}><span>aktiv</span></label>` : '—'}</td>
        <td><input type="color" data-k="color" value="${esc(m.color || '#6b7280')}" ${ready ? '' : 'disabled'}></td>
        <td>${ready ? '<button class="btn btn-ghost" data-save>Speichern</button>' : ''}</td>
      </tr>`).join('')}</tbody></table></div>

    <div class="grid-2">
      <section class="panel">
        <div class="panel-head"><h2>Was sieht welche Rolle?</h2></div>
        <div style="overflow-x:auto"><table class="matrix">
          <thead><tr><th>Bereich</th>${roleKeys.map(r => `<th>${esc(ROLES[r].label)}</th>`).join('')}</tr></thead>
          <tbody>${VIEWS.map((v, i) => `<tr><td>${esc(v.label)}</td>${roleKeys.map(r => {
            const lv = accessSummary(r)[i].level;
            return `<td class="lv-${lv === '—' ? '' : lv}">${lv}</td>`;
          }).join('')}</tr>`).join('')}</tbody>
        </table></div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Neues Mitglied — so geht's</h2></div>
        <ol class="card-body" style="margin:0;padding-left:18px">
          <li>Supabase → Ops-Projekt → <em>Authentication → Users → Add user</em> (E-Mail + Passwort).
            Selbstregistrierung bleibt aus.</li>
          <li>Die angezeigte <em>User UID</em> kopieren.</li>
          <li>Hier <em>+ Mitglied</em> → UID, Name, Rolle eintragen.</li>
          <li>Beim Austritt: Haken <em>aktiv</em> entfernen — der Zugang ist sofort gesperrt, die Historie bleibt.</li>
        </ol>
        <p class="hint" style="margin:10px 0 0">Mindestens ein aktiver Admin bleibt immer — die Datenbank verhindert das Aussperren.</p>
        <div class="section-t" style="margin-top:14px">Rollen</div>
        <dl class="kv" style="margin-top:8px">${roleKeys.map(r => `<dt>${esc(ROLES[r].label)}</dt><dd>${esc(ROLES[r].hint)}</dd>`).join('')}</dl>
      </section>
    </div>`;

  root.querySelector('#mNew')?.addEventListener('click', newMember);
  root.querySelectorAll('[data-save]').forEach(b => b.addEventListener('click', async () => {
    const tr = b.closest('tr');
    const patch = {
      role: tr.querySelector('[data-k=role]').value,
      active: tr.querySelector('[data-k=active]').checked,
      color: tr.querySelector('[data-k=color]').value,
    };
    if (tr.dataset.m === state.me.id && (patch.role !== 'admin' || !patch.active) &&
        !confirm('Du nimmst dir selbst die Admin-Rechte. Wirklich?')) return;
    const { error } = await sb.from('ops_members').update(patch).eq('id', tr.dataset.m);
    if (error) return fail('Mitglied speichern', error);
    toast('Gespeichert');
    await reloadMembers(); render();
  }));
}

function newMember() {
  openModal({
    title: 'Mitglied eintragen',
    bodyHTML: `<div class="form-grid">
      ${fld('User UID aus Supabase *', inp('id', '', 'required placeholder="xxxxxxxx-xxxx-…"'), 'span-2')}
      ${fld('E-Mail *', inp('email', '', 'type="email" required'))}
      ${fld('Anzeigename *', inp('display_name', '', 'required'))}
      ${fld('Rolle', sel('role', options(Object.fromEntries(Object.keys(ROLES).map(r => [r, ROLES[r].label])), 'support')))}
      ${fld('Farbe', '<input type="color" data-f="color" value="#4f8ef7">')}
    </div>`,
    actions: [
      { label: 'Abbrechen', onClick: () => true },
      { label: 'Eintragen', kind: 'primary', onClick: async () => {
        const v = readFields($('#modalBody'));
        if (!v.id || !v.email || !v.display_name) { toast('UID, E-Mail und Name sind Pflicht', true); return false; }
        if (!/^[0-9a-f-]{36}$/i.test(v.id)) { toast('UID hat nicht das richtige Format', true); return false; }
        const { error } = await sb.from('ops_members').insert({ ...v, active: true });
        if (error) { fail('Mitglied eintragen', error); return false; }
        toast('Mitglied eingetragen');
        await reloadMembers(); render();
        return true;
      } },
    ],
  });
}
