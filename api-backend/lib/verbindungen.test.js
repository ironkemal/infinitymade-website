// O-178 / K2b.16 — Außenverbindungsliste folgt der echten Box-Konfiguration.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verbindungenListe } from './verbindungen.js';

const ziele = (env) => verbindungenListe(env).verbindungen.map((v) => v.ziel);

test('Minimal-Box (eigene Adresse, tls internal, kein SMTP, KI aus): nur Updates + OS', () => {
  assert.deepEqual(ziele({ CADDY_TLS_MODUS: 'klassisch', CADDY_TLS_ARG: 'internal' }), [
    'ghcr.io, pkg-containers.githubusercontent.com',
    'registry-1.docker.io, auth.docker.io, production.cloudflare.docker.com (Docker Hub)',
    'praxura.de, download.docker.com',
    'Zeitserver und Paketquellen des Betriebssystems',
  ]);
});

test('Box-Adresse (acmedns) mit Namensdienst: Merkez + Let\'s Encrypt + DNS-Nachweis', () => {
  const z = ziele({ CADDY_TLS_MODUS: 'acmedns', MERKEZ_URL: 'https://box.praxura.de' });
  assert.ok(z.includes('box.praxura.de'));
  assert.ok(z.includes('acme-v02.api.letsencrypt.org'));
  assert.ok(z.includes('auth.praxura.de'));
});

test('eigene Adresse mit Let\'s Encrypt (CADDY_TLS_ARG = E-Mail): Let\'s Encrypt, kein auth.praxura.de', () => {
  const z = ziele({ CADDY_TLS_MODUS: 'klassisch', CADDY_TLS_ARG: 'praxis@example.de' });
  assert.ok(z.includes('acme-v02.api.letsencrypt.org'));
  assert.ok(!z.includes('auth.praxura.de'));
});

test('SMTP gesetzt → Mailserver mit Port', () => {
  assert.ok(ziele({ SMTP_HOST: 'smtp.example.de', SMTP_PORT: '465' }).includes('smtp.example.de:465'));
  assert.ok(ziele({ SMTP_HOST: 'smtp.example.de' }).includes('smtp.example.de:587'));
});

test('KI: aus = keine Zeile · direkt = eigener Endpunkt · jeton = Merkez + Azure', () => {
  assert.ok(!ziele({ AI_MODE: 'aus' }).some((z) => /openai|KI/i.test(z)));
  assert.ok(ziele({ AI_MODE: 'direkt', AI_ENDPOINT: 'https://praxis-ki.openai.azure.com/' }).includes('praxis-ki.openai.azure.com'));
  const jeton = verbindungenListe({ AI_MODE: 'jeton', MERKEZ_URL: 'https://box.praxura.de' }).verbindungen;
  assert.ok(jeton.some((v) => v.ziel === 'box.praxura.de' && /KI-Zugang/.test(v.zweck)));
  assert.ok(jeton.some((v) => /Azure OpenAI/.test(v.ziel)));
});

test('jede Zeile hat Zweck, Zeitpunkt und Inhalt (die Praxis soll sie verstehen)', () => {
  const alle = verbindungenListe({
    CADDY_TLS_MODUS: 'acmedns', MERKEZ_URL: 'https://box.praxura.de', SMTP_HOST: 's', AI_MODE: 'jeton',
  }).verbindungen;
  for (const v of alle) {
    assert.ok(v.zweck && v.wann && v.inhalt, JSON.stringify(v));
    assert.ok(['Praxura', 'Betriebssystem'].includes(v.von));
  }
});
