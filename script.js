(function(){
  const navToggle = document.querySelector('[data-nav-toggle]');
  const siteNav = document.querySelector('.site-nav');
  if(navToggle && siteNav){
    navToggle.addEventListener('click', () => {
      const isOpen = siteNav.dataset.open === 'true';
      siteNav.dataset.open = String(!isOpen);
      navToggle.setAttribute('aria-expanded', String(!isOpen));
    });
    siteNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        if(siteNav.dataset.open === 'true'){
          siteNav.dataset.open = 'false';
          navToggle.setAttribute('aria-expanded', 'false');
        }
      });
    });
  }

  function initTabbedWindow(windowEl, { optionSelector, panelSelector } = {}){
    if(!windowEl || !optionSelector || !panelSelector) return;
    const options = Array.from(windowEl.querySelectorAll(optionSelector));
    if(!options.length) return;

    const panels = new Map();
    windowEl.querySelectorAll(panelSelector).forEach(panel => {
      const key = panel.dataset.option;
      if(!key) return;
      panels.set(key, panel);
      panel.hidden = !panel.classList.contains('is-active');
    });
    if(!panels.size) return;

    const activate = (button) => {
      if(!button) return;
      const key = button.dataset.option;
      if(!key || !panels.has(key)) return;

      options.forEach(btn => {
        const active = btn === button;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', String(active));
        btn.setAttribute('aria-expanded', String(active));
      });

      panels.forEach((panel, panelKey) => {
        const active = panelKey === key;
        panel.classList.toggle('is-active', active);
        panel.hidden = !active;
      });
    };

    const initial = options.find(btn => btn.classList.contains('is-active')) || options[0];
    if(initial) activate(initial);

    options.forEach((btn, index) => {
      btn.addEventListener('click', () => activate(btn));
      btn.addEventListener('keydown', (event) => {
        const { key } = event;
        if(key === 'ArrowUp' || key === 'ArrowLeft'){
          event.preventDefault();
          const prev = options[(index - 1 + options.length) % options.length];
          prev.focus(); activate(prev);
        } else if(key === 'ArrowDown' || key === 'ArrowRight'){
          event.preventDefault();
          const next = options[(index + 1) % options.length];
          next.focus(); activate(next);
        }
      });
    });
  }

  function initPublishersCarousel(windowEl){
    if(!windowEl) return;
    const carousel = windowEl.querySelector('.publisher-carousel');
    const viewport = carousel?.querySelector('.publisher-viewport');
    const track = carousel?.querySelector('.publisher-track');
    const slides = track ? Array.from(track.children) : [];
    if(!carousel || !viewport || !track || !slides.length) return;

    const prevBtn = carousel.querySelector('[data-carousel-prev]');
    const nextBtn = carousel.querySelector('[data-carousel-next]');
    const prefersReducedMotion = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : { matches: false };

    let currentIndex = 0;
    let timerId = null;
    let isHovering = false;
    let hasFocus = false;
    let paddingLeft = 0;

    const totalSlides = slides.length;
    slides.forEach((slide) => {
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', 'slide');
    });

    const recalcMetrics = () => {
      const style = window.getComputedStyle(track);
      paddingLeft = parseFloat(style.paddingLeft) || 0;
    };

    const setSlideVisibility = () => {
      slides.forEach((slide, index) => {
        const isActive = index === currentIndex;
        slide.classList.toggle('is-active', isActive);
        slide.setAttribute('aria-hidden', String(!isActive));
      });
    };

    const updateViewportLabel = () => {
      const label = slides[currentIndex]?.dataset.label || `Publisher ${currentIndex + 1}`;
      viewport.setAttribute('aria-label', `${label} (${currentIndex + 1} of ${totalSlides})`);
    };

    const updateTransform = () => {
      const activeSlide = slides[currentIndex];
      if(!activeSlide) return;
      const offset = Math.max(0, activeSlide.offsetLeft - paddingLeft);
      track.style.transform = `translateX(-${offset}px)`;
      setSlideVisibility();
      updateViewportLabel();
    };

    const stopTimer = () => {
      if(timerId !== null){
        clearInterval(timerId);
        timerId = null;
      }
    };

    const shouldAutoPlay = () => {
      return !prefersReducedMotion.matches && !isHovering && !hasFocus && !document.hidden;
    };

    const refreshTimer = () => {
      stopTimer();
      if(shouldAutoPlay()){
        timerId = window.setInterval(() => {
          setIndex((currentIndex + 1) % totalSlides, { fromTimer: true });
        }, 6000);
      }
    };

    const setIndex = (index, { fromTimer = false } = {}) => {
      const normalized = (index + totalSlides) % totalSlides;
      if(normalized === currentIndex && !fromTimer){
        refreshTimer();
        return;
      }
      currentIndex = normalized;
      updateTransform();
      if(!fromTimer){
        refreshTimer();
      }
    };

    const handleKeydown = (event) => {
      const { key } = event;
      if(key === 'ArrowRight' || key === 'ArrowDown'){
        event.preventDefault();
        setIndex(currentIndex + 1);
      } else if(key === 'ArrowLeft' || key === 'ArrowUp'){
        event.preventDefault();
        setIndex(currentIndex - 1);
      } else if(key === 'Home'){
        event.preventDefault();
        setIndex(0);
      } else if(key === 'End'){
        event.preventDefault();
        setIndex(totalSlides - 1);
      }
    };

    const handleMouseEnter = () => { isHovering = true; refreshTimer(); };
    const handleMouseLeave = () => { isHovering = false; refreshTimer(); };
    const handleFocusIn = () => { hasFocus = true; refreshTimer(); };
    const handleFocusOut = (event) => {
      if(!carousel.contains(event.relatedTarget)){
        hasFocus = false;
        refreshTimer();
      }
    };
    const handleVisibilityChange = () => refreshTimer();
    const handleMotionChange = () => refreshTimer();
    const handleResize = () => {
      recalcMetrics();
      updateTransform();
    };

    const handlePrev = () => setIndex(currentIndex - 1);
    const handleNext = () => setIndex(currentIndex + 1);

    viewport.addEventListener('keydown', handleKeydown);
    carousel.addEventListener('mouseenter', handleMouseEnter);
    carousel.addEventListener('mouseleave', handleMouseLeave);
    carousel.addEventListener('focusin', handleFocusIn);
    carousel.addEventListener('focusout', handleFocusOut);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    if(typeof prefersReducedMotion.addEventListener === 'function'){
      prefersReducedMotion.addEventListener('change', handleMotionChange);
    } else if(typeof prefersReducedMotion.addListener === 'function'){
      prefersReducedMotion.addListener(handleMotionChange);
    }
    window.addEventListener('resize', handleResize);
    prevBtn?.addEventListener('click', handlePrev);
    nextBtn?.addEventListener('click', handleNext);

    recalcMetrics();
    updateTransform();
    refreshTimer();

    const cleanup = () => {
      stopTimer();
      viewport.removeEventListener('keydown', handleKeydown);
      carousel.removeEventListener('mouseenter', handleMouseEnter);
      carousel.removeEventListener('mouseleave', handleMouseLeave);
      carousel.removeEventListener('focusin', handleFocusIn);
      carousel.removeEventListener('focusout', handleFocusOut);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if(typeof prefersReducedMotion.removeEventListener === 'function'){
        prefersReducedMotion.removeEventListener('change', handleMotionChange);
      } else if(typeof prefersReducedMotion.removeListener === 'function'){
        prefersReducedMotion.removeListener(handleMotionChange);
      }
      window.removeEventListener('resize', handleResize);
      prevBtn?.removeEventListener('click', handlePrev);
      nextBtn?.removeEventListener('click', handleNext);
    };

    const observer = new MutationObserver(() => {
      if(!windowEl.isConnected){
        cleanup();
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const aboutSection = document.querySelector('#about .win95-window');
    if(aboutSection){
      initTabbedWindow(aboutSection, {
        optionSelector: '.about-option',
        panelSelector: '.about-panel'
      });
    }

    const publishersSection = document.querySelector('#publishers .win95-window');
    if(publishersSection){
      initPublishersCarousel(publishersSection);
    }

    const yearEl = document.getElementById('footerYear');
    if(yearEl){
      yearEl.textContent = String(new Date().getFullYear());
    }

    const clockEl = document.getElementById('footerClock');
    if(clockEl){
      const tick = () => {
        const d = new Date();
        clockEl.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      };
      tick();
      setInterval(tick, 1000);
    }

    if(typeof window.initSolitaireWindow === 'function'){
      const solitaireWindow = document.querySelector('#solitaire .win95-window');
      if(solitaireWindow){
        window.initSolitaireWindow(solitaireWindow);
      }
    }
  });
})();
