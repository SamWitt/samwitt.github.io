(function () {
  const navToggle = document.querySelector('[data-nav-toggle]');
  const siteNav = document.querySelector('.site-nav');
  if (navToggle && siteNav) {
    navToggle.addEventListener('click', () => {
      const isOpen = siteNav.dataset.open === 'true';
      siteNav.dataset.open = String(!isOpen);
      navToggle.setAttribute('aria-expanded', String(!isOpen));
    });

    siteNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        if (siteNav.dataset.open === 'true') {
          siteNav.dataset.open = 'false';
          navToggle.setAttribute('aria-expanded', 'false');
        }
      });
    });
  }

  function initTabbedWindow(root, selectors) {
    if (!root || !selectors) return;
    const { optionSelector, panelSelector } = selectors;
    const options = Array.from(root.querySelectorAll(optionSelector));
    if (!options.length) return;

    const panels = new Map();
    root.querySelectorAll(panelSelector).forEach((panel) => {
      const key = panel.dataset.option;
      if (!key) return;
      panels.set(key, panel);
      panel.hidden = !panel.classList.contains('is-active');
    });

    const activate = (button) => {
      if (!button) return;
      const key = button.dataset.option;
      if (!key || !panels.has(key)) return;

      options.forEach((opt) => {
        const active = opt === button;
        opt.classList.toggle('is-active', active);
        opt.setAttribute('aria-selected', String(active));
        opt.setAttribute('aria-expanded', String(active));
      });

      panels.forEach((panel, panelKey) => {
        const active = panelKey === key;
        panel.classList.toggle('is-active', active);
        panel.hidden = !active;
      });
    };

    const initial = options.find((btn) => btn.classList.contains('is-active')) || options[0];
    if (initial) activate(initial);

    options.forEach((btn, index) => {
      btn.addEventListener('click', () => activate(btn));
      btn.addEventListener('keydown', (event) => {
        const { key } = event;
        if (key === 'ArrowUp' || key === 'ArrowLeft') {
          event.preventDefault();
          const prev = options[(index - 1 + options.length) % options.length];
          prev.focus();
          activate(prev);
        } else if (key === 'ArrowDown' || key === 'ArrowRight') {
          event.preventDefault();
          const next = options[(index + 1) % options.length];
          next.focus();
          activate(next);
        }
      });
    });
  }

  function initPublishersCarousel(section) {
    if (!section) return;
    const viewport = section.querySelector('.publisher-viewport');
    const prev = section.querySelector('[data-carousel-prev]');
    const next = section.querySelector('[data-carousel-next]');
    if (!viewport || (!prev && !next)) return;

    const scrollAmount = () => viewport.clientWidth * 0.8;

    const scrollByAmount = (direction) => {
      viewport.scrollBy({ left: scrollAmount() * direction, behavior: 'smooth' });
    };

    prev?.addEventListener('click', () => scrollByAmount(-1));
    next?.addEventListener('click', () => scrollByAmount(1));

    viewport.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        scrollByAmount(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        scrollByAmount(1);
      }
    });
  }

  function initFooterClock() {
    const clock = document.querySelector('[data-clock]');
    if (!clock) return;

    const render = () => {
      const now = new Date();
      const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      clock.textContent = time;
    };

    render();
    setInterval(render, 30_000);
  }

  function initFooterYear() {
    const yearEl = document.querySelector('[data-year]');
    if (!yearEl) return;
    yearEl.textContent = String(new Date().getFullYear());
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-tabbed-window]').forEach((windowEl) => {
      initTabbedWindow(windowEl, {
        optionSelector: '.about-option',
        panelSelector: '.about-panel',
      });
    });

    initPublishersCarousel(document.querySelector('.publisher-carousel'));
    initFooterClock();
    initFooterYear();
  });
})();
