// PII masking utility for AI calls.
//
// DSGVO Art. 32 + DSFA R3: minimize personal data sent to external AI models.
// Azure OpenAI EU Data Boundary + ZDR contracts make this defense-in-depth,
// not strictly required — but it dramatically reduces re-identification
// risk if a model provider's logging is ever misconfigured.
//
// Usage pattern:
//   const { masked, unmask } = maskPII(text, { entities: [...] });
//   // send `masked` to the model
//   const response = await chat({ messages: [{ role: 'user', content: masked }] });
//   const cleartextResponse = unmask(response.content);
//
// Or for the message-array form:
//   const { messages: maskedMsgs, unmask } = maskMessages(messages, { entities });
//
// Patterns auto-detected even without explicit entities:
//   - KVNR (1 letter + 9 digits)
//   - IBAN (DE-style)
//   - LANR / BSNR 9-digit medical IDs (if they look like an ID, not random)
//
// Date of birth is NOT auto-detected (too noisy with appointment dates).
// Pass it as an entity if you want to mask it.

const AUTO_PATTERNS = [
  { name: 'KVNR', re: /\b[A-Z]\d{9}\b/g, tag: 'KVNR' },
  { name: 'IBAN', re: /\b[A-Z]{2}\d{2}[A-Z0-9]{12,30}\b/g, tag: 'IBAN' },
];

// Escape regex special chars in a literal string.
function escRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Mask PII in a string. Returns { masked, map, unmask }.
 *
 * @param {string} text
 * @param {Object} [opts]
 * @param {Array<{value:string, type:string}>} [opts.entities] explicit values to mask
 *        e.g. [{value: 'Max Mustermann', type: 'NAME'}, {value: '1972-04-13', type: 'DOB'}]
 * @returns {{ masked: string, map: Record<string,string>, unmask: (s:string)=>string }}
 */
export function maskPII(text, opts = {}) {
  if (typeof text !== 'string' || !text) {
    return { masked: text, map: {}, unmask: (s) => s };
  }

  const map = {};           // placeholder -> original
  const reverseMap = {};    // original -> placeholder (dedupe identical values)
  const counters = {};
  let masked = text;

  const allocate = (type, original) => {
    if (reverseMap[original]) return reverseMap[original];
    counters[type] = (counters[type] || 0) + 1;
    const placeholder = `<<${type}_${counters[type]}>>`;
    map[placeholder] = original;
    reverseMap[original] = placeholder;
    return placeholder;
  };

  // Explicit entities first (so KVNR auto-detector doesn't double-mask them)
  const entities = (opts.entities || [])
    .filter(e => e && e.value && String(e.value).trim().length > 1)
    .sort((a, b) => String(b.value).length - String(a.value).length);  // longest first

  for (const ent of entities) {
    const v = String(ent.value);
    const type = (ent.type || 'PII').toUpperCase();
    const placeholder = allocate(type, v);
    masked = masked.split(v).join(placeholder);
  }

  // Auto-patterns
  for (const { re, tag } of AUTO_PATTERNS) {
    masked = masked.replace(re, (m) => allocate(tag, m));
  }

  const unmask = (s) => {
    if (typeof s !== 'string' || !s) return s;
    let out = s;
    // Iterate longest placeholder first to be safe (none overlap, but defensive).
    const placeholders = Object.keys(map).sort((a, b) => b.length - a.length);
    for (const p of placeholders) out = out.split(p).join(map[p]);
    return out;
  };

  return { masked, map, unmask };
}

/**
 * Mask PII across an OpenAI-style messages array.
 * Concatenates all text content into one mask context so identical PII gets
 * the same placeholder across system/user/assistant turns.
 */
export function maskMessages(messages, opts = {}) {
  if (!Array.isArray(messages)) return { messages, map: {}, unmask: (s) => s };

  // Build a unified entity list once
  const entities = opts.entities || [];

  // Stage 1: walk messages and collect a single mask map by feeding all text into maskPII sequentially
  const masker = maskPII('', { entities });
  // Pre-populate map with explicit entities by running through an empty string + entities
  // (maskPII handles entities even with empty text — but it returns no substitutions there;
  // simpler: run per-message and share `entities` so dedupe across calls works via reverseMap.
  // To share dedupe, build entities-only state first.

  // Simpler approach: walk + accumulate map.
  const sharedMap = {};
  const sharedReverse = {};
  const counters = {};
  const allocate = (type, original) => {
    if (sharedReverse[original]) return sharedReverse[original];
    counters[type] = (counters[type] || 0) + 1;
    const placeholder = `<<${type}_${counters[type]}>>`;
    sharedMap[placeholder] = original;
    sharedReverse[original] = placeholder;
    return placeholder;
  };

  const sortedEntities = [...entities]
    .filter(e => e && e.value && String(e.value).trim().length > 1)
    .sort((a, b) => String(b.value).length - String(a.value).length);

  const maskOne = (s) => {
    if (typeof s !== 'string' || !s) return s;
    let out = s;
    for (const ent of sortedEntities) {
      const v = String(ent.value);
      const type = (ent.type || 'PII').toUpperCase();
      const placeholder = allocate(type, v);
      out = out.split(v).join(placeholder);
    }
    for (const { re, tag } of AUTO_PATTERNS) {
      out = out.replace(re, (m) => allocate(tag, m));
    }
    return out;
  };

  const maskedMessages = messages.map(m => {
    if (typeof m.content === 'string') {
      return { ...m, content: maskOne(m.content) };
    }
    if (Array.isArray(m.content)) {
      // Multi-part content (vision messages: text+image_url). Mask text parts only.
      return {
        ...m,
        content: m.content.map(part =>
          part.type === 'text' && typeof part.text === 'string'
            ? { ...part, text: maskOne(part.text) }
            : part
        )
      };
    }
    return m;
  });

  const unmask = (s) => {
    if (typeof s !== 'string' || !s) return s;
    let out = s;
    const placeholders = Object.keys(sharedMap).sort((a, b) => b.length - a.length);
    for (const p of placeholders) out = out.split(p).join(sharedMap[p]);
    return out;
  };

  return { messages: maskedMessages, map: sharedMap, unmask };
}

/**
 * Extract PII entities from a contact/patient list shape commonly passed
 * to AI tasks (e.g. b2c-draft `contacts`). Convenience helper.
 *
 * @param {Array<{name?:string, contact_name?:string, first_name?:string, last_name?:string, email?:string, phone?:string, geburtsdatum?:string, kvnr?:string}>} contacts
 */
export function entitiesFromContacts(contacts = []) {
  const out = [];
  for (const c of contacts || []) {
    const fullName = c.name || c.contact_name ||
      [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
    if (fullName && fullName.length > 2) out.push({ value: fullName, type: 'NAME' });
    if (c.email) out.push({ value: c.email, type: 'EMAIL' });
    if (c.phone) out.push({ value: c.phone, type: 'PHONE' });
    if (c.geburtsdatum) out.push({ value: c.geburtsdatum, type: 'DOB' });
    if (c.kvnr) out.push({ value: c.kvnr, type: 'KVNR' });
  }
  return out;
}
