(function () {
  var WEBSITE_ID = 'fa4b493b-35cd-4555-b667-b6a5439471e6';
  var SRC = 'https://analytics.infinitymade.de/script.js';
  var KEY = 'cookie_consent';

  function injectUmami() {
    var s = document.createElement('script');
    s.defer = true;
    s.src = SRC;
    s.setAttribute('data-website-id', WEBSITE_ID);
    document.head.appendChild(s);
  }

  function hideBanner(el) {
    el.style.display = 'none';
  }

  function showBanner() {
    var banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#1a1a2e;color:#fff;padding:16px 24px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;font-family:system-ui,sans-serif;font-size:14px;';

    var text = document.createElement('span');
    text.style.cssText = 'flex:1;min-width:200px;';
    text.textContent = 'Diese Website verwendet Analyse-Cookies (Umami), um die Nutzung zu verstehen.';

    var btnStyle = 'background:transparent;border:1px solid #fff;color:#fff;padding:8px 20px;border-radius:4px;cursor:pointer;font-size:14px;';

    var decline = document.createElement('button');
    decline.textContent = 'Ablehnen';
    decline.style.cssText = btnStyle;
    decline.addEventListener('click', function () {
      localStorage.setItem(KEY, 'declined');
      hideBanner(banner);
    });

    var accept = document.createElement('button');
    accept.textContent = 'Akzeptieren';
    accept.style.cssText = btnStyle + 'background:#fff;color:#1a1a2e;';
    accept.addEventListener('click', function () {
      localStorage.setItem(KEY, 'accepted');
      injectUmami();
      hideBanner(banner);
    });

    banner.appendChild(text);
    banner.appendChild(decline);
    banner.appendChild(accept);
    document.body.appendChild(banner);
  }

  function init() {
    var consent = localStorage.getItem(KEY);
    if (consent === 'accepted') {
      injectUmami();
    } else if (consent === null) {
      showBanner();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
