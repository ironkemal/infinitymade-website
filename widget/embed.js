/*! Praxura Termin-Anfrage-Widget — Loader (klassisches Script, keine Abhaengigkeiten).
 *
 * Einbau:
 *   <script src="https://praxura.de/widget/embed.js" data-owner="<Praxis-UUID>" async></script>
 *
 * Der Loader erzeugt nur einen iframe. Die Adresse leitet er aus dem eigenen script-src ab —
 * es gibt keinen fest eingebauten Host (on-prem: dieselbe Datei von der Kutu-Adresse laden).
 * Formularwerte bleiben im iframe; zurueck an die Seite kommt nur die Hoehe.
 *
 * Attribute: data-owner (Pflicht, UUID) · data-target (optional, id eines Containers).
 * Dieser Vertrag ist stabil: Praxen kleben das Snippet dauerhaft in ihre Seite.
 */
(function () {
  'use strict';
  var script = document.currentScript;
  if (!script || !script.src) return;

  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var owner = script.getAttribute('data-owner') || '';
  if (!UUID.test(owner)) {
    if (window.console) console.error('[praxura-widget] data-owner fehlt oder ist keine UUID.');
    return;
  }

  var base;
  try { base = new URL(script.src); } catch (e) { return; }
  var origin = base.origin;

  var frame = document.createElement('iframe');
  var src = origin + '/widget/booking-widget.html?owner=' + encodeURIComponent(owner);
  src += '&parent=' + encodeURIComponent(window.location.origin);
  var mock = script.getAttribute('data-mock');
  if (mock) src += '&mock=' + encodeURIComponent(mock);
  frame.src = src;
  frame.title = 'Terminanfrage';
  frame.loading = 'lazy';
  frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox');
  frame.setAttribute('allow', 'none');
  frame.style.width = '100%';
  frame.style.maxWidth = '600px';
  frame.style.height = '520px';
  frame.style.border = '0';
  frame.style.display = 'block';
  frame.style.colorScheme = 'light';

  var targetId = script.getAttribute('data-target');
  var target = targetId ? document.getElementById(targetId) : null;
  if (target) target.appendChild(frame);
  else script.parentNode.insertBefore(frame, script.nextSibling);

  window.addEventListener('message', function (ev) {
    if (ev.source !== frame.contentWindow || ev.origin !== origin) return;
    var d = ev.data;
    if (!d || d.type !== 'bw:height') return;
    var h = Number(d.height);
    if (isFinite(h) && h >= 200 && h <= 4000) frame.style.height = Math.ceil(h) + 'px';
  });
})();
