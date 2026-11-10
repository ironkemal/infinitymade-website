/** Anamnese-only adapter of the confirmed einstellungen-nav.js section pattern.
 * Original fields stay intact; Alt restores their exact parent/order. No queries.
 */
export function montiereAnamneseAbschnitte({ uid, scope }) {
  const panel = document.getElementById('panel-anamnese');
  if (!panel || !uid?.() || !scope?.()) return null;
  const boundScope = scope();
  const boundUid = uid();
  let content = null, nav = null, moves = [], spy = null, sourceObserver = null;
  let queued = false, activeId = null, fixedUntil = 0;
  const eligible = () => uid() === boundUid && scope() === boundScope && document.documentElement.dataset.design === 'neu';
  const mark = id => {
    activeId = id;
    for (const link of nav?.querySelectorAll('a') || []) {
      const active = link.dataset.ziel === id;
      link.classList.toggle('aktiv', active);
      if (active) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current');
    }
  };
  function rebuild() {
    if (!eligible()) return restore();
    if (!content || !panel.classList.contains('active')) return;
    const focused = nav.contains(document.activeElement) ? document.activeElement.dataset.ziel : null;
    const sections = [...content.querySelectorAll('#anamPhysioForm > .card, #anamDynForm .anam-gruppe[data-gruppe]')].filter(element => element.getClientRects().length && !element.closest('[hidden], [inert]') && getComputedStyle(element).visibility !== 'hidden');
    const links = [];
    for (const [index, section] of sections.entries()) {
      const title = section.querySelector('h3,h4')?.textContent?.trim();
      if (!title) continue;
      if (!section.id) {
        let suffix = index;
        while (document.getElementById(`px-formular-anamnese-${suffix}`)) suffix++;
        section.id = `px-formular-anamnese-${suffix}`;
      }
      const link = document.createElement('a');
      link.href = `#${section.id}`; link.dataset.ziel = section.id;
      link.className = 'px-abschnitt'; link.textContent = title;
      links.push(link);
    }
    nav.replaceChildren(...links); nav.hidden = links.length === 0;
    mark(links.some(link => link.dataset.ziel === activeId) ? activeId : links[0]?.dataset.ziel);
    if (focused) links.find(link => link.dataset.ziel === focused)?.focus({ preventScroll: true });
    spy?.disconnect();
    spy = new IntersectionObserver(entries => {
      const first = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (first && Date.now() > fixedUntil) mark(first.target.id);
    }, { rootMargin: '-80px 0px -60% 0px' });
    for (const section of sections) spy.observe(section);
  }
  function restore() {
    if (!content) return;
    sourceObserver?.disconnect(); spy?.disconnect();
    const focus = document.activeElement;
    const fallback = nav.contains(focus) ? document.getElementById(focus.dataset.ziel) : null;
    for (const { node, anchor } of moves) { anchor.after(node); anchor.remove(); }
    nav.remove(); content.remove(); content = nav = null; moves = [];
    panel.classList.remove('px-formular-nav');
    if (focus?.isConnected && panel.contains(focus)) focus.focus({ preventScroll: true });
    else if (fallback?.isConnected) { fallback.setAttribute('tabindex', '-1'); fallback.focus({ preventScroll: true }); }
  }
  function update() {
    if (!eligible()) return restore();
    if (!panel.classList.contains('active')) return;
    if (!content) {
      const focus = document.activeElement;
      const selection = focus && typeof focus.selectionStart === 'number' ? [focus.selectionStart, focus.selectionEnd] : null;
      const children = [...panel.children].filter(element => !element.classList.contains('panel-header'));
      content = document.createElement('div'); content.className = 'px-formular-inhalt';
      nav = document.createElement('nav'); nav.className = 'px-abschnitte'; nav.setAttribute('aria-label', 'Abschnitte: Anamnese');
      moves = children.map(node => { const anchor = document.createComment('anamnese-original'); node.before(anchor); return { node, anchor }; });
      panel.append(nav, content);
      for (const { node } of moves) content.append(node);
      panel.classList.add('px-formular-nav');
      nav.addEventListener('click', event => {
        const link = event.target.closest('a[data-ziel]');
        if (!link || !eligible() || panel.closest('#kioskFormContent')) return;
        event.preventDefault();
        const target = [...content.querySelectorAll('[id]')].find(element => element.id === link.dataset.ziel);
        if (!target) return;
        target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        fixedUntil = Date.now() + 1200; mark(target.id);
        target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true });
      });
      sourceObserver = new MutationObserver(() => {
        if (queued) return; queued = true;
        queueMicrotask(() => { queued = false; rebuild(); });
      });
      sourceObserver.observe(content, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'style'] });
      if (focus?.isConnected && content.contains(focus)) { focus.focus({ preventScroll: true }); if (selection) focus.setSelectionRange(...selection); }
    }
    rebuild();
  }
  const designObserver = new MutationObserver(update);
  designObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-design'] });
  const panelObserver = new MutationObserver(update);
  panelObserver.observe(panel, { attributes: true, attributeFilter: ['class'] });
  update();
  return { aktualisieren: update, zerstoeren() { designObserver.disconnect(); panelObserver.disconnect(); restore(); } };
}
