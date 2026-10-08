// O-178 / K2b.16 (08.10.2026) — Daten für ueber.html („Über diese Software").
//
//   GET /api/ueber               öffentlich: nur die Version (wie /health)
//   GET /api/ueber/verbindungen  nur Box, angemeldet: Außenverbindungen (lib/verbindungen.js)
//   GET /api/ueber/lizenzen      nur Box, angemeldet: Lizenztexte (text/plain), im Image erzeugt
//
// Warum nur angemeldet: eine Box kann im Internet stehen (Hetzner, KURULUM
// Weg C). Eine vollständige Paket-/Versionsliste und der SMTP-Host helfen dort
// nur einem Angreifer. Der Lizenzhinweis ist der Praxis (Lizenznehmerin)
// geschuldet, nicht der Öffentlichkeit (onprem O-178 offene Frage b).
// Jede angemeldete Person der Box darf lesen — eine Praxis, kein Mandant-Schnitt.
//
// Warum nur Box (guvenlik S-54): derselbe Router läuft auf dem SaaS-VPS, und
// dort kann sich jeder registrieren — „angemeldet" hieße „jeder im Internet",
// die Liste zeigte die env des VPS. Die Seite gibt es ohnehin nur in der Box.

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAuth } from '../ai/auth.js';
import { istKutu } from '../lib/dagitim.js';
import { verbindungenListe } from '../lib/verbindungen.js';

const LIZENZ_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lizenzen');
// Reihenfolge = Reihenfolge in der Antwort: erst die Container-Komponenten, dann npm.
const LIZENZ_DATEIEN = ['NOTICE-komponenten.md', 'THIRD-PARTY-NOTICES.txt'];

// Die Dateien ändern sich nur mit dem Image → einmal lesen, danach aus dem Speicher
// (kein wiederholtes readFileSync von ~1 MB im Event-Loop, guvenlik S-54).
let lizenzText;
function lizenzenLesen() {
  if (lizenzText === undefined) {
    const teile = LIZENZ_DATEIEN
      .map((f) => path.join(LIZENZ_DIR, f))
      .filter((p) => fs.existsSync(p))
      .map((p) => fs.readFileSync(p, 'utf8'));
    lizenzText = teile.length ? teile.join('\n\n') : null;
  }
  return lizenzText;
}

const nurKutu = (req, res, next) => (istKutu() ? next() : res.status(404).json({ error: 'Not found' }));

// Vor requireAuth, damit auch die Token-Prüfung (2 DB-Abfragen) gedeckelt ist.
const ueberLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen. Bitte warten Sie eine Minute.' },
});

const router = Router();

router.get('/ueber', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ version: process.env.IMAGE_VERSION || 'dev' });
});

router.get('/ueber/verbindungen', nurKutu, ueberLimiter, requireAuth, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(verbindungenListe());
});

router.get('/ueber/lizenzen', nurKutu, ueberLimiter, requireAuth, (req, res) => {
  try {
    const text = lizenzenLesen();
    if (!text) return res.status(404).json({ error: 'Lizenzliste in diesem Build nicht enthalten.' });
    res.set('Cache-Control', 'private, max-age=3600');
    res.type('text/plain; charset=utf-8').send(text);
  } catch (err) {
    res.status(500).json({ error: 'Lizenzliste konnte nicht gelesen werden.' });
  }
});

export default router;
