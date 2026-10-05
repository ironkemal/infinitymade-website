import { test } from 'node:test';
import assert from 'node:assert/strict';
import { klassifiziereIpv4, entferneV4Praefix, ratenSchluessel } from '../ip.js';

test('klassifiziereIpv4', () => {
  const f = klassifiziereIpv4;
  assert.equal(f('192.168.2.111'), 'privat');
  assert.equal(f('10.0.0.1'), 'privat');
  assert.equal(f('172.16.5.5'), 'privat');
  assert.equal(f('172.31.255.255'), 'privat');
  assert.equal(f('172.32.0.1'), 'oeffentlich');
  assert.equal(f('172.15.0.1'), 'oeffentlich');
  assert.equal(f('127.0.0.1'), 'loopback');
  assert.equal(f('169.254.1.1'), 'linklocal');
  assert.equal(f('0.0.0.0'), 'null');
  assert.equal(f('0.1.2.3'), 'null');
  assert.equal(f('100.64.0.1'), 'cgnat');
  assert.equal(f('224.0.0.1'), 'reserviert');
  assert.equal(f('255.255.255.255'), 'reserviert');
  assert.equal(f('8.8.8.8'), 'oeffentlich');
});

test('klassifiziereIpv4: ungültige Eingaben', () => {
  for (const s of ['', null, undefined, '1.2.3', '1.2.3.4.5', '256.1.1.1', '01.2.3.4', '192.168.001.1', 'a.b.c.d', '::1', '1.2.3.4 ', '1.2.3.4\n']) {
    assert.equal(klassifiziereIpv4(s), 'ungueltig', String(s));
  }
});

test('entferneV4Praefix', () => {
  assert.equal(entferneV4Praefix('::ffff:1.2.3.4'), '1.2.3.4');
  assert.equal(entferneV4Praefix('1.2.3.4'), '1.2.3.4');
});

test('ratenSchluessel: IPv4 unverändert, IPv6 auf /64', () => {
  assert.equal(ratenSchluessel('::ffff:1.2.3.4'), '1.2.3.4');
  assert.equal(ratenSchluessel('2001:db8:1:2:aaaa:bbbb:cccc:dddd'), '2001:0db8:0001:0002::/64');
  assert.equal(ratenSchluessel('2001:db8:1:2::5'), '2001:0db8:0001:0002::/64');
  assert.equal(ratenSchluessel('2001:DB8::1'), '2001:0db8:0000:0000::/64');
  assert.equal(ratenSchluessel('::1'), '0000:0000:0000:0000::/64');
});
