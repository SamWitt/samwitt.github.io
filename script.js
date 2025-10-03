// --- Desktop icon drag + open on dblclick ---
const desktop = document.getElementById('desktop');
const tasks = document.getElementById('tasks');

const GRID_SIZE = 20;

const snapToGrid = (value) => Math.round(value / GRID_SIZE) * GRID_SIZE;
const alignToGridStart = (value) => Math.floor(value / GRID_SIZE) * GRID_SIZE;

function autoLayoutIcons(){
  const icons = Array.from(document.querySelectorAll('.icon'));
  if(!icons.length) return;

  const order = new Map();
  icons.forEach((icon, index)=> order.set(icon, index));

  const minLeft = icons.reduce((min, icon)=> Math.min(min, icon.offsetLeft), Infinity);
  const minTop = icons.reduce((min, icon)=> Math.min(min, icon.offsetTop), Infinity);

  const baseLeft = alignToGridStart(Number.isFinite(minLeft) ? minLeft : 0);
  const baseTop = alignToGridStart(Number.isFinite(minTop) ? minTop : 0);

  const sample = icons[0];
  const iconWidth = sample.offsetWidth;
  const iconHeight = sample.offsetHeight;

  const stepX = Math.max(GRID_SIZE, snapToGrid(iconWidth + GRID_SIZE));
  const stepY = Math.max(GRID_SIZE, snapToGrid(iconHeight + GRID_SIZE));

  const viewportHeight = window.innerHeight;
  const maxBottom = viewportHeight - GRID_SIZE;

  let currentLeft = baseLeft;
  let currentTop = baseTop;

  icons
    .sort((a,b)=>{
      const diffTop = a.offsetTop - b.offsetTop;
      if(Math.abs(diffTop) > 0.5) return diffTop;
      const diffLeft = a.offsetLeft - b.offsetLeft;
      if(Math.abs(diffLeft) > 0.5) return diffLeft;
      return order.get(a) - order.get(b);
    })
    .forEach(icon=>{
      if(currentTop + iconHeight > maxBottom){
        currentLeft += stepX;
        currentTop = baseTop;
      }
      icon.style.left = snapToGrid(currentLeft)+'px';
      icon.style.top = snapToGrid(currentTop)+'px';
      currentTop += stepY;
    });
}

function snapIconToGrid(icon){
  if(!icon) return;
  icon.style.left = snapToGrid(icon.offsetLeft)+'px';
  icon.style.top = snapToGrid(icon.offsetTop)+'px';
}

// Window factory
let z = 10;
function bringToFront(win){ win.style.zIndex = ++z; }
function makeWindow({title, tpl, x=140, y=90, w=420}){
  const node = document.getElementById('tpl-window').content.firstElementChild.cloneNode(true);
  node.style.left = x+'px'; node.style.top = y+'px'; node.style.width = w+'px';
  node.querySelector('.title span').textContent = title;
  node.querySelector('.content').append(document.getElementById(tpl).content.cloneNode(true));
  desktop.appendChild(node); bringToFront(node);

  // titlebar drag (Pointer Events)
  const bar = node.querySelector('.titlebar');
  let pointerId=null, offX=0, offY=0;

  function onMove(e){
    if(e.pointerId!==pointerId) return;
    node.style.left = Math.max(0, e.clientX-offX)+'px';
    node.style.top  = Math.max(0, e.clientY-offY)+'px';
  }
  function cleanup(){
    if(pointerId===null) return;
    const id = pointerId;
    pointerId=null;
    if (bar.hasPointerCapture?.(id)) bar.releasePointerCapture(id);
    bar.removeEventListener('pointermove', onMove);
    bar.removeEventListener('pointerup', onUp);
    bar.removeEventListener('pointercancel', onCancel);
    bar.style.touchAction='';
  }
  function onUp(e){ if(e.pointerId===pointerId) cleanup(); }
  function onCancel(e){ if(e.pointerId===pointerId) cleanup(); }

  bar.addEventListener('pointerdown', e=>{
    if(e.target.closest('.controls')) return;                // don't drag from control buttons
    if(e.pointerType==='mouse' && e.button!==0) return;      // left mouse only
    if(pointerId!==null) return;                              // already dragging
    pointerId=e.pointerId;
    bringToFront(node);
    offX=e.clientX-node.offsetLeft;
    offY=e.clientY-node.offsetTop;
    bar.style.touchAction='none';
    bar.addEventListener('pointermove', onMove);
    bar.addEventListener('pointerup', onUp);
    bar.addEventListener('pointercancel', onCancel);
    bar.setPointerCapture?.(pointerId);
    e.preventDefault();
  });
  bar.addEventListener('lostpointercapture', cleanup);

  // controls
  node.querySelector('.btn-close').addEventListener('click', ()=> { node.remove(); tb.remove(); });
  node.querySelector('.btn-min').addEventListener('click', ()=> node.style.display='none');
  node.querySelector('.btn-max').addEventListener('click', ()=>{
    if(node.dataset.max==='1'){
      node.style.left=node.dataset.l; node.style.top=node.dataset.t; node.style.width=node.dataset.w; node.style.height=node.dataset.h; node.dataset.max='0';
    } else {
      node.dataset.l=node.style.left; node.dataset.t=node.style.top; node.dataset.w=node.style.width; node.dataset.h=node.style.height; node.dataset.max='1';
      node.style.left='8px'; node.style.top='8px';
      node.style.width=(window.innerWidth-16)+'px';
      node.style.height=(window.innerHeight-48)+'px';
    }
    bringToFront(node);
  });

  // taskbar button
  const tb = document.createElement('button');
  tb.className='btn task-btn';
  tb.textContent=title;
  tasks.appendChild(tb);
  tb.addEventListener('click', ()=>{
    if(node.style.display==='none'){ node.style.display='block'; bringToFront(node); }
    else { node.style.display='none'; }
  });

  node.addEventListener('pointerdown', ()=> bringToFront(node));
  return node;
}

/* ------- Generic tabbed window helper (kept) ------- */
function initTabbedWindow(windowEl, { optionSelector, panelSelector } = {}){
  if(!windowEl || !optionSelector || !panelSelector) return;
  const options = Array.from(windowEl.querySelectorAll(optionSelector));
  if(!options.length) return;

  const panels = new Map();
  windowEl.querySelectorAll(panelSelector).forEach(panel => {
    const key = panel.dataset.option;
    if(!key) return;
    panels.set(key, panel);
    panel.hidden = !panel.classList.contains('is-active'); // only active visible
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

/* ------- Specific initializers using the helper ------- */
function initAboutWindow(windowEl){
  initTabbedWindow(windowEl, {
    optionSelector: '.about-option',
    panelSelector: '.about-panel'
  });
}
function initPublishersWindow(windowEl){
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

  const observer = new MutationObserver(() => {
    if(!windowEl.isConnected){
      cleanup();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  function cleanup(){
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
    observer.disconnect();
  }
}

// Canonical initializer; keep legacy tab UI available if markup still uses it
function initProjectsWindow(windowEl){
  if (!windowEl) return;
  initTabbedWindow(windowEl, {
    optionSelector: '.project-option',
    panelSelector:  '.project-panel'
  });
}

// Optional alias: keep compatibility if some code calls the other name
const initPlacementsWindow = initProjectsWindow;

/* ------- Openers ------- */
const openers = {
  about: () => {
    const win = makeWindow({ title: 'About', tpl: 'tpl-about', x: 200, y: 100 });
    if (typeof initAboutWindow === 'function') initAboutWindow(win);
    return win;
  },

  music: () => makeWindow({ title: 'Music', tpl: 'tpl-music', x: 260, y: 120, w: 520 }),

  // Projects window (can be labeled "Placements" in the UI if you prefer)
  projects: () => {
    const win = makeWindow({ title: 'Projects', tpl: 'tpl-projects', x: 240, y: 140, w: 520 });
    if (typeof initProjectsWindow === 'function') initProjectsWindow(win); // robust either way
    return win;
  },

  contact: () => makeWindow({ title: 'Contact', tpl: 'tpl-contact', x: 220, y: 160, w: 360 }),
  collaborators: () => makeWindow({ title: 'Collaborators', tpl: 'tpl-collaborators', x: 200, y: 180, w: 420 }),

  publishers: () => {
    const win = makeWindow({ title: 'Publishers', tpl: 'tpl-publishers', x: 220, y: 200, w: 440 });
    if (typeof initPublishersWindow === 'function') initPublishersWindow(win);
    return win;
  }
};



// Sticky Notes
function createNote({x=260,y=100,w=220,h=160,text='New note…'}={}){
  const note = document.createElement('div');
  note.className='sticky-note';
  note.style.left=x+'px'; note.style.top=y+'px'; note.style.width=w+'px'; note.style.height=h+'px';
  note.innerHTML = '<div class="close" title="Delete">✕</div><div class="body" contenteditable="true">'+text+'</div>';
  desktop.appendChild(note);
  // drag (not when typing)
  let drag=false, ox=0, oy=0;
  note.addEventListener('mousedown', e=>{ if(e.target.closest('.body')||e.target.closest('.close')) return; drag=true; ox=e.clientX-note.offsetLeft; oy=e.clientY-note.offsetTop; e.preventDefault();
    const mv=(e)=>{ if(!drag) return; note.style.left=e.clientX-ox+'px'; note.style.top=e.clientY-oy+'px'; };
    const up=()=>{ drag=false; window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  });
  note.querySelector('.close').addEventListener('click', ()=> note.remove());
  return note;
}

// Icon drag + dblclick handlers
document.querySelectorAll('.icon').forEach(icon => {
  let dragging=false, moved=false, offsetX=0, offsetY=0;
  let pointerId=null, longPressTimer=null;

  const startDrag = () => {
    if(dragging || pointerId===null) return;
    dragging=true;
    moved=false;
    icon.style.zIndex=1000;
    icon.style.touchAction='none';
    cancelTimer();
    icon.setPointerCapture?.(pointerId);
  };
  const cancelTimer = () => {
    if(longPressTimer){
      clearTimeout(longPressTimer);
      longPressTimer=null;
    }
  };
  const endDrag = () => {
    cancelTimer();
    if(pointerId!==null && icon.hasPointerCapture?.(pointerId)){
      icon.releasePointerCapture(pointerId);
    }
    dragging=false;
    pointerId=null;
    icon.style.touchAction='';
    icon.style.zIndex='';
    if(moved){
      snapIconToGrid(icon);
    }
  };
  const mv = (e)=>{
    if(!dragging || e.pointerId!==pointerId) return;
    e.preventDefault();
    icon.style.left=e.clientX-offsetX+'px';
    icon.style.top=e.clientY-offsetY+'px';
    moved=true;
  };

  icon.addEventListener('pointerdown', e=>{
    if(e.pointerType==='mouse' && e.button!==0) return;
    if(pointerId!==null) return;
    pointerId=e.pointerId;
    offsetX=e.clientX-icon.offsetLeft;
    offsetY=e.clientY-icon.offsetTop;
    moved=false;
    if(typeof icon.focus==='function'){
      try {
        icon.focus({preventScroll:true});
      } catch (err) {
        icon.focus();
      }
    }
    cancelTimer();

    const begin = ()=>{
      if(pointerId!==e.pointerId) return;
      startDrag();
    };

    if(e.pointerType==='mouse'){
      begin();
    } else {
      longPressTimer=setTimeout(begin, 300);
    }
  });
  icon.addEventListener('pointermove', mv);
  icon.addEventListener('pointerup', e=>{ if(e.pointerId===pointerId) endDrag(); });
  icon.addEventListener('pointercancel', e=>{ if(e.pointerId===pointerId) endDrag(); });

  icon.addEventListener('lostpointercapture', ()=>{
    dragging=false;
    pointerId=null;
    cancelTimer();
    icon.style.zIndex='';
    icon.style.touchAction='';
  });
  icon.addEventListener('dblclick', e=>{
    if(moved) return;
    if(icon.classList.contains('sticky')){ createNote(); return; }
    const name = [...icon.classList].find(c=> openers[c]);
    if(name) openers[name]();
  });
  icon.addEventListener('keydown', e=>{
    if(e.key==='Enter'){
      if(icon.classList.contains('sticky')){ createNote(); return; }
      const name = [...icon.classList].find(c=> openers[c]);
      if(name) openers[name]();
    }
  });
});

document.addEventListener('DOMContentLoaded', autoLayoutIcons);
if(document.readyState!=='loading'){
  autoLayoutIcons();
}
window.addEventListener('resize', autoLayoutIcons);

// Tiny clock
function tick(){ const d=new Date(); document.getElementById('clock').textContent=d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
tick(); setInterval(tick, 1000);

// Marquee selection
(function(){
  const marquee = document.getElementById('marquee');
  let startX=0, startY=0, dragging=false, pointerId=null, longPressTimer=null, shiftPressed=false;

  function rectFromPoints(x1,y1,x2,y2){
    const left=Math.min(x1,x2), top=Math.min(y1,y2), width=Math.abs(x2-x1), height=Math.abs(y2-y1);
    return {left, top, width, height, right:left+width, bottom:top+height};
  }
  function intersects(r,a){ return !(a.left>r.right || a.right<r.left || a.top>r.bottom || a.bottom<r.top); }

  const cancelTimer = () => {
    if(longPressTimer){
      clearTimeout(longPressTimer);
      longPressTimer=null;
    }
  };
  const beginSelection = () => {
    if(dragging || pointerId===null) return;
    dragging=true;
    cancelTimer();
    desktop.setPointerCapture?.(pointerId);
    if(!shiftPressed){
      document.querySelectorAll('.icon.selected').forEach(i=>i.classList.remove('selected'));
    }
    marquee.style.left=startX+'px'; marquee.style.top=startY+'px';
    marquee.style.width='0px'; marquee.style.height='0px'; marquee.style.display='block';
  };
  const endSelection = (e) => {
    if(e.pointerId!==pointerId) return;
    cancelTimer();
    if(dragging){
      dragging=false;
      marquee.style.display='none';
      if(desktop.hasPointerCapture?.(pointerId)) desktop.releasePointerCapture(pointerId);
    }
    pointerId=null;
  };

  desktop.addEventListener('pointerdown', (e)=>{
    if(e.pointerType==='mouse' && e.button!==0) return;
    if(pointerId!==null) return;
    if(e.target.closest('.icon, .window, .sticky-note, .taskbar, #startMenu')) return;
    pointerId=e.pointerId;
    startX=e.clientX; startY=e.clientY;
    shiftPressed=e.shiftKey;
    const active = document.activeElement;
    if(active && active.classList && active.classList.contains('icon')){
      active.blur();
    }
    cancelTimer();
    const begin = ()=>{ if(pointerId===e.pointerId) beginSelection(); };
    if(e.pointerType==='mouse'){
      begin();
    } else {
      longPressTimer=setTimeout(begin, 300);
    }
  });
  desktop.addEventListener('pointermove', (e)=>{
    if(!dragging || e.pointerId!==pointerId) return;
    e.preventDefault();
    const r = rectFromPoints(startX,startY,e.clientX,e.clientY);
    marquee.style.left=r.left+'px'; marquee.style.top=r.top+'px';
    marquee.style.width=r.width+'px'; marquee.style.height=r.height+'px';
    document.querySelectorAll('.icon').forEach(icon=>{
      const b = icon.getBoundingClientRect();
      const ir = {left:b.left, top:b.top, right:b.right, bottom:b.bottom};
      if(intersects(r, ir)) icon.classList.add('selected');
      else if(!shiftPressed) icon.classList.remove('selected');
    });
  });
  desktop.addEventListener('pointerup', endSelection);
  desktop.addEventListener('pointercancel', endSelection);
})();

// Start button + menu
const startBtn = document.getElementById('startBtn');
const startMenu = document.getElementById('startMenu');
function toggleStart(force){
  const show = force!==undefined ? force : startMenu.style.display!=='block';
  startMenu.style.display = show ? 'block' : 'none';
}
startBtn.addEventListener('click', ()=> toggleStart());
document.addEventListener('click', (e)=>{
  if(e.target.closest('#startBtn') || e.target.closest('#startMenu')) return;
  toggleStart(false);
});
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') toggleStart(false); });

startMenu.addEventListener('click', (e)=>{
  const item = e.target.closest('.item'); if(!item) return;
  const op = item.getAttribute('data-open');
  if(op && openers[op]){ openers[op](); toggleStart(false); return; }
  if(item.getAttribute('data-sticky')==='new'){ createNote(); toggleStart(false); return; }
  if(item.getAttribute('data-cmd')==='closeAll'){
    document.querySelectorAll('.window').forEach(w=>w.remove());
    document.querySelectorAll('.task-btn').forEach(b=>b.remove());
    toggleStart(false);
  }
});
