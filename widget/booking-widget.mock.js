// Mock-Backend fuer Entwicklung und Tests. Wird nur auf localhost und nur mit ?mock=… geladen
// (booking-widget.js prueft das), nie in der ausgelieferten Produktionsnutzung.
// Spiegelt den Vertrag des echten Backends: POST /booking-request/create, GET /booking-request/status.
import { ApiError } from './booking-widget.logic.js?v=20261012';

export function createMockApi(mode = 'accepted', { bereich = 'podologie' } = {}) {
  const store = new Map();
  let zaehler = 0;
  return {
    praxis: {
      name: 'Demo-Praxis (Mock)',
      inhaber: 'Test Inhaber',
      anschrift: 'Musterstraße 1, 53721 Siegburg',
      impressumUrl: null,
      datenschutzUrl: null,
      vollstaendig: true,
      bereich,
    },
    async createRequest(payload) {
      await new Promise((r) => setTimeout(r, 250));
      if (mode === 'error') throw new ApiError(500, 'Anfrage konnte nicht gespeichert werden');
      if (mode === 'limit') throw new ApiError(429, 'Zu viele Anfragen. Bitte warten Sie.');
      if (payload.website) return { id: 'honeypot', status: 'pending', token: 'x' };
      if (!payload.patient?.vorname || !payload.patient?.nachname || !payload.widget) throw new ApiError(400, 'Patientendaten unvollständig');
      const id = `00000000-0000-4000-8000-${String(++zaehler).padStart(12, '0')}`;
      const token = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
      store.set(id, { token, polls: 0, slot: '2026-10-20T09:30' });
      return { id, status: 'pending', token };
    },
    async getStatus(id, token) {
      await new Promise((r) => setTimeout(r, 120));
      const e = store.get(id);
      if (!e || e.token !== token) throw new ApiError(404, 'Anfrage nicht gefunden');
      e.polls += 1;
      if (mode === 'pending' || e.polls < 3) return { status: 'pending', message: 'Ihre Anfrage ist eingegangen. Die Praxis meldet sich bei Ihnen.' };
      if (mode === 'rejected') return { status: 'rejected', message: 'Die Praxis kann Ihre Anfrage leider nicht erfüllen. Bitte nehmen Sie Kontakt auf.' };
      return { status: 'accepted', confirmedSlot: e.slot, message: 'Ihr Termin wurde bestätigt.' };
    },
  };
}
