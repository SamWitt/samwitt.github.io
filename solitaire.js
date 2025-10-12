(function(){
  const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
  const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
  const SUIT_LABELS = { hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs', spades: 'Spades' };
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const RANK_LABELS = {
    A: 'Ace', '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five', '6': 'Six', '7': 'Seven',
    '8': 'Eight', '9': 'Nine', '10': 'Ten', J: 'Jack', Q: 'Queen', K: 'King'
  };

  const COLOR_MAP = { hearts: 'red', diamonds: 'red', clubs: 'black', spades: 'black' };
  const FOUNDATION_COUNT = 4;
  const TABLEAU_COUNT = 7;

  function shuffle(array){
    for(let i=array.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function createDeck(){
    let id = 0;
    const deck = [];
    for(const suit of SUITS){
      for(let i=0;i<RANKS.length;i++){
        const rank = RANKS[i];
        deck.push({
          id: `card-${id++}`,
          suit,
          rank,
          value: i + 1,
          color: COLOR_MAP[suit],
          faceUp: false,
          element: null,
          location: null,
          ariaLabel: `${RANK_LABELS[rank]} of ${SUIT_LABELS[suit]}`
        });
      }
    }
    return deck;
  }

  function initSolitaireWindow(win){
    if(!win || win.dataset.solitaireInit === '1') return;
    win.dataset.solitaireInit = '1';

    const board = win.querySelector('[data-role="solitaire"]');
    if(!board) return;
    board.classList.remove('is-complete');

    const piles = {
      stock: board.querySelector('[data-pile-type="stock"]'),
      waste: board.querySelector('[data-pile-type="waste"]'),
      foundations: Array.from(board.querySelectorAll('[data-pile-type="foundation"]')),
      tableau: Array.from(board.querySelectorAll('[data-pile-type="tableau"]'))
    };

    const state = {
      stock: [],
      waste: [],
      foundations: Array.from({length: FOUNDATION_COUNT}, () => []),
      tableau: Array.from({length: TABLEAU_COUNT}, () => [])
    };

    const metrics = {
      cardWidth: 88,
      cardHeight: 124,
      tableauFaceUpOffset: 32,
      tableauFaceDownOffset: 18
    };

    let dragState = null;
    const pointerEventsSupported = typeof window !== 'undefined' && 'PointerEvent' in window;
    let lastTouchTime = 0;

    function normalizePointerLikeEvent(event, expectedPointerId){
      if(!event) return null;
      if('pointerId' in event && event.pointerId !== undefined){
        if(expectedPointerId !== undefined && event.pointerId !== expectedPointerId) return null;
        let pointerType = event.pointerType;
        if(!pointerType){
          pointerType = event instanceof MouseEvent ? 'mouse' : 'pen';
        }
        return {
          pointerId: event.pointerId,
          pointerType,
          clientX: event.clientX,
          clientY: event.clientY,
          button: event.button ?? 0,
          buttons: event.buttons ?? 0,
          originalEvent: event
        };
      }

      const type = event.type || '';

      if(type.startsWith('mouse')){
        if(expectedPointerId !== undefined && expectedPointerId !== 'mouse') return null;
        return {
          pointerId: 'mouse',
          pointerType: 'mouse',
          clientX: event.clientX,
          clientY: event.clientY,
          button: event.button ?? 0,
          buttons: event.buttons ?? 0,
          originalEvent: event
        };
      }

      if(type.startsWith('touch')){
        const touches = event.changedTouches && event.changedTouches.length
          ? Array.from(event.changedTouches)
          : [];
        let touch = null;
        if(expectedPointerId !== undefined){
          touch = touches.find(t => t.identifier === expectedPointerId);
          if(!touch && event.touches){
            touch = Array.from(event.touches).find(t => t.identifier === expectedPointerId) || null;
          }
        } else {
          touch = touches[0] || null;
        }
        if(!touch) return null;
        return {
          pointerId: touch.identifier,
          pointerType: 'touch',
          clientX: touch.clientX,
          clientY: touch.clientY,
          button: 0,
          buttons: 1,
          originalEvent: event,
          touch
        };
      }

      return null;
    }

    function setCardFace(card, faceUp){
      card.faceUp = !!faceUp;
      if(card.element){
        card.element.classList.toggle('is-face-up', card.faceUp);
        card.element.classList.toggle('is-face-down', !card.faceUp);
        card.element.dataset.face = card.faceUp ? 'up' : 'down';
        card.element.dataset.color = card.color;
        card.element.dataset.suit = card.suit;
        const label = card.element.querySelector('.card-label');
        if(label){
          label.textContent = card.faceUp ? `${card.rank}${SUIT_SYMBOLS[card.suit]}` : '';
        }
        card.element.setAttribute('aria-label', card.faceUp ? card.ariaLabel : 'Face-down card');
      }
    }

    function getPileArray(type, index){
      switch(type){
        case 'stock': return state.stock;
        case 'waste': return state.waste;
        case 'foundation': return state.foundations[index] || [];
        case 'tableau': return state.tableau[index] || [];
        default: return [];
      }
    }

    function getPileElement(type, index){
      switch(type){
        case 'stock': return piles.stock;
        case 'waste': return piles.waste;
        case 'foundation': return piles.foundations[index] || null;
        case 'tableau': return piles.tableau[index] || null;
        default: return null;
      }
    }

    function updateCardStyles(type, index, arr){
      const pileEl = getPileElement(type, index);
      if(!pileEl) return;
      const wasteOffset = Math.min(36, Math.round(metrics.cardWidth * 0.3));

      arr.forEach((card, idx) => {
        const el = card.element;
        if(!el) return;
        el.style.width = `${metrics.cardWidth}px`;
        el.style.height = `${metrics.cardHeight}px`;
        el.dataset.pileType = type;
        el.dataset.pileIndex = index;
        el.dataset.cardIndex = idx;
        el.classList.remove('is-hidden');
        let top = 0;
        let left = 0;
        let z = idx + 1;

        if(type === 'tableau'){
          for(let i = 0; i < idx; i++){
            const prev = arr[i];
            top += prev.faceUp ? metrics.tableauFaceUpOffset : metrics.tableauFaceDownOffset;
          }
        } else if(type === 'waste'){
          const visibleStart = Math.max(0, arr.length - 3);
          if(idx < visibleStart){
            el.classList.add('is-hidden');
          } else {
            const visibleIndex = idx - visibleStart;
            left = visibleIndex * wasteOffset;
            z = visibleIndex + 1;
          }
        } else if(type === 'stock' || type === 'foundation'){
          if(idx !== arr.length - 1){
            el.classList.add('is-hidden');
          } else {
            z = arr.length;
          }
        }

        el.style.top = `${top}px`;
        el.style.left = `${left}px`;
        el.style.zIndex = z;
      });

      const height = arr.length ? (
        type === 'tableau'
          ? metrics.cardHeight + arr.slice(1).reduce((sum, card) => sum + (card.faceUp ? metrics.tableauFaceUpOffset : metrics.tableauFaceDownOffset), 0)
          : metrics.cardHeight
      ) : metrics.cardHeight;
      pileEl.style.setProperty('--computed-height', `${height}px`);
      pileEl.classList.toggle('is-empty', arr.length === 0);
    }

    function renderPile(type, index){
      const arr = getPileArray(type, index);
      const pileEl = getPileElement(type, index);
      if(!pileEl) return;
      pileEl.innerHTML = '';
      arr.forEach(card => {
        if(card.element){
          pileEl.appendChild(card.element);
          setCardFace(card, card.faceUp);
        }
      });
      updateCardStyles(type, index, arr);
    }

    function renderAll(){
      renderPile('stock', 0);
      renderPile('waste', 0);
      for(let i=0;i<FOUNDATION_COUNT;i++){
        renderPile('foundation', i);
      }
      for(let i=0;i<TABLEAU_COUNT;i++){
        renderPile('tableau', i);
      }
    }

    function applyMetrics(){
      board.style.setProperty('--card-width', `${metrics.cardWidth}px`);
      board.style.setProperty('--card-height', `${metrics.cardHeight}px`);
      board.style.setProperty('--tableau-faceup-offset', `${metrics.tableauFaceUpOffset}px`);
      board.style.setProperty('--tableau-facedown-offset', `${metrics.tableauFaceDownOffset}px`);
      renderAll();
    }

    function computeMetrics(){
      if(!document.body.contains(board)){
        window.removeEventListener('resize', computeMetrics);
        return;
      }
      const content = win.querySelector('.content');
      const width = content ? content.clientWidth : board.clientWidth;
      const boardStyles = window.getComputedStyle(board);
      const paddingLeft = parseFloat(boardStyles.paddingLeft) || 0;
      const paddingRight = parseFloat(boardStyles.paddingRight) || 0;
      const tableau = board.querySelector('.solitaire-tableau');
      const tableauStyles = tableau ? window.getComputedStyle(tableau) : null;
      const gapCandidate = tableauStyles?.columnGap || tableauStyles?.gap || boardStyles.getPropertyValue('--solitaire-gap');
      let defaultGap = parseFloat(gapCandidate);
      if(!Number.isFinite(defaultGap)){
        defaultGap = 16;
      }
      const minGap = 6;
      const availableWidth = Math.max(width - paddingLeft - paddingRight, 0);

      if(availableWidth <= 0){
        metrics.cardWidth = 0;
        metrics.cardHeight = 0;
        metrics.tableauFaceUpOffset = 0;
        metrics.tableauFaceDownOffset = 0;
        board.style.setProperty('--solitaire-gap', '0px');
        applyMetrics();
        return;
      }

      const ratio = metrics.cardWidth > 0 ? defaultGap / metrics.cardWidth : defaultGap / 88;
      let cardWidth = Math.floor(availableWidth / (TABLEAU_COUNT + (TABLEAU_COUNT - 1) * ratio));
      if(!Number.isFinite(cardWidth) || cardWidth < 1){
        cardWidth = Math.floor((availableWidth - minGap * (TABLEAU_COUNT - 1)) / TABLEAU_COUNT);
      }
      if(!Number.isFinite(cardWidth) || cardWidth < 1){
        cardWidth = Math.max(0, Math.floor(availableWidth / TABLEAU_COUNT));
      }
      cardWidth = Math.min(120, Math.max(0, cardWidth));

      let gap;
      if(TABLEAU_COUNT > 1){
        const leftover = Math.max(availableWidth - cardWidth * TABLEAU_COUNT, 0);
        const allowedGap = leftover / (TABLEAU_COUNT - 1);
        if(allowedGap >= minGap){
          gap = Math.max(minGap, Math.min(defaultGap, allowedGap));
        } else {
          gap = Math.max(0, allowedGap);
        }
      } else {
        gap = 0;
      }

      const cardsSpace = Math.max(availableWidth - gap * (TABLEAU_COUNT - 1), 0);
      const adjustedCardWidth = Math.max(0, Math.min(cardWidth, Math.floor(cardsSpace / TABLEAU_COUNT)));
      metrics.cardWidth = adjustedCardWidth;
      metrics.cardHeight = Math.round(adjustedCardWidth * 1.4);
      metrics.tableauFaceUpOffset = Math.round(metrics.cardHeight * 0.32);
      metrics.tableauFaceDownOffset = Math.round(metrics.cardHeight * 0.18);
      board.style.setProperty('--solitaire-gap', `${gap}px`);
      applyMetrics();
    }

    function canDrop(movingCards, sourceType, sourceIndex, destType, destIndex){
      if(!movingCards.length) return false;
      if(destType === 'stock' || destType === 'waste') return false;

      const first = movingCards[0];
      if(destType === 'foundation'){
        if(movingCards.length !== 1) return false;
        const dest = state.foundations[destIndex];
        if(!dest.length){
          return first.value === 1;
        }
        const top = dest[dest.length - 1];
        return top.suit === first.suit && first.value === top.value + 1;
      }

      if(destType === 'tableau'){
        const dest = state.tableau[destIndex];
        if(!dest.length){
          return first.value === 13;
        }
        const top = dest[dest.length - 1];
        if(!top.faceUp) return false;
        return top.color !== first.color && top.value === first.value + 1;
      }

      return false;
    }

    function moveStack(sourceType, sourceIndex, startIdx, destType, destIndex){
      const source = getPileArray(sourceType, sourceIndex);
      const moving = source.splice(startIdx);
      moving.forEach(card => {
        card.location = { type: destType, index: destIndex };
      });
      const dest = getPileArray(destType, destIndex);
      dest.push(...moving);

      if(sourceType === 'tableau' && source.length){
        const tail = source[source.length - 1];
        if(tail && !tail.faceUp){
          setCardFace(tail, true);
        }
      }

      renderPile(sourceType, sourceIndex);
      if(sourceType === 'stock' || sourceType === 'waste'){
        renderPile('stock', 0);
        renderPile('waste', 0);
      }
      renderPile(destType, destIndex);
      if(destType === 'foundation'){
        checkWinCondition();
      }
    }

    function tryAutoFoundation(card){
      if(!card.faceUp || !card.location) return false;
      const sourceArr = getPileArray(card.location.type, card.location.index);
      if(sourceArr[sourceArr.length - 1] !== card) return false;
      const startIdx = sourceArr.indexOf(card);
      for(let i=0;i<FOUNDATION_COUNT;i++){
        if(canDrop([card], card.location.type, card.location.index, 'foundation', i)){
          moveStack(card.location.type, card.location.index, startIdx, 'foundation', i);
          return true;
        }
      }
      return false;
    }

    function createGhost(cards){
      const ghost = document.createElement('div');
      ghost.className = 'solitaire-drag-ghost';
      ghost.style.width = `${metrics.cardWidth}px`;
      ghost.style.height = `${metrics.cardHeight}px`;
      let offset = 0;
      cards.forEach((card, idx) => {
        const clone = card.element.cloneNode(true);
        clone.classList.add('ghost-card');
        clone.style.top = `${offset}px`;
        clone.style.left = '0px';
        clone.style.width = `${metrics.cardWidth}px`;
        clone.style.height = `${metrics.cardHeight}px`;
        ghost.appendChild(clone);
        if(card.location?.type === 'tableau' && idx !== cards.length - 1){
          offset += metrics.tableauFaceUpOffset;
        }
      });
      document.body.appendChild(ghost);
      return ghost;
    }

    function updateGhostPosition(state, x, y){
      if(!state || !state.ghost) return;
      state.ghost.style.left = `${x - state.offsetX}px`;
      state.ghost.style.top = `${y - state.offsetY}px`;
    }

    function resolveDropTarget(x, y){
      const elements = document.elementsFromPoint(x, y);
      for(const el of elements){
        if(!el) continue;
        if(el === document.body) continue;
        const pileEl = el.closest('[data-pile-type]');
        if(pileEl && board.contains(pileEl)){
          const type = pileEl.getAttribute('data-pile-type');
          const index = Number(pileEl.getAttribute('data-index') || pileEl.getAttribute('data-pile-index') || 0);
          return { type, index };
        }
      }
      return null;
    }

    function stopDrag(){
      if(!dragState || dragState.stopping) return;
      dragState.stopping = true;
      const { sourceCardEl, captureActive, capturePointerId, listeners } = dragState;
      if(captureActive && sourceCardEl && capturePointerId !== undefined && sourceCardEl.hasPointerCapture?.(capturePointerId)){
        sourceCardEl.releasePointerCapture(capturePointerId);
      }
      if(listeners){
        listeners.forEach(({ target, type, handler, options }) => {
          target.removeEventListener(type, handler, options);
        });
      }
      dragState.ghost?.remove();
      dragState = null;
    }

    function handleDragMove(normalized){
      if(!dragState) return;
      updateGhostPosition(dragState, normalized.clientX, normalized.clientY);
    }

    function handleDragUp(normalized){
      if(!dragState) return;
      const drop = resolveDropTarget(normalized.clientX, normalized.clientY);
      const { sourceType, sourceIndex, startIdx, moving } = dragState;
      if(drop && canDrop(moving, sourceType, sourceIndex, drop.type, drop.index)){
        moveStack(sourceType, sourceIndex, startIdx, drop.type, drop.index);
      }
      stopDrag();
    }

    function handleDragCancel(){
      if(!dragState) return;
      stopDrag();
    }

    function onPointerMove(e){
      if(!dragState) return;
      const normalized = normalizePointerLikeEvent(e, dragState.pointerId);
      if(!normalized) return;
      handleDragMove(normalized);
    }

    function onPointerUp(e){
      if(!dragState) return;
      const normalized = normalizePointerLikeEvent(e, dragState.pointerId);
      if(!normalized) return;
      handleDragUp(normalized);
    }

    function onPointerCancel(e){
      if(!dragState) return;
      const normalized = normalizePointerLikeEvent(e, dragState.pointerId);
      if(!normalized) return;
      handleDragCancel();
    }

    function onMouseMove(e){
      if(!dragState || dragState.pointerType !== 'mouse') return;
      const normalized = normalizePointerLikeEvent(e, dragState.pointerId);
      if(!normalized) return;
      handleDragMove(normalized);
    }

    function onMouseUp(e){
      if(!dragState || dragState.pointerType !== 'mouse') return;
      const normalized = normalizePointerLikeEvent(e, dragState.pointerId);
      if(!normalized) return;
      handleDragUp(normalized);
    }

    function onTouchMove(e){
      if(!dragState || dragState.pointerType !== 'touch') return;
      const normalized = normalizePointerLikeEvent(e, dragState.pointerId);
      if(!normalized) return;
      normalized.originalEvent?.preventDefault?.();
      handleDragMove(normalized);
    }

    function onTouchEnd(e){
      if(!dragState || dragState.pointerType !== 'touch') return;
      const normalized = normalizePointerLikeEvent(e, dragState.pointerId);
      if(!normalized) return;
      handleDragUp(normalized);
    }

    function onTouchCancel(e){
      if(!dragState || dragState.pointerType !== 'touch') return;
      const normalized = normalizePointerLikeEvent(e, dragState.pointerId);
      if(!normalized) return;
      handleDragCancel();
    }

    function onWindowBlur(){
      if(dragState){
        stopDrag();
      }
    }

    function beginCardDrag(card, normalized, originalEvent, startType){
      if(!card || !card.faceUp) return;
      if(normalized.pointerType === 'mouse' && normalized.button !== 0) return;
      const sourceType = card.location?.type;
      const sourceIndex = card.location?.index ?? 0;
      const sourceArr = getPileArray(sourceType, sourceIndex);
      const cardIdx = sourceArr.indexOf(card);
      if(cardIdx < 0) return;
      if(sourceType !== 'tableau' && cardIdx !== sourceArr.length - 1) return;

      const moving = sourceType === 'tableau' ? sourceArr.slice(cardIdx) : [card];
      if(!moving.every(c => c.faceUp)) return;

      const rect = card.element.getBoundingClientRect();
      const listeners = [];
      const registerListener = (target, type, handler, options) => {
        target.addEventListener(type, handler, options);
        listeners.push({ target, type, handler, options });
      };

      const isPointerEvent = startType === 'pointer' && originalEvent && 'pointerId' in originalEvent;
      const supportsPointerCapture = isPointerEvent && typeof card.element.setPointerCapture === 'function';
      let captureActive = false;
      if(supportsPointerCapture){
        try {
          card.element.setPointerCapture(originalEvent.pointerId);
          captureActive = card.element.hasPointerCapture?.(originalEvent.pointerId);
          if(captureActive === undefined){
            captureActive = true;
          }
        } catch(err){
          captureActive = false;
        }
      }

      const listenersTarget = captureActive ? card.element : window;

      dragState = {
        pointerId: normalized.pointerId,
        pointerType: normalized.pointerType,
        sourceType,
        sourceIndex,
        startIdx: cardIdx,
        moving,
        offsetX: normalized.clientX - rect.left,
        offsetY: normalized.clientY - rect.top,
        ghost: createGhost(moving),
        sourceCardEl: card.element,
        captureActive,
        capturePointerId: isPointerEvent ? originalEvent.pointerId : undefined,
        listeners,
        stopping: false
      };
      updateGhostPosition(dragState, normalized.clientX, normalized.clientY);

      if(isPointerEvent){
        registerListener(listenersTarget, 'pointermove', onPointerMove);
        registerListener(listenersTarget, 'pointerup', onPointerUp);
        registerListener(listenersTarget, 'pointercancel', onPointerCancel);
      } else if(normalized.pointerType === 'mouse'){
        registerListener(window, 'mousemove', onMouseMove);
        registerListener(window, 'mouseup', onMouseUp);
      } else if(normalized.pointerType === 'touch'){
        const options = { passive: false };
        registerListener(window, 'touchmove', onTouchMove, options);
        registerListener(window, 'touchend', onTouchEnd, options);
        registerListener(window, 'touchcancel', onTouchCancel, options);
      }

      registerListener(window, 'blur', onWindowBlur);

      originalEvent.preventDefault?.();
    }

    function onCardPointerDown(e){
      const card = e.currentTarget?.__cardRef;
      const normalized = normalizePointerLikeEvent(e);
      if(!card || !normalized) return;
      beginCardDrag(card, normalized, e, 'pointer');
    }

    function onCardMouseDown(e){
      if(pointerEventsSupported) return;
      if(Date.now() - lastTouchTime < 500){
        e.preventDefault();
        return;
      }
      const card = e.currentTarget?.__cardRef;
      const normalized = normalizePointerLikeEvent(e);
      if(!card || !normalized) return;
      beginCardDrag(card, normalized, e, 'mouse');
    }

    function onCardTouchStart(e){
      if(pointerEventsSupported) return;
      lastTouchTime = Date.now();
      const card = e.currentTarget?.__cardRef;
      const normalized = normalizePointerLikeEvent(e);
      if(!card || !normalized) return;
      beginCardDrag(card, normalized, e, 'touch');
    }

    function attachCardElement(card){
      const el = document.createElement('div');
      el.className = 'solitaire-card is-face-down';
      el.dataset.cardId = card.id;
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', 'Face-down card');
      el.tabIndex = 0;
      const label = document.createElement('span');
      label.className = 'card-label';
      el.appendChild(label);
      el.__cardRef = card;
      el.addEventListener('pointerdown', onCardPointerDown);
      if(!pointerEventsSupported){
        el.addEventListener('mousedown', onCardMouseDown);
        el.addEventListener('touchstart', onCardTouchStart, { passive: false });
      }
      el.addEventListener('dblclick', (evt) => {
        evt.preventDefault();
        tryAutoFoundation(card);
      });
      el.addEventListener('keydown', (evt) => {
        if(evt.key === 'Enter' || evt.key === ' '){
          evt.preventDefault();
          tryAutoFoundation(card);
        }
      });
      card.element = el;
      setCardFace(card, card.faceUp);
    }

    function checkWinCondition(){
      const total = state.foundations.reduce((sum, pile) => sum + pile.length, 0);
      if(total === 52){
        board.classList.add('is-complete');
        const titleNode = win.querySelector('.title span');
        if(titleNode && !titleNode.textContent.includes('You Won')){
          titleNode.textContent += ' — You Won!';
        }
      }
    }

    function onStockClick(){
      if(state.stock.length){
        const card = state.stock.pop();
        setCardFace(card, true);
        card.location = { type: 'waste', index: 0 };
        state.waste.push(card);
        renderPile('stock', 0);
        renderPile('waste', 0);
        return;
      }
      if(state.waste.length){
        const redealt = [];
        while(state.waste.length){
          const card = state.waste.pop();
          setCardFace(card, false);
          card.location = { type: 'stock', index: 0 };
          redealt.push(card);
        }
        state.stock = redealt;
        renderPile('stock', 0);
        renderPile('waste', 0);
      }
    }

    function onWasteDoubleClick(e){
      const card = state.waste[state.waste.length - 1];
      if(card){
        tryAutoFoundation(card);
      }
    }

    // Create deck + deal
    const deck = shuffle(createDeck());
    deck.forEach(card => attachCardElement(card));
    state.stock = deck;
    state.stock.forEach(card => {
      card.location = { type: 'stock', index: 0 };
      setCardFace(card, false);
    });

    for(let col = 0; col < TABLEAU_COUNT; col++){
      for(let row = 0; row <= col; row++){
        const card = state.stock.pop();
        if(!card) continue;
        const faceUp = row === col;
        setCardFace(card, faceUp);
        card.location = { type: 'tableau', index: col };
        state.tableau[col].push(card);
      }
    }

    renderAll();

    piles.stock?.addEventListener('click', onStockClick);
    piles.waste?.addEventListener('dblclick', onWasteDoubleClick);

    computeMetrics();
    window.addEventListener('resize', computeMetrics);
  }

  window.initSolitaireWindow = initSolitaireWindow;
})();
