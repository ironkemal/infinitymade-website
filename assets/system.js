// InfinityMade · Shared interactions
(function () {
  // Scroll reveal
  const reveal = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        reveal.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -80px 0px', threshold: 0.05 });
  document.querySelectorAll('[data-reveal]').forEach(el => reveal.observe(el));

  // Nav hide on scroll down, show on scroll up
  const nav = document.getElementById('nav');
  if (nav) {
    let lastY = 0;
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (y > 200 && y > lastY + 4) nav.classList.add('hidden');
      else if (y < lastY - 4) nav.classList.remove('hidden');
      lastY = y;
    }, { passive: true });
  }
})();
