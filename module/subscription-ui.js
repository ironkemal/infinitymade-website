/**
 * subscription-ui.js — die zwei Abo-Buttons in den Einstellungen.
 *
 * Auf der Box (IST_KUTU) gibt es kein Stripe-Abo: die On-Prem-Lizenz läuft
 * über einen Vertrag, nicht über Checkout, und `onboarding.html`/Stripe sind
 * bewusst nicht im Kundenpaket (`onprem/frontend.Dockerfile`). Ein Klick auf
 * „Upgrade" landete deshalb auf einer Seite, die es in der Box nicht gibt —
 * gemeldet 14.09.2026, `onprem/REGISTER.md` O-106. Verweis auf `app.praxura.de`
 * wäre keine Verbesserung: ein bestehender Kunde bekäme den SaaS-Neuanlage-Flow
 * gezeigt, und die Box hätte wieder eine fest codierte Zentraladresse (O-19
 * verbietet das ausserhalb weniger geprüfter Ausnahmen). Lösung: Buttons weg,
 * Kontakthinweis statt.
 */
export function wireAboButtons({ istKutu, portalRedirect }) {
  if (istKutu) {
    document.getElementById('subPortalBtn')?.remove();
    const up = document.getElementById('subUpgradeBtn');
    if (up) up.outerHTML = '<span style="font-size:13px;color:var(--text-muted)">Lizenz &amp; Vertrag: läuft direkt über Praxura · kontakt@praxura.de</span>';
    return;
  }
  document.getElementById('subPortalBtn').addEventListener('click', portalRedirect);
  document.getElementById('subUpgradeBtn').addEventListener('click', () => { window.location.href = '/onboarding.html?step=plan'; });
}
