// Pflichtpunkt 1 (Melih, 22.11.2026): Der Kalender öffnet zuerst in der Wochenansicht.
// Quelltext-Prüfung, weil die Stellen in dashboard.js (Startwert, Panelwechsel) und
// dashboard.html (aktive Taste) zusammenpassen müssen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../dashboard.html', import.meta.url), 'utf8');

test('Startwert und Panelwechsel setzen die Woche', () => {
  assert.match(js, /^let calendarView = 'week';/m);
  const zweig = js.slice(js.indexOf("if (id === 'calendar') {"), js.indexOf("if (id === 'fahrtenbuch')"));
  assert.match(zweig, /setCalendarView\('week'\)/);
  assert.doesNotMatch(zweig, /setCalendarView\('day'\)/);
});

test('aktive Taste in der Werkzeugleiste ist „Woche“', () => {
  assert.match(html, /class="cal-view-btn active" data-view="week"/);
  assert.match(html, /class="cal-view-btn" data-view="day"/);
});

test('„Tag öffnen“ von der Startseite springt weiterhin gezielt in den Tag', () => {
  assert.ok((js.match(/switchPanel\('calendar'\); setCalendarView\('day'\);/g) || []).length >= 1);
});
