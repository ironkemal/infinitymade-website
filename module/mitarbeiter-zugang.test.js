import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCode,
  formatCode,
  isValidCodeFormat,
  mitarbeiterAnlegen,
  neuerEinrichtungscode,
  mitarbeiterEntfernen,
  zeigeEinrichtungscode,
} from './mitarbeiter-zugang.js';

test('normalizeCode: strips whitespace, dashes, underscores and converts to uppercase', () => {
  assert.equal(normalizeCode('  abc-de_fg-23  '), 'ABCDEFG23');
  assert.equal(normalizeCode(''), '');
  assert.equal(normalizeCode(null), '');
  assert.equal(normalizeCode(undefined), '');
  assert.equal(normalizeCode(12345), '');
});

test('formatCode: formats 10-character code as XXXXX-XXXXX', () => {
  assert.equal(formatCode('23456789AB'), '23456-789AB');
  assert.equal(formatCode('23456-789ab'), '23456-789AB');
  assert.equal(formatCode('  23456 789ab  '), '23456-789AB');
  // non-10 length returns normalized
  assert.equal(formatCode('123'), '123');
  assert.equal(formatCode(''), '');
});

test('isValidCodeFormat: validates 10 unambiguous characters (no 0, 1, O, I)', () => {
  // Valid codes
  assert.equal(isValidCodeFormat('ABCDE23456'), true);
  assert.equal(isValidCodeFormat('abcde-23456'), true);
  assert.equal(isValidCodeFormat('  JKLMN-PQRST  '), true);
  assert.equal(isValidCodeFormat('UVWXY-Z2345'), true);

  // Ambiguous characters: 0, 1, O, I
  assert.equal(isValidCodeFormat('0BCDE23456'), false);
  assert.equal(isValidCodeFormat('1BCDE23456'), false);
  assert.equal(isValidCodeFormat('OBCDE23456'), false);
  assert.equal(isValidCodeFormat('IBCDE23456'), false);

  // Invalid length
  assert.equal(isValidCodeFormat('ABCDE2345'), false); // 9 chars
  assert.equal(isValidCodeFormat('ABCDE234567'), false); // 11 chars
  assert.equal(isValidCodeFormat(''), false);
  assert.equal(isValidCodeFormat(null), false);
});

test('mitarbeiterAnlegen: throws error if token is missing', async () => {
  await assert.rejects(
    () => mitarbeiterAnlegen({ vorname: 'Anna', nachname: 'Muster', email: 'anna@example.com' }),
    /Keine aktive Sitzung gefunden/
  );
});

test('mitarbeiterAnlegen: calls POST /team/mitarbeiter with correct headers and payload', async () => {
  let calledUrl = '';
  let calledOptions = {};

  const mockFetch = async (url, options) => {
    calledUrl = url;
    calledOptions = options;
    return {
      ok: true,
      json: async () => ({
        id: 'usr_123',
        email: 'anna@example.com',
        einrichtungscode: 'ABCDE-23456',
        gueltig_bis: '2026-10-08T12:00:00.000Z',
      }),
    };
  };

  const result = await mitarbeiterAnlegen(
    { vorname: 'Anna', nachname: 'Muster', email: 'anna@example.com', anrede: 'Frau' },
    { token: 'mock-jwt-token', apiBase: 'https://api.test', fetchImpl: mockFetch }
  );

  assert.equal(calledUrl, 'https://api.test/team/mitarbeiter');
  assert.equal(calledOptions.method, 'POST');
  assert.equal(calledOptions.headers['Authorization'], 'Bearer mock-jwt-token');
  assert.equal(calledOptions.headers['Content-Type'], 'application/json');

  const body = JSON.parse(calledOptions.body);
  assert.equal(body.vorname, 'Anna');
  assert.equal(body.nachname, 'Muster');
  assert.equal(body.email, 'anna@example.com');
  assert.equal(body.anrede, 'Frau');

  assert.equal(result.id, 'usr_123');
  assert.equal(result.einrichtungscode, 'ABCDE-23456');
});

test('mitarbeiterAnlegen: throws backend error message on failure', async () => {
  const mockFetch = async () => ({
    ok: false,
    json: async () => ({ error: 'Plan-Limit erreicht.' }),
  });

  await assert.rejects(
    () => mitarbeiterAnlegen(
      { vorname: 'Anna', nachname: 'Muster', email: 'anna@example.com' },
      { token: 'mock-jwt-token', apiBase: 'https://api.test', fetchImpl: mockFetch }
    ),
    /Plan-Limit erreicht\./
  );
});

test('neuerEinrichtungscode: throws error if employee ID or token is missing', async () => {
  await assert.rejects(
    () => neuerEinrichtungscode('', { token: 'mock-token' }),
    /Mitarbeiter-ID fehlt/
  );

  await assert.rejects(
    () => neuerEinrichtungscode('emp_123', { token: '' }),
    /Keine aktive Sitzung gefunden/
  );
});

test('neuerEinrichtungscode: calls POST /team/mitarbeiter/:id/einrichtungscode', async () => {
  let calledUrl = '';
  let calledOptions = {};

  const mockFetch = async (url, options) => {
    calledUrl = url;
    calledOptions = options;
    return {
      ok: true,
      json: async () => ({
        einrichtungscode: 'FGHKL-23456',
        gueltig_bis: '2026-10-08T12:00:00.000Z',
      }),
    };
  };

  const result = await neuerEinrichtungscode('emp_456', {
    token: 'jwt-owner',
    apiBase: 'https://api.test',
    fetchImpl: mockFetch,
  });

  assert.equal(calledUrl, 'https://api.test/team/mitarbeiter/emp_456/einrichtungscode');
  assert.equal(calledOptions.method, 'POST');
  assert.equal(calledOptions.headers['Authorization'], 'Bearer jwt-owner');
  assert.equal(result.einrichtungscode, 'FGHKL-23456');
});

test('neuerEinrichtungscode: throws backend error on failure', async () => {
  const mockFetch = async () => ({
    ok: false,
    json: async () => ({ error: 'Mitarbeiter nicht gefunden.' }),
  });

  await assert.rejects(
    () => neuerEinrichtungscode('emp_999', {
      token: 'jwt-owner',
      apiBase: 'https://api.test',
      fetchImpl: mockFetch,
    }),
    /Mitarbeiter nicht gefunden\./
  );
});

test('mitarbeiterEntfernen: calls POST /team/mitarbeiter/:id/entfernen with correct URL, method, and bearer header', async () => {
  let calledUrl = '';
  let calledOptions = {};

  const mockFetch = async (url, options) => {
    calledUrl = url;
    calledOptions = options;
    return {
      ok: true,
      json: async () => ({ ok: true }),
    };
  };

  const result = await mitarbeiterEntfernen('emp_789', {
    token: 'jwt-owner',
    apiBase: 'https://api.test',
    fetchImpl: mockFetch,
  });

  assert.equal(calledUrl, 'https://api.test/team/mitarbeiter/emp_789/entfernen');
  assert.equal(calledOptions.method, 'POST');
  assert.equal(calledOptions.headers['Authorization'], 'Bearer jwt-owner');
  assert.deepEqual(result, { ok: true });
});

test('mitarbeiterEntfernen: throws backend error on failure', async () => {
  const mockFetch = async () => ({
    ok: false,
    json: async () => ({ error: 'Mitarbeiter konnte nicht gesperrt werden' }),
  });

  await assert.rejects(
    () => mitarbeiterEntfernen('emp_999', {
      token: 'jwt-owner',
      apiBase: 'https://api.test',
      fetchImpl: mockFetch,
    }),
    /Mitarbeiter konnte nicht gesperrt werden/
  );
});

test('zeigeEinrichtungscode: resolves safely in Node environment without document', async () => {
  await assert.doesNotReject(async () => {
    await zeigeEinrichtungscode('ABCDE23456', '2026-10-08T12:00:00.000Z', 'Test Person');
  });
});
