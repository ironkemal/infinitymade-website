/**
// Diktat / Spracheingabe Modul für Mail-Assistent (K5 / M4).
//
// Web Speech API ist KESINLIKLE YASAK (DSGVO / O-237).
// Ablauf: MediaRecorder -> POST /api/ai/transkribieren -> Azure Audio -> Plain text in Textarea.
*/

export const DIKTAT_LEGAL_NOTICE = 'Ihre Sprache wird zur Umschrift an Microsoft Azure (EU, Schweden) gesendet und von Praxura nicht gespeichert – bitte nur diktieren, was zur Dokumentation nötig ist.';
const NOTICE_KEY = 'praxura_diktat_hinweis_gesehen';

export const MIME_CANDIDATES = Object.freeze([
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/mp4'
]);

/**
 * Wählt den besten unterstützten MIME-Typ für MediaRecorder.
 * Rein und testbar.
 *
 * @param {Function} [isTypeSupportedFn]
 * @returns {string}
 */
export function getPreferredMimeType(isTypeSupportedFn) {
  const check = typeof isTypeSupportedFn === 'function'
    ? isTypeSupportedFn
    : (typeof globalThis !== 'undefined' && typeof globalThis.MediaRecorder?.isTypeSupported === 'function'
        ? globalThis.MediaRecorder.isTypeSupported.bind(globalThis.MediaRecorder)
        : null);

  if (typeof check === 'function') {
    for (const mime of MIME_CANDIDATES) {
      try {
        if (check(mime)) return mime;
      } catch {}
    }
  }
  return 'audio/webm';
}

/**
 * Formatiert Sekunden als M:SS.
 * Rein und testbar.
 *
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatDuration(totalSeconds) {
  const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * Fügt Text an der aktuellen Cursorposition ein.
 * Gibt den neuen Text und den Auswahlbereich zurück, damit der eingefügte Teil markiert bleibt.
 * Rein und testbar.
 *
 * @param {string} originalText
 * @param {number|undefined} selectionStart
 * @param {number|undefined} selectionEnd
 * @param {string} textToInsert
 * @returns {{newText: string, selectionStart: number, selectionEnd: number}}
 */
export function insertTextAtCursor(originalText = '', selectionStart, selectionEnd, textToInsert = '') {
  const text = String(originalText || '');
  const insert = String(textToInsert || '');
  const len = text.length;

  let start = typeof selectionStart === 'number' && Number.isFinite(selectionStart) ? selectionStart : len;
  let end = typeof selectionEnd === 'number' && Number.isFinite(selectionEnd) ? selectionEnd : start;

  if (start < 0) start = 0;
  if (start > len) start = len;
  if (end < start) end = start;
  if (end > len) end = len;

  const newText = text.slice(0, start) + insert + text.slice(end);
  const newStart = start;
  const newEnd = start + insert.length;

  return {
    newText,
    selectionStart: newStart,
    selectionEnd: newEnd
  };
}

const MIC_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
const STOP_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>';

/**
 * Verbindet ein Textarea mit dem Praxura-Diktat-Assistenten.
 *
 * @param {HTMLTextAreaElement} textarea
 * @param {Object} [options]
 * @returns {Object|null}
 */
export function attachDiktat(textarea, options = {}) {
  if (!textarea || typeof textarea !== 'object' || textarea._diktatAttached) {
    return textarea?._diktatController || null;
  }

  const doc = textarea.ownerDocument || globalThis.document;
  if (!doc) return null;

  const diktatVerfuegbar = options.diktat_verfuegbar !== false;
  const storage = options.localStorageImpl || globalThis.localStorage;
  const getToken = options.getToken || (async () => null);
  const apiBase = options.apiBase || '/api/ai';

  // Wrapper aufbauen
  let wrapper = textarea.closest('.diktat-wrap');
  if (!wrapper) {
    wrapper = doc.createElement('div');
    wrapper.className = 'diktat-wrap';
    textarea.parentNode.insertBefore(wrapper, textarea);
    wrapper.appendChild(textarea);
  }

  textarea.classList.add('diktat-textarea');

  // Controls container
  const controls = doc.createElement('div');
  controls.className = 'diktat-controls';

  // Status overlay (Timer, Pegel, Text)
  const statusOverlay = doc.createElement('div');
  statusOverlay.className = 'diktat-status';
  statusOverlay.hidden = true;

  const timerEl = doc.createElement('span');
  timerEl.className = 'diktat-timer';
  timerEl.textContent = '0:00';

  const levelWrap = doc.createElement('div');
  levelWrap.className = 'diktat-level';
  const levelBar = doc.createElement('div');
  levelBar.className = 'diktat-level-bar';
  levelWrap.appendChild(levelBar);

  const statusText = doc.createElement('span');
  statusText.className = 'diktat-status-text';

  statusOverlay.appendChild(timerEl);
  statusOverlay.appendChild(levelWrap);
  statusOverlay.appendChild(statusText);

  // 44x44 Button
  const btn = doc.createElement('button');
  btn.type = 'button';
  btn.className = 'diktat-btn';
  btn.setAttribute('aria-label', 'Diktat starten');
  btn.title = 'Diktat starten';
  btn.innerHTML = MIC_SVG;

  // DSGVO-Hinweis (einmalig)
  const notice = doc.createElement('div');
  notice.className = 'diktat-notice';
  notice.setAttribute('role', 'note');
  notice.hidden = true;
  notice.innerHTML = `<span class="diktat-notice-text">${DIKTAT_LEGAL_NOTICE}</span><button type="button" class="diktat-notice-close" aria-label="Hinweis schließen">×</button>`;

  controls.appendChild(statusOverlay);
  controls.appendChild(btn);
  wrapper.appendChild(controls);
  wrapper.appendChild(notice);

  const closeNotice = () => {
    notice.hidden = true;
    try { storage?.setItem(NOTICE_KEY, '1'); } catch {}
  };

  notice.querySelector('.diktat-notice-close')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeNotice();
  });

  // Falls diktat_verfuegbar false ist, Button gar nicht anzeigen
  if (!diktatVerfuegbar) {
    controls.style.display = 'none';
    notice.hidden = true;
  }

  // Zustand
  let isRecording = false;
  let isProcessing = false;
  let isCancelled = false;
  let mediaRecorder = null;
  let stream = null;
  let audioContext = null;
  let analyser = null;
  let animId = null;
  let timerInterval = null;
  let seconds = 0;
  let chunks = [];

  // Berechtigungs-/Kontextprüfung
  const isSecure = globalThis.isSecureContext !== false;
  const hasMedia = typeof globalThis.navigator !== 'undefined' && Boolean(globalThis.navigator.mediaDevices?.getUserMedia);

  function setUnavailable(reason = 'Diktat nicht verfügbar') {
    btn.disabled = true;
    btn.classList.add('is-unavailable');
    btn.title = reason;
  }

  if (!isSecure || !hasMedia) {
    setUnavailable('Diktat nicht verfügbar (HTTPS oder Mikrofonunterstützung fehlt)');
  }

  function resetToIdle() {
    isRecording = false;
    isProcessing = false;
    isCancelled = false;
    btn.disabled = false;
    btn.classList.remove('is-recording', 'is-processing');
    btn.setAttribute('aria-label', 'Diktat starten');
    btn.title = 'Diktat starten';
    btn.innerHTML = MIC_SVG;
    statusOverlay.hidden = true;
    statusText.textContent = '';
    levelBar.style.transform = 'scaleY(0)';
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    seconds = 0;
    chunks = [];
  }

  function cleanupMedia() {
    if (stream) {
      try {
        stream.getTracks().forEach((track) => track.stop());
      } catch {}
      stream = null;
    }
    if (audioContext) {
      try { audioContext.close().catch(() => {}); } catch {}
      audioContext = null;
      analyser = null;
    }
  }

  function cancelRecording() {
    if (!isRecording && !isProcessing) return;
    isCancelled = true;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch {}
    }
    cleanupMedia();
    resetToIdle();
  }

  // Panel-Schließung beobachten (Modal hidden oder Panel-Wechsel)
  const panelOrModal = textarea.closest('.panel, .modal-overlay');
  let observer = null;
  if (panelOrModal && typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(() => {
      const isHidden = panelOrModal.hidden || panelOrModal.style.display === 'none' || panelOrModal.classList.contains('hidden');
      if (isHidden && (isRecording || isProcessing)) {
        cancelRecording();
      }
    });
    observer.observe(panelOrModal, { attributes: true, attributeFilter: ['hidden', 'style', 'class'] });
  }

  async function startRecording() {
    if (isRecording || isProcessing) return;

    // Einmaligen Hinweis prüfen
    let noticeSeen = false;
    try { noticeSeen = storage?.getItem(NOTICE_KEY) === '1'; } catch {}
    if (!noticeSeen) {
      notice.hidden = false;
      closeNotice();
    }

    try {
      stream = await globalThis.navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setUnavailable('Diktat nicht verfügbar (Mikrofon-Zugriff verweigert)');
      return;
    }

    isRecording = true;
    isCancelled = false;
    chunks = [];
    seconds = 0;

    btn.classList.add('is-recording');
    btn.setAttribute('aria-label', 'Diktat beenden');
    btn.title = 'Diktat beenden';
    btn.innerHTML = STOP_SVG;

    statusOverlay.hidden = false;
    statusText.textContent = '';
    timerEl.textContent = '0:00';

    // AudioContext Pegelmesser
    try {
      const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
        const source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateLevel = () => {
          if (!isRecording) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          const scale = Math.min(1, Math.max(0.08, avg / 128));
          levelBar.style.transform = `scaleY(${scale.toFixed(2)})`;
          animId = requestAnimationFrame(updateLevel);
        };
        updateLevel();
      }
    } catch {}

    // MediaRecorder
    const mimeType = getPreferredMimeType();
    try {
      mediaRecorder = new MediaRecorder(stream, { mimeType });
    } catch {
      mediaRecorder = new MediaRecorder(stream);
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const recordedSeconds = seconds;
      cleanupMedia();

      if (isCancelled) {
        resetToIdle();
        return;
      }

      isProcessing = true;
      btn.disabled = true;
      btn.classList.remove('is-recording');
      btn.classList.add('is-processing');
      statusText.textContent = 'Wird umgeschrieben…';
      levelBar.style.transform = 'scaleY(0)';

      let audioBlob = null;
      try {
        audioBlob = new Blob(chunks, { type: mimeType });
      } catch {
        audioBlob = null;
      }
      chunks = []; // Ses Blob'u hemen bırakılır

      if (!audioBlob || audioBlob.size === 0) {
        resetToIdle();
        return;
      }

      try {
        const token = await getToken();
        if (!token) {
          throw new Error('Nicht authentifiziert');
        }

        const res = await (options.fetchImpl || globalThis.fetch)(`${apiBase}/transkribieren`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': mimeType,
            'X-Audio-Duration': String(recordedSeconds)
          },
          body: audioBlob
        });

        audioBlob = null; // Blob sofort freigeben

        if (!res.ok) {
          throw new Error(`Fehler bei Transkription: HTTP ${res.status}`);
        }

        const data = await res.json();
        const text = data?.text;

        if (typeof text === 'string' && text.trim().length > 0) {
          const original = textarea.value;
          const selStart = textarea.selectionStart;
          const selEnd = textarea.selectionEnd;

          // Leerzeichen-Trennung wenn nötig
          let textToInsert = text.trim();
          if (selStart > 0 && !/\s$/.test(original.slice(0, selStart))) {
            textToInsert = ' ' + textToInsert;
          }

          const { newText, selectionStart, selectionEnd } = insertTextAtCursor(
            original,
            selStart,
            selEnd,
            textToInsert
          );

          textarea.value = newText;
          textarea.focus();
          try {
            textarea.setSelectionRange(selectionStart, selectionEnd);
          } catch {}
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } catch (err) {
        // Mail-Schreiben wird nicht beeinträchtigt
        setUnavailable('Diktat derzeit nicht verfügbar');
        setTimeout(() => {
          btn.disabled = false;
          btn.classList.remove('is-unavailable');
          btn.title = 'Diktat starten';
        }, 3000);
      } finally {
        resetToIdle();
      }
    };

    mediaRecorder.start(250);

    // 3-Minuten Timer (180 Sekunden)
    timerInterval = setInterval(() => {
      seconds++;
      timerEl.textContent = formatDuration(seconds);
      if (seconds >= 180) {
        stopRecording();
        const info = doc.createElement('div');
        info.className = 'diktat-toast';
        info.textContent = 'Maximale Aufnahmedauer (3 Minuten) erreicht.';
        wrapper.appendChild(info);
        setTimeout(() => info.remove(), 4000);
      }
    }, 1000);
  }

  function stopRecording() {
    if (!isRecording) return;
    isRecording = false;
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch {}
    }
  }

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });

  const controller = {
    start: startRecording,
    stop: stopRecording,
    cancel: cancelRecording,
    dispose: () => {
      cancelRecording();
      observer?.disconnect();
      controls.remove();
      notice.remove();
      textarea._diktatAttached = false;
      delete textarea._diktatController;
    }
  };

  textarea._diktatAttached = true;
  textarea._diktatController = controller;
  return controller;
}

/**
 * Verbindet alle Mail-Assistent-Textareas in Praxura.
 * Wird aus module/ki-client.js aufgerufen.
 *
 * @param {Object} [deps]
 */
export function attachDiktatToMailInputs(deps = {}) {
  const doc = deps.document || globalThis.document;
  if (!doc) return;

  const mailInputIds = ['aiInput', 'b2cAiInput', 'composeBody'];

  // Vorhandene alte Platzhalter-Buttons (Spracheingabe) ausblenden, um Dopplung zu vermeiden
  ['aiVoiceBtn', 'b2cAiVoiceBtn'].forEach((id) => {
    const el = doc.getElementById(id);
    if (el) el.style.display = 'none';
  });

  for (const id of mailInputIds) {
    const textarea = doc.getElementById(id);
    if (textarea && textarea.tagName === 'TEXTAREA') {
      attachDiktat(textarea, deps);
    }
  }
}
