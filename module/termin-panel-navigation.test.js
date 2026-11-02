import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
const functionSource = name => {
  const start = source.indexOf(`function ${name}(`);
  return source.slice(start, source.indexOf('\n}\n', start) + 2);
};

function harness({ denied = false } = {}) {
  const modal = { hidden: false, style: { display: 'flex' } };
  const padding = new Set(['padding-right']);
  const cleared = [];
  const context = vm.createContext({
    currentProfile: { role: denied ? 'employee' : 'owner' },
    SIDEBAR_TO_MODULE: { team: 'team' }, hasModuleAccess: () => !denied,
    showToast() {}, getSidebarItems: () => [], moveBooking: null,
    notizenController: { invalidate() {} }, activePanel: 'calendar', bkActionTimer: 123,
    document: {
      querySelectorAll: () => [],
      getElementById: id => id === 'bkActionModal' ? modal : id === 'mainArea' ? { style: { removeProperty: name => padding.delete(name) } } : { classList: { add() {} } },
    },
    clearInterval: id => cleared.push(id), renderSidebar: async () => {}, closeSidebar() {},
    window: { _calRpInited: true }, showMyBookingLink() {}, renderCalEmpChips() {}, dayViewDate: new Date(), formatDateDE: () => 'Datum', setCalendarView() {},
    loadTeam() {}, loadTodayBookings: async () => {}, loadActivityFeed: async () => {}, loadVerordnungen() {},
  });
  vm.runInContext(functionSource('closeBkActionPanel') + '\nasync ' + functionSource('switchPanel') + '\nglobalThis.navigate = switchPanel;', context);
  return { context, modal, padding, cleared };
}

for (const target of ['team', 'overview', 'verordnungen']) {
  test(`navigation to ${target} closes appointment panel and releases layout/timer`, async () => {
    const h = harness();
    await h.context.navigate(target);
    assert.equal(h.modal.hidden, true);
    assert.equal(h.modal.style.display, 'none');
    assert.equal(h.padding.has('padding-right'), false);
    assert.deepEqual(h.cleared, [123]);
    assert.equal(h.context.bkActionTimer, null);
    assert.equal(h.context.activePanel, target);
  });
}

test('denied navigation preserves current appointment panel', async () => {
  const h = harness({ denied: true });
  await h.context.navigate('team');
  assert.equal(h.modal.hidden, false);
  assert.equal(h.padding.has('padding-right'), true);
  assert.equal(h.context.bkActionTimer, 123);
  assert.equal(h.context.activePanel, 'calendar');
});

test('remaining in calendar preserves current appointment panel', async () => {
  const h = harness();
  await h.context.navigate('calendar');
  assert.equal(h.modal.hidden, false);
  assert.equal(h.padding.has('padding-right'), true);
  assert.equal(h.context.bkActionTimer, 123);
  assert.deepEqual(h.cleared, []);
});
