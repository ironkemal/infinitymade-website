/* ==========================================================================
   Praxura Landing Page Interactions v3 (assets/landing.js)
   - Floating Nav + Mobile Drawer
   - Full Ersparnis-Rechner (Heute vs. Praxura) + Consent-gated Cookie & Umami
   - Sticky Workflow + Full-Screen Click-to-Zoom Lightbox
   - Monotonic Tagline Reveal + Pricing Toggle + Inline Contact Form
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 1. Floating Pill Nav & Mobile Drawer ── */
  var navPill = document.getElementById('navPill');
  if (navPill) {
    var onScrollNav = function () { navPill.classList.toggle('is-scrolled', window.scrollY > 16); };
    onScrollNav();
    window.addEventListener('scroll', onScrollNav, { passive: true });
  }

  var burger = document.getElementById('navHamburger');
  var drawer = document.getElementById('navMobileMenu');
  var drawerClose = document.getElementById('navMobileClose');
  if (burger && drawer) {
    var openMenu = function () {
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      burger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      if (drawerClose) drawerClose.focus();
    };
    var closeMenu = function () {
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      burger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    };
    burger.addEventListener('click', openMenu);
    if (drawerClose) drawerClose.addEventListener('click', closeMenu);
    drawer.querySelectorAll('a').forEach(function (link) { link.addEventListener('click', closeMenu); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) { closeMenu(); burger.focus(); }
    });
  }

  /* ── 2. Full Ersparnis-Rechner (Heute vs. Praxura) + Consent-gated Cookie & Umami ── */
  var calcRoot = document.getElementById('rechner');
  if (calcRoot) {
    var PRAXURA_PLANS = {
      solo: { name: 'Praxura Solo', size: '1 Behandler:in', price: 59 },
      praxis: { name: 'Praxura Praxis', size: '2–5 Behandler:innen', price: 149 },
      team: { name: 'Praxura Team', size: '6–10 Behandler:innen', price: 249 },
      verbund: { name: 'Groß & Verbund', size: 'ab 11 Behandler:innen', price: null }
    };

    var state = {
      tier: 'praxis',
      currentSoftware: 120,
      usesBilling: true,
      gkvRevenue: 10000,
      billingRate: 2.5
    };

    var hasConsent = function () {
      try { return localStorage.getItem('cookie_consent') === 'accepted'; } catch (_) { return false; }
    };

    // Restore saved calculator state if user consented to cookies
    if (hasConsent()) {
      try {
        var match = document.cookie.match(/(?:^|;\s*)praxura_rechner=([^;]+)/);
        if (match) {
          var saved = JSON.parse(decodeURIComponent(match[1]));
          if (saved && typeof saved === 'object') {
            if (PRAXURA_PLANS[saved.tier]) state.tier = saved.tier;
            if (typeof saved.currentSoftware === 'number') state.currentSoftware = saved.currentSoftware;
            if (typeof saved.usesBilling === 'boolean') state.usesBilling = saved.usesBilling;
            if (typeof saved.gkvRevenue === 'number') state.gkvRevenue = saved.gkvRevenue;
            if (typeof saved.billingRate === 'number') state.billingRate = saved.billingRate;
          }
        }
      } catch (_) {}
    }

    var tierBtns = calcRoot.querySelectorAll('[data-rc-tier]');
    var swRange = document.getElementById('rcSoftwareRange');
    var swInput = document.getElementById('rcSoftwareInput');
    var billBtns = calcRoot.querySelectorAll('[data-rc-billing]');
    var billFields = document.getElementById('rcBillingFields');
    var revRange = document.getElementById('rcRevenueRange');
    var revInput = document.getElementById('rcRevenueInput');
    var revPresets = calcRoot.querySelectorAll('[data-rc-rev]');
    var rateInput = document.getElementById('rcRateInput');
    var rateBtns = calcRoot.querySelectorAll('[data-rc-rate]');

    var outTodayMonth = document.getElementById('rcTodayMonth');
    var outTodayYear = document.getElementById('rcTodayYear');
    var outTodayDetail = document.getElementById('rcTodayDetail');
    var outPxName = document.getElementById('rcPxName');
    var outPxMonth = document.getElementById('rcPxMonth');
    var outPxYear = document.getElementById('rcPxYear');
    var outSavingsBox = document.getElementById('rcSavingsBox');
    var outSavingsKicker = document.getElementById('rcSavingsKicker');
    var outSavingsBig = document.getElementById('rcSavingsBig');
    var outSavingsSub = document.getElementById('rcSavingsSub');

    var fmtEUR = new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    });

    var trackTimer = null;
    var persistAndTrack = function (yearSavings) {
      if (!hasConsent()) return;
      try {
        var encoded = encodeURIComponent(JSON.stringify(state));
        document.cookie = 'praxura_rechner=' + encoded + '; Path=/; SameSite=Lax; Max-Age=2592000';
      } catch (_) {}
      window.clearTimeout(trackTimer);
      trackTimer = window.setTimeout(function () {
        if (window.umami && typeof window.umami.track === 'function') {
          window.umami.track('rechner_eingabe', {
            groesse: state.tier,
            software_monat: state.currentSoftware,
            hat_abrechnung: state.usesBilling,
            gkv_umsatz: state.usesBilling ? state.gkvRevenue : 0,
            provision_prozent: state.usesBilling ? state.billingRate : 0,
            ersparnis_jahr: yearSavings
          });
        }
      }, 1200);
    };

    var syncUI = function (shouldPersist) {
      var plan = PRAXURA_PLANS[state.tier] || PRAXURA_PLANS.praxis;
      var provMonth = state.usesBilling ? Math.round(state.gkvRevenue * (state.billingRate / 100)) : 0;
      var todayMonth = Math.max(0, Math.round(state.currentSoftware) + provMonth);
      var todayYear = todayMonth * 12;

      tierBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.rcTier === state.tier ? 'true' : 'false'); });
      billBtns.forEach(function (b) { b.setAttribute('aria-pressed', (b.dataset.rcBilling === 'yes') === state.usesBilling ? 'true' : 'false'); });
      if (billFields) billFields.hidden = !state.usesBilling;

      if (swRange) swRange.value = Math.min(600, state.currentSoftware);
      if (swInput && document.activeElement !== swInput) swInput.value = state.currentSoftware;
      if (revRange) revRange.value = Math.min(100000, state.gkvRevenue);
      if (revInput && document.activeElement !== revInput) revInput.value = state.gkvRevenue;
      if (rateInput && document.activeElement !== rateInput) rateInput.value = state.billingRate;

      revPresets.forEach(function (b) { b.setAttribute('aria-pressed', Number(b.dataset.rcRev) === state.gkvRevenue ? 'true' : 'false'); });
      rateBtns.forEach(function (b) { b.setAttribute('aria-pressed', Math.abs(Number(b.dataset.rcRate) - state.billingRate) < 0.001 ? 'true' : 'false'); });

      if (outTodayMonth) outTodayMonth.textContent = fmtEUR.format(todayMonth) + ' / Monat';
      if (outTodayYear) outTodayYear.textContent = fmtEUR.format(todayYear) + ' / Jahr';
      if (outTodayDetail) {
        outTodayDetail.textContent = state.usesBilling
          ? 'Software (' + fmtEUR.format(state.currentSoftware) + ') + Provision (' + fmtEUR.format(provMonth) + ')'
          : 'Aktuelle Software ohne Abrechnungszentrum';
      }

      if (outPxName) outPxName.textContent = plan.name + ' (' + plan.size + ')';

      var yearSavings = null;
      if (plan.price === null) {
        if (outPxMonth) outPxMonth.textContent = 'Individuell';
        if (outPxYear) outPxYear.textContent = 'nach Angebot · 0 % Provision';
        if (outSavingsBox) outSavingsBox.classList.add('is-neutral');
        if (outSavingsKicker) outSavingsKicker.textContent = 'Verbund & Großpraxis';
        if (outSavingsBig) outSavingsBig.textContent = 'Individuelles Angebot';
        if (outSavingsSub) outSavingsSub.textContent = 'Bei ' + fmtEUR.format(provMonth * 12) + ' jährlicher Provision erstellen wir Ihnen ein passendes Festangebot.';
      } else {
        var pxYear = plan.price * 12;
        var diffMonth = todayMonth - plan.price;
        var diffYear = diffMonth * 12;
        yearSavings = diffYear;

        if (outPxMonth) outPxMonth.textContent = fmtEUR.format(plan.price) + ' / Monat';
        if (outPxYear) outPxYear.textContent = fmtEUR.format(pxYear) + ' / Jahr · 0 % Provision';

        if (diffMonth > 0) {
          if (outSavingsBox) outSavingsBox.classList.remove('is-neutral');
          if (outSavingsKicker) outSavingsKicker.textContent = 'Ihre geschätzte Ersparnis';
          if (outSavingsBig) outSavingsBig.textContent = fmtEUR.format(diffYear) + ' / Jahr';
          if (outSavingsSub) outSavingsSub.textContent = 'Das entspricht rund ' + fmtEUR.format(diffMonth) + ' pro Monat weniger als heute.';
        } else {
          if (outSavingsBox) outSavingsBox.classList.add('is-neutral');
          if (outSavingsKicker) outSavingsKicker.textContent = 'Ergebnis Ihrer Angaben';
          if (outSavingsBig) outSavingsBig.textContent = fmtEUR.format(plan.price) + ' / Monat fix';
          if (outSavingsSub) outSavingsSub.textContent = 'Fester Preis inklusive Verordnungsprüfung vor Behandlungsbeginn und eigener Praxis-Cloud in Deutschland.';
        }
      }

      if (shouldPersist) persistAndTrack(yearSavings);
    };

    tierBtns.forEach(function (b) {
      b.addEventListener('click', function () { state.tier = b.dataset.rcTier; syncUI(true); });
    });
    billBtns.forEach(function (b) {
      b.addEventListener('click', function () { state.usesBilling = b.dataset.rcBilling === 'yes'; syncUI(true); });
    });
    if (swRange) swRange.addEventListener('input', function () { state.currentSoftware = Number(swRange.value) || 0; syncUI(true); });
    if (swInput) swInput.addEventListener('input', function () { state.currentSoftware = Math.max(0, Number(swInput.value) || 0); syncUI(true); });
    if (revRange) revRange.addEventListener('input', function () { state.gkvRevenue = Number(revRange.value) || 0; syncUI(true); });
    if (revInput) revInput.addEventListener('input', function () { state.gkvRevenue = Math.max(0, Number(revInput.value) || 0); syncUI(true); });
    revPresets.forEach(function (b) {
      b.addEventListener('click', function () { state.gkvRevenue = Number(b.dataset.rcRev) || 10000; syncUI(true); });
    });
    if (rateInput) {
      rateInput.addEventListener('input', function () {
        var raw = String(rateInput.value || '').replace(',', '.');
        var val = parseFloat(raw);
        state.billingRate = isNaN(val) ? 0 : Math.max(0, Math.min(15, val));
        syncUI(true);
      });
    }
    rateBtns.forEach(function (b) {
      b.addEventListener('click', function () { state.billingRate = Number(b.dataset.rcRate) || 0; syncUI(true); });
    });

    syncUI(false);
  }

  /* ── 3. Sticky Workflow + Full-Screen Click-to-Zoom Lightbox ── */
  var wfSteps = document.querySelectorAll('.wf-step');
  var wfImg = document.getElementById('workflowImg');
  var wfZoomBtn = document.getElementById('workflowZoomBtn');
  var wfCapLabel = document.getElementById('workflowCapLabel');
  var wfCapCount = document.getElementById('workflowCapCount');

  var lbDlg = document.getElementById('lightboxDlg');
  var lbImg = document.getElementById('lightboxImg');
  var lbTitle = document.getElementById('lightboxTitle');
  var lbPrev = document.getElementById('lightboxPrev');
  var lbNext = document.getElementById('lightboxNext');
  var lbClose = document.getElementById('lightboxClose');

  if (wfSteps.length && wfImg) {
    var activeWf = 0;

    var updateLightboxContent = function () {
      var step = wfSteps[activeWf];
      if (!step || !lbImg) return;
      lbImg.src = step.dataset.wfImg;
      lbImg.alt = step.dataset.wfAlt || '';
      if (lbTitle) lbTitle.textContent = (step.dataset.wfLabel || '') + ' (' + (activeWf + 1) + ' / ' + wfSteps.length + ')';
    };

    var setWorkflowStep = function (idx) {
      activeWf = (idx + wfSteps.length) % wfSteps.length;
      var step = wfSteps[activeWf];
      if (!step) return;
      wfSteps.forEach(function (s, i) {
        s.classList.toggle('is-active', i === activeWf);
        s.setAttribute('aria-pressed', i === activeWf ? 'true' : 'false');
      });
      var nextSrc = step.dataset.wfImg;
      var nextAlt = step.dataset.wfAlt || '';
      if (wfCapLabel) wfCapLabel.textContent = step.dataset.wfLabel || '';
      if (wfCapCount) wfCapCount.textContent = '0' + (activeWf + 1) + ' / 0' + wfSteps.length;
      if (wfImg.getAttribute('src') !== nextSrc) {
        wfImg.classList.add('is-swapping');
        window.setTimeout(function () {
          wfImg.src = nextSrc;
          wfImg.alt = nextAlt;
          wfImg.classList.remove('is-swapping');
        }, reduceMotion ? 0 : 90);
      }
      if (lbDlg && lbDlg.open) updateLightboxContent();
    };

    wfSteps.forEach(function (step, idx) {
      step.addEventListener('click', function () { setWorkflowStep(idx); });
    });

    if (wfZoomBtn && lbDlg && typeof lbDlg.showModal === 'function') {
      wfZoomBtn.addEventListener('click', function () {
        updateLightboxContent();
        lbDlg.showModal();
      });
      if (lbClose) lbClose.addEventListener('click', function () { lbDlg.close(); });
      if (lbPrev) lbPrev.addEventListener('click', function () { setWorkflowStep(activeWf - 1); });
      if (lbNext) lbNext.addEventListener('click', function () { setWorkflowStep(activeWf + 1); });
      lbDlg.addEventListener('click', function (e) { if (e.target === lbDlg) lbDlg.close(); });
      lbDlg.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') setWorkflowStep(activeWf - 1);
        if (e.key === 'ArrowRight') setWorkflowStep(activeWf + 1);
      });
    }
  }

  /* ── 4. Tagline Word-by-Word Scroll Reveal (Monotonic) ── */
  var taglineEl = document.getElementById('taglineReveal');
  if (taglineEl) {
    var words = taglineEl.querySelectorAll('.tagline-word');
    if (reduceMotion) {
      words.forEach(function (w) { w.classList.add('is-lit'); });
    } else if (words.length) {
      var ticking = false;
      var maxLit = 0;
      var updateTagline = function () {
        ticking = false;
        var rect = taglineEl.getBoundingClientRect();
        var vh = window.innerHeight || 800;
        var start = vh * 0.88;
        var end = vh * 0.34;
        var progress = Math.max(0, Math.min(1, (start - rect.top) / Math.max(1, start - end)));
        var litCount = Math.round(progress * words.length);
        if (litCount > maxLit) maxLit = litCount;
        words.forEach(function (w, i) { w.classList.toggle('is-lit', i < maxLit); });
      };
      var req = function () { if (!ticking) { ticking = true; window.requestAnimationFrame(updateTagline); } };
      updateTagline();
      window.addEventListener('scroll', req, { passive: true });
      window.addEventListener('resize', req, { passive: true });
    }
  }

  /* ── 5. Pricing Tier Picker + Monthly / Annual Toggle ── */
  var pricingRoot = document.getElementById('preise');
  if (pricingRoot) {
    var pTierBtns = pricingRoot.querySelectorAll('[data-tier-btn]');
    var pTierCards = pricingRoot.querySelectorAll('.price-card[data-tier]');
    var pCycleBtns = pricingRoot.querySelectorAll('[data-cycle-btn]');
    var pPriceNodes = pricingRoot.querySelectorAll('[data-price-month]');
    var pPriceUnits = pricingRoot.querySelectorAll('[data-price-unit]');

    pTierBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tier = btn.dataset.tierBtn;
        pTierBtns.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
        pTierCards.forEach(function (card) { card.classList.toggle('is-match', card.dataset.tier === tier); });
      });
    });

    pCycleBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var isAnnual = btn.dataset.cycleBtn === 'annual';
        pCycleBtns.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
        pPriceNodes.forEach(function (el) { el.textContent = isAnnual ? el.dataset.priceAnnual : el.dataset.priceMonth; });
        pPriceUnits.forEach(function (el) { el.textContent = isAnnual ? '/ Monat (jährlich)' : '/ Monat'; });
      });
    });
  }

  /* ── 6. Inline Contact Form (POST /api/contact) ── */
  var contactForm = document.getElementById('contactForm');
  if (contactForm) {
    var fVorname = document.getElementById('vorname');
    var fNachname = document.getElementById('nachname');
    var fEmail = document.getElementById('email');
    var fFirma = document.getElementById('firma');
    var fNachricht = document.getElementById('nachricht');
    var fSubmit = document.getElementById('contactSubmit');
    var fNotice = document.getElementById('contactNotice');
    var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    var setFieldError = function (input, msg) {
      var errEl = document.getElementById(input.id + 'Error');
      if (msg) {
        input.setAttribute('aria-invalid', 'true');
        if (errEl) { errEl.textContent = msg; errEl.classList.add('is-visible'); }
        return false;
      }
      input.removeAttribute('aria-invalid');
      if (errEl) { errEl.textContent = ''; errEl.classList.remove('is-visible'); }
      return true;
    };

    var validateField = function (input) {
      var val = (input.value || '').trim();
      if (input === fVorname && !val) return setFieldError(input, 'Bitte geben Sie Ihren Vornamen an.');
      if (input === fNachname && !val) return setFieldError(input, 'Bitte geben Sie Ihren Nachnamen an.');
      if (input === fEmail) {
        if (!val) return setFieldError(input, 'Bitte geben Sie Ihre E-Mail-Adresse an.');
        if (!emailRe.test(val)) return setFieldError(input, 'Bitte prüfen Sie Ihre E-Mail-Adresse (z. B. name@praxis.de).');
      }
      if (input === fNachricht && !val) return setFieldError(input, 'Bitte schreiben Sie kurz, wobei wir helfen können.');
      return setFieldError(input, '');
    };

    [fVorname, fNachname, fEmail, fNachricht].forEach(function (inp) {
      if (!inp) return;
      inp.addEventListener('blur', function () { validateField(inp); });
      inp.addEventListener('input', function () { if (inp.getAttribute('aria-invalid') === 'true') validateField(inp); });
    });

    var showNotice = function (type, html) {
      if (!fNotice) return;
      fNotice.className = 'form-notice ' + (type === 'success' ? 'is-success' : 'is-error');
      fNotice.setAttribute('role', type === 'success' ? 'status' : 'alert');
      fNotice.innerHTML = html;
    };

    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (fNotice) { fNotice.className = 'form-notice'; fNotice.textContent = ''; }

      var firstInvalid = null;
      [fVorname, fNachname, fEmail, fNachricht].forEach(function (inp) {
        if (!validateField(inp) && !firstInvalid) firstInvalid = inp;
      });
      if (firstInvalid) { firstInvalid.focus(); return; }

      var payload = {
        vorname: fVorname.value.trim(),
        nachname: fNachname.value.trim(),
        firma: fFirma ? fFirma.value.trim() : '',
        email: fEmail.value.trim(),
        nachricht: fNachricht.value.trim()
      };

      var originalText = fSubmit.textContent;
      fSubmit.disabled = true;
      fSubmit.textContent = 'Wird gesendet…';

      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            return { ok: res.ok, status: res.status, data: data };
          });
        })
        .then(function (result) {
          if (result.ok && result.data && result.data.ok) {
            var safeName = payload.vorname.replace(/[&<>"']/g, function (c) {
              return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
            });
            showNotice(
              'success',
              'Vielen Dank, ' + safeName + '. Ihre Nachricht ist angekommen. Unser Team meldet sich werktags per E-Mail bei Ihnen. Wenn Sie direkt einen Termin wählen möchten: <a href="/demo-booking.html">Analysegespräch buchen</a>.'
            );
            contactForm.reset();
          } else {
            var msg = (result.data && result.data.error)
              ? result.data.error
              : 'Die Nachricht konnte gerade nicht gesendet werden. Bitte versuchen Sie es erneut oder schreiben Sie direkt an <a href="mailto:kontakt@praxura.de">kontakt@praxura.de</a>.';
            showNotice('error', msg);
          }
        })
        .catch(function () {
          showNotice(
            'error',
            'Verbindungsproblem beim Senden. Ihre Eingaben bleiben erhalten. Bitte versuchen Sie es erneut oder schreiben Sie an <a href="mailto:kontakt@praxura.de">kontakt@praxura.de</a>.'
          );
        })
        .finally(function () {
          fSubmit.disabled = false;
          fSubmit.textContent = originalText;
        });
    });
  }

  /* ── 7. Scroll Reveals & Mobile Sticky Bar ── */
  var reveals = document.querySelectorAll('[data-reveal]');
  if (reveals.length) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      reveals.forEach(function (el) { el.classList.add('is-visible'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { entry.target.classList.add('is-visible'); io.unobserve(entry.target); }
        });
      }, { rootMargin: '0px 0px -60px 0px', threshold: 0.05 });
      reveals.forEach(function (el) { io.observe(el); });
    }
  }

  var stickyBar = document.getElementById('bookSticky');
  var heroEl = document.querySelector('.hero');
  var contactEl = document.getElementById('kontakt');
  if (stickyBar && heroEl && 'IntersectionObserver' in window) {
    var heroOut = false, contactIn = false;
    var syncSticky = function () {
      var show = heroOut && !contactIn && window.innerWidth <= 760;
      stickyBar.classList.toggle('is-on', show);
      stickyBar.setAttribute('aria-hidden', show ? 'false' : 'true');
      var link = stickyBar.querySelector('a');
      if (link) link.tabIndex = show ? 0 : -1;
      document.body.classList.toggle('has-book-sticky', show);
    };
    new IntersectionObserver(function (e) { heroOut = !e[0].isIntersecting; syncSticky(); }).observe(heroEl);
    if (contactEl) new IntersectionObserver(function (e) { contactIn = e[0].isIntersecting; syncSticky(); }).observe(contactEl);
    window.addEventListener('resize', syncSticky, { passive: true });
  }
})();
