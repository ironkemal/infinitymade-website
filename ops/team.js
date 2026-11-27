// Praxura Cockpit — Team & Rollenverwaltung (nur Founder)
import { sb, state, $, esc, toast, fail, fmtDate, myRole } from './app.js?v=20261127d';
import { t, onLangChange } from './i18n.js?v=20261127d';

const ROLES = ['founder', 'tech', 'support', 'sales'];

const ROLE_MATRIX_ROWS = [
  {
    areaKey: 'team.matrix.area.core',
    founder: 'team.matrix.rw',
    tech: 'team.matrix.rw',
    support: 'team.matrix.limited',
    sales: 'team.matrix.limited',
  },
  {
    areaKey: 'team.matrix.area.boxesKi',
    founder: 'team.matrix.rw',
    tech: 'team.matrix.rw',
    support: 'team.matrix.none',
    sales: 'team.matrix.none',
  },
  {
    areaKey: 'team.matrix.area.billing',
    founder: 'team.matrix.rw',
    tech: 'team.matrix.none',
    support: 'team.matrix.none',
    sales: 'team.matrix.rw',
  },
  {
    areaKey: 'team.matrix.area.finance',
    founder: 'team.matrix.rw',
    tech: 'team.matrix.none',
    support: 'team.matrix.none',
    sales: 'team.matrix.none',
  },
  {
    areaKey: 'team.matrix.area.teamAdmin',
    founder: 'team.matrix.rw',
    tech: 'team.matrix.none',
    support: 'team.matrix.none',
    sales: 'team.matrix.none',
  },
];

let members = [];
let schemaHasRole = true;
let unsubLang = null;

function isUndefinedColumnError(err) {
  return Boolean(err && (err.code === '42703' || /column\s+.*\s+does not exist/i.test(String(err.message || ''))));
}

function countActiveFounders() {
  return members.filter((m) => m.role === 'founder' && m.is_active !== false).length;
}

function validateFounderUpdate(member, nextRole, nextActive) {
  const isSelf = state.me?.id && member.id === state.me.id;
  if (isSelf && (nextRole !== 'founder' || nextActive === false)) {
    return t('team.guard.selfLockout');
  }

  const wasActiveFounder = member.role === 'founder' && member.is_active !== false;
  const willStopBeingActiveFounder = nextRole !== 'founder' || nextActive === false;
  if (wasActiveFounder && willStopBeingActiveFounder && countActiveFounders() <= 1) {
    return t('team.guard.lastFounder');
  }

  return null;
}

function renderMatrixCell(valKey) {
  const cls = valKey === 'team.matrix.rw'
    ? 'sev-ok'
    : valKey === 'team.matrix.limited'
      ? 'sev-warn'
      : '';
  return `<span class="ck-badge ${cls}">${esc(t(valKey))}</span>`;
}

function renderTeam() {
  const root = $('#view-team');
  if (!root) return;

  if (myRole() !== 'founder') {
    root.innerHTML = `<div class="ck-banner ck-banner-warn">${esc(t('team.founderOnly'))}</div>`;
    return;
  }

  const activeCount = members.filter((m) => m.is_active !== false).length;
  const founderCount = countActiveFounders();

  root.innerHTML = `
    <div class="ck-head">
      <div>
        <div class="ck-eyebrow">${esc(t('team.eyebrow'))}</div>
        <h2 class="ck-title">${esc(t('team.title'))}</h2>
        <p class="ck-sub">${esc(t('team.subtitle'))}</p>
      </div>
      <div class="ck-head-actions">
        <span class="ck-badge">${esc(t('team.summaryBadge', { active: activeCount, total: members.length, founders: founderCount }))}</span>
        <button type="button" class="btn btn-ghost" id="teamRefreshBtn">${esc(t('common.refresh'))}</button>
      </div>
    </div>

    ${!schemaHasRole ? `<div class="ck-banner ck-banner-warn">${esc(t('team.schemaPending'))}</div>` : ''}

    <div class="team-grid">
      ${members.length === 0
        ? `<div class="ck-panel"><p class="empty">${esc(t('team.empty'))}</p></div>`
        : members.map((m) => {
            const isSelf = state.me?.id === m.id;
            const role = ROLES.includes(m.role) ? m.role : 'support';
            const isActive = m.is_active !== false;
            const isProtectedLastFounder = role === 'founder' && isActive && founderCount <= 1;

            return `
              <article class="team-card ${isActive ? '' : 'is-inactive'}" data-member-id="${esc(m.id)}">
                <div class="team-card-head">
                  <div class="team-identity">
                    <span class="team-dot" style="background:${esc(m.color || '#c9a227')}"></span>
                    <div>
                      <div class="team-name">
                        ${esc(m.display_name || m.email || m.id)}
                        ${isSelf ? `<span class="ck-badge sev-info">${esc(t('team.youBadge'))}</span>` : ''}
                      </div>
                      <div class="team-email">${esc(m.email || '—')}</div>
                    </div>
                  </div>
                  <div class="team-badges">
                    <span class="role-pill role-${esc(role)}">${esc(t(`role.${role}`))}</span>
                    <span class="ck-badge ${isActive ? 'sev-ok' : 'sev-critical'}">
                      ${esc(isActive ? t('team.status.active') : t('team.status.inactive'))}
                    </span>
                  </div>
                </div>

                <div class="team-meta">
                  <span>${esc(t('team.col.lang'))}: <strong>${esc(String(m.preferred_lang || 'de').toUpperCase())}</strong></span>
                  <span>${esc(t('team.col.joined'))}: <strong>${esc(m.created_at ? fmtDate(m.created_at) : '—')}</strong></span>
                </div>

                <div class="team-controls">
                  <label class="fld">
                    <span>${esc(t('team.col.role'))}</span>
                    <select data-member-role="${esc(m.id)}" ${!schemaHasRole ? 'disabled' : ''}>
                      ${ROLES.map((r) => `
                        <option value="${esc(r)}" ${role === r ? 'selected' : ''}>${esc(t(`role.${r}`))}</option>
                      `).join('')}
                    </select>
                  </label>

                  <div class="team-toggle-wrap">
                    <span>${esc(t('team.col.status'))}</span>
                    <button
                      type="button"
                      class="btn ${isActive ? 'btn-ghost' : 'btn-primary'} ck-btn-sm"
                      data-member-toggle="${esc(m.id)}"
                      ${!schemaHasRole ? 'disabled' : ''}
                      title="${esc(isSelf || isProtectedLastFounder ? t('team.guard.tooltip') : '')}"
                    >
                      ${esc(isActive ? t('team.btn.deactivate') : t('team.btn.activate'))}
                    </button>
                  </div>
                </div>
              </article>
            `;
          }).join('')}
    </div>

    <div class="team-bottom-grid">
      <section class="ck-panel">
        <div class="ck-panel-head">
          <h3>${esc(t('team.matrix.title'))}</h3>
        </div>
        <div class="ck-table-wrap">
          <table class="ck-table">
            <thead>
              <tr>
                <th>${esc(t('team.matrix.col.area'))}</th>
                <th>${esc(t('role.founder'))}</th>
                <th>${esc(t('role.tech'))}</th>
                <th>${esc(t('role.support'))}</th>
                <th>${esc(t('role.sales'))}</th>
              </tr>
            </thead>
            <tbody>
              ${ROLE_MATRIX_ROWS.map((row) => `
                <tr>
                  <td><div class="ck-cell-main">${esc(t(row.areaKey))}</div></td>
                  <td>${renderMatrixCell(row.founder)}</td>
                  <td>${renderMatrixCell(row.tech)}</td>
                  <td>${renderMatrixCell(row.support)}</td>
                  <td>${renderMatrixCell(row.sales)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>

      <aside class="ck-panel team-guide">
        <div class="ck-panel-head">
          <h3>${esc(t('team.guide.title'))}</h3>
        </div>
        <p class="ck-sub" style="margin-top:0">${esc(t('team.guide.intro'))}</p>
        <ol class="team-guide-steps">
          <li>${esc(t('team.guide.step1'))}</li>
          <li>${esc(t('team.guide.step2'))}</li>
          <li>${esc(t('team.guide.step3'))}</li>
        </ol>
      </aside>
    </div>
  `;

  $('#teamRefreshBtn', root)?.addEventListener('click', () => mountTeam());

  root.querySelectorAll('select[data-member-role]').forEach((sel) => {
    sel.addEventListener('change', async () => {
      const id = sel.getAttribute('data-member-role');
      const member = members.find((x) => x.id === id);
      if (!member) return;

      const prevRole = ROLES.includes(member.role) ? member.role : 'support';
      const nextRole = sel.value;
      const isActive = member.is_active !== false;

      const guardMsg = validateFounderUpdate(member, nextRole, isActive);
      if (guardMsg) {
        sel.value = prevRole;
        toast(guardMsg, true);
        return;
      }

      sel.disabled = true;
      const { error } = await sb
        .from('ops_members')
        .update({ role: nextRole })
        .eq('id', member.id);

      if (error) {
        sel.value = prevRole;
        sel.disabled = false;
        return fail('Rolle speichern', error);
      }

      member.role = nextRole;
      const globalMember = state.members.find((x) => x.id === member.id);
      if (globalMember) globalMember.role = nextRole;

      toast(t('team.toast.updated'));
      renderTeam();
    });
  });

  root.querySelectorAll('button[data-member-toggle]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-member-toggle');
      const member = members.find((x) => x.id === id);
      if (!member) return;

      const role = ROLES.includes(member.role) ? member.role : 'support';
      const nextActive = member.is_active === false;

      const guardMsg = validateFounderUpdate(member, role, nextActive);
      if (guardMsg) {
        toast(guardMsg, true);
        return;
      }

      btn.disabled = true;
      const { error } = await sb
        .from('ops_members')
        .update({ is_active: nextActive })
        .eq('id', member.id);

      if (error) {
        btn.disabled = false;
        return fail('Mitgliedstatus speichern', error);
      }

      member.is_active = nextActive;
      const globalMember = state.members.find((x) => x.id === member.id);
      if (globalMember) globalMember.is_active = nextActive;

      toast(t('team.toast.updated'));
      renderTeam();
    });
  });
}

export async function mountTeam() {
  if (!unsubLang) {
    unsubLang = onLangChange(() => {
      if (!$('#view-team')?.hidden) renderTeam();
    });
  }

  const root = $('#view-team');
  if (myRole() !== 'founder') {
    renderTeam();
    return;
  }

  if (root && !members.length) {
    root.innerHTML = `<p class="empty">${esc(t('auth.loading'))}</p>`;
  }

  let { data, error } = await sb
    .from('ops_members')
    .select('id, email, display_name, color, role, is_active, preferred_lang, created_at')
    .order('display_name');

  if (error && isUndefinedColumnError(error)) {
    schemaHasRole = false;
    ({ data, error } = await sb
      .from('ops_members')
      .select('id, email, display_name, color, created_at')
      .order('display_name'));
  } else if (!error) {
    schemaHasRole = true;
  }

  if (error) {
    fail('Team laden', error);
  }

  members = data || [];
  renderTeam();
}
