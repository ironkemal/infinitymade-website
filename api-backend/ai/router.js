// Unified AI gateway — POST /api/ai/:task
//
// All AI calls in InfinityMade flow through this router. Adding a new
// capability = drop a file in ./tasks/<name>.js exporting `run(payload)`.
// The router handles: auth, tenant resolution, dispatch, audit logging,
// and a uniform error shape.

import express from 'express';
import { requireAuth } from './auth.js';
import { logCall, hashRequest } from './audit.js';
import { configSummary } from './azureClient.js';

import { run as b2cDraft } from './tasks/b2c-draft.js';
import { run as rezeptValidate } from './tasks/rezept-validate.js';
import { run as rezeptOcr } from './tasks/rezept-ocr.js';
import { run as appointmentConfirmDraft } from './tasks/appointment-confirm-draft.js';

const TASKS = {
  'b2c-draft': b2cDraft,
  'rezept-validate': rezeptValidate,
  'rezept-ocr': rezeptOcr,
  'appointment-confirm-draft': appointmentConfirmDraft
  // Future: 'schedule-series', 'b2b-draft', 'doctor-email-draft', 'whatsapp-intent'
};

const router = express.Router();

router.get('/_health', (_req, res) => {
  res.json({ ok: true, tasks: Object.keys(TASKS), azure: configSummary() });
});

router.post('/:task', requireAuth, async (req, res) => {
  const { task } = req.params;
  const handler = TASKS[task];
  if (!handler) {
    return res.status(404).json({ success: false, error: `Unknown AI task: ${task}` });
  }

  const t0 = Date.now();
  const requestHash = hashRequest(req.body);
  let status = 'ok';
  let errorMsg = null;
  let meta = {};

  try {
    const result = await handler(req.body || {});
    meta = result._meta || {};
    delete result._meta;

    res.json({ success: true, ...result });
  } catch (err) {
    status = 'error';
    errorMsg = err.message || String(err);
    const code = err.status || 500;
    res.status(code).json({ success: false, error: errorMsg });
  } finally {
    logCall({
      tenantId: req.auth?.tenantId,
      userId: req.auth?.userId,
      task,
      model: meta.model,
      deployment: meta.deployment,
      usage: meta.usage || {},
      latencyMs: meta.latency_ms ?? (Date.now() - t0),
      status,
      error: errorMsg,
      dryRun: !!meta.dry_run,
      requestHash
    });
  }
});

export default router;
