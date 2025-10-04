(function(){
  const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs'];
  const SUIT_SYMBOLS = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
  const SUIT_READABLE = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };
  const SUIT_COLORS = { spades: 'black', clubs: 'black', hearts: 'red', diamonds: 'red' };
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  const CARD_HEIGHT = 120;
  const FACE_DOWN_SPACING = 22;
  const FACE_UP_SPACING = 32;
  const WASTE_SPACING = 18;

  function createDeck(){
    const deck = [];
    for(let s = 0; s < SUIT_NAMES.length; s++){
      const suitName = SUIT_NAMES[s];
      for(let r = 0; r < RANKS.length; r++){
        deck.push({
          id: `${suitName}-${RANKS[r]}`,
          suit: suitName,
          rank: RANKS[r],
          value: r + 1,
          color: SUIT_COLORS[suitName],
          faceUp: false
        });
      }
    }
    return deck;
  }

  function shuffle(array){
    for(let i = array.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  function cloneCard(card){
    return { ...card };
  }

  function clonePile(pile){
    return pile.map(cloneCard);
  }

  function describeCard(card){
    if(!card) return '';
    return `${card.rank} of ${SUIT_READABLE[card.suit]}`;
  }

  function pluralize(count, singular, plural){
    if(plural === undefined) plural = `${singular}s`;
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function initSolitaireWindow(win){
    if(!win) return;
    const board = win.querySelector('.solitaire-board');
    if(!board) return;

    const statusEl = win.querySelector('.solitaire-status');
    const restartBtn = win.querySelector('.solitaire-btn.restart');
    const undoBtn = win.querySelector('.solitaire-btn.undo');
    const stockEl = board.querySelector('[data-pile="stock"]');
    const wasteEl = board.querySelector('[data-pile="waste"]');
    const foundationEls = Array.from(board.querySelectorAll('.pile-foundation'));
    const tableauEls = Array.from(board.querySelectorAll('.pile-tableau'));

    const state = {
      stock: [],
      waste: [],
      foundations: Array.from({ length: 4 }, () => []),
      tableau: Array.from({ length: 7 }, () => []),
      history: []
    };

    let focusToken = null;
    let pendingFocusToken = null;
    let dragState = null;
    let dropTarget = null;

    function updateStatus(message){
      if(statusEl) statusEl.textContent = message;
    }

    function updateUndo(){
      if(undoBtn) undoBtn.disabled = state.history.length === 0;
    }

    function saveState(){
      state.history.push({
        stock: clonePile(state.stock),
        waste: clonePile(state.waste),
        foundations: state.foundations.map(clonePile),
        tableau: state.tableau.map(clonePile),
        status: statusEl ? statusEl.textContent : ''
      });
      updateUndo();
    }

    function restoreSnapshot(snapshot){
      state.stock = clonePile(snapshot.stock);
      state.waste = clonePile(snapshot.waste);
      state.foundations = snapshot.foundations.map(clonePile);
      state.tableau = snapshot.tableau.map(clonePile);
    }

    function getCardLocation(cardId){
      for(let i = 0; i < state.tableau.length; i++){
        const idx = state.tableau[i].findIndex(card => card.id === cardId);
        if(idx !== -1){
          return { type: 'tableau', index: i, position: idx, card: state.tableau[i][idx], pile: state.tableau[i] };
        }
      }
      const wasteIndex = state.waste.findIndex(card => card.id === cardId);
      if(wasteIndex !== -1){
        return { type: 'waste', index: wasteIndex, position: wasteIndex, card: state.waste[wasteIndex], pile: state.waste };
      }
      for(let i = 0; i < state.foundations.length; i++){
        const idx = state.foundations[i].findIndex(card => card.id === cardId);
        if(idx !== -1){
          return { type: 'foundation', index: i, position: idx, card: state.foundations[i][idx], pile: state.foundations[i] };
        }
      }
      return null;
    }

    function flipTableauTop(index){
      const pile = state.tableau[index];
      if(!pile || !pile.length) return;
      const top = pile[pile.length - 1];
      if(top && !top.faceUp){
        top.faceUp = true;
      }
    }

    function removeFromOrigin(origin, count){
      if(!origin) return [];
      if(origin.type === 'tableau'){
        const pile = state.tableau[origin.index];
        const removed = pile.splice(origin.position, count);
        flipTableauTop(origin.index);
        return removed;
      }
      if(origin.type === 'waste'){
        return state.waste.splice(state.waste.length - count, count);
      }
      if(origin.type === 'foundation'){
        return state.foundations[origin.index].splice(origin.position, count);
      }
      return [];
    }

    function addToTarget(target, cards){
      if(!cards.length) return;
      if(target.type === 'tableau'){
        state.tableau[target.index].push(...cards);
      } else if(target.type === 'foundation'){
        state.foundations[target.index].push(...cards);
      }
    }

    function isValidTableauMove(cards, targetIndex){
      if(!cards.length) return false;
      const pile = state.tableau[targetIndex];
      const first = cards[0];
      if(!first.faceUp) return false;
      if(!pile.length){
        return first.value === 13; // King on empty pile
      }
      const top = pile[pile.length - 1];
      if(!top.faceUp) return false;
      return top.color !== first.color && top.value === first.value + 1;
    }

    function isValidFoundationMove(card, targetIndex){
      if(!card || !card.faceUp) return false;
      const pile = state.foundations[targetIndex];
      if(!pile.length) return card.value === 1; // Ace
      const top = pile[pile.length - 1];
      return top.suit === card.suit && top.value + 1 === card.value;
    }

    function describeTargetFromElement(element){
      if(!element) return null;
      const pileName = element.getAttribute('data-pile');
      if(!pileName) return null;
      if(pileName.startsWith('tableau-')){
        return { type: 'tableau', index: Number(pileName.split('-')[1]) };
      }
      if(pileName.startsWith('foundation-')){
        return { type: 'foundation', index: Number(pileName.split('-')[1]) };
      }
      return null;
    }

    function isSameDestination(a, b){
      if(!a || !b) return false;
      if(a.type !== b.type) return false;
      if('index' in a || 'index' in b){
        return a.index === b.index;
      }
      return true;
    }

    function isDropAllowed(descriptor, drag){
      if(!descriptor || !drag) return false;
      if(descriptor.type === 'tableau'){
        if(drag.origin.type === 'tableau' && drag.origin.index === descriptor.index) return false;
        return isValidTableauMove(drag.stack, descriptor.index);
      }
      if(descriptor.type === 'foundation'){
        if(drag.stack.length !== 1) return false;
        return isValidFoundationMove(drag.stack[0], descriptor.index);
      }
      return false;
    }

    function setDropTarget(element){
      if(dropTarget === element) return;
      if(dropTarget){
        dropTarget.classList.remove('drop-target');
      }
      dropTarget = element;
      if(dropTarget){
        dropTarget.classList.add('drop-target');
      }
    }

    function finalizeMove(origin, target, stack){
      if(!target || !stack.length) return false;
      if(target.type === 'tableau'){
        if(!isValidTableauMove(stack, target.index)) return false;
        saveState();
        const freshOrigin = getCardLocation(stack[0].id);
        if(!freshOrigin){
          state.history.pop();
          updateUndo();
          return false;
        }
        const moved = removeFromOrigin(freshOrigin, stack.length);
        addToTarget(target, moved);
        pendingFocusToken = { type: 'card', id: moved[0].id };
        updateStatus(`Moved ${describeCard(moved[0])} to tableau pile ${target.index + 1}.`);
        afterMutation();
        return true;
      }
      if(target.type === 'foundation'){
        if(stack.length !== 1) return false;
        const card = stack[0];
        if(!isValidFoundationMove(card, target.index)) return false;
        saveState();
        const freshOrigin = getCardLocation(card.id);
        if(!freshOrigin){
          state.history.pop();
          updateUndo();
          return false;
        }
        const moved = removeFromOrigin(freshOrigin, 1);
        addToTarget(target, moved);
        pendingFocusToken = { type: 'card', id: card.id };
        updateStatus(`Placed ${describeCard(card)} on foundation ${target.index + 1}.`);
        afterMutation();
        return true;
      }
      return false;
    }

    function attemptAutoFoundation(cardId){
      const loc = getCardLocation(cardId);
      if(!loc || !loc.card.faceUp) return false;
      if(loc.type === 'waste' && loc.position !== state.waste.length - 1) return false;
      if(loc.type === 'foundation' && loc.position !== state.foundations[loc.index].length - 1) return false;
      const card = loc.card;
      for(let i = 0; i < state.foundations.length; i++){
        if(isValidFoundationMove(card, i)){
          saveState();
          const fresh = getCardLocation(cardId);
          if(!fresh){
            state.history.pop();
            updateUndo();
            return false;
          }
          const moved = removeFromOrigin(fresh, 1);
          addToTarget({ type: 'foundation', index: i }, moved);
          pendingFocusToken = { type: 'card', id: card.id };
          updateStatus(`Sent ${describeCard(card)} to foundation ${i + 1}.`);
          afterMutation();
          return true;
        }
      }
      updateStatus(`No foundation available for ${describeCard(card)}.`);
      return false;
    }

    function attemptAutoTableau(cardId){
      const loc = getCardLocation(cardId);
      if(!loc || !loc.card.faceUp) return false;
      if(loc.type === 'waste' && loc.position !== state.waste.length - 1) return false;
      if(loc.type === 'foundation' && loc.position !== state.foundations[loc.index].length - 1) return false;
      const stack = loc.type === 'tableau' ? loc.pile.slice(loc.position) : [loc.card];
      for(let i = 0; i < state.tableau.length; i++){
        if(loc.type === 'tableau' && loc.index === i) continue;
        if(isValidTableauMove(stack, i)){
          saveState();
          const fresh = getCardLocation(cardId);
          if(!fresh){
            state.history.pop();
            updateUndo();
            return false;
          }
          const count = fresh.type === 'tableau' ? fresh.pile.length - fresh.position : 1;
          const moved = removeFromOrigin(fresh, count);
          addToTarget({ type: 'tableau', index: i }, moved);
          pendingFocusToken = { type: 'card', id: moved[0].id };
          updateStatus(`Moved ${describeCard(moved[0])} to tableau pile ${i + 1}.`);
          afterMutation();
          return true;
        }
      }
      updateStatus(`No tableau move available for ${describeCard(stack[0])}.`);
      return false;
    }

    function clearDrag(targetEl){
      if(!dragState) return;
      dragState.elements.forEach(el => {
        el.classList.remove('dragging');
        el.style.pointerEvents = '';
        el.style.transform = '';
      });
      if(targetEl){
        targetEl.releasePointerCapture?.(dragState.pointerId);
        targetEl.removeEventListener('pointermove', onCardPointerMove);
        targetEl.removeEventListener('pointerup', onCardPointerUp);
        targetEl.removeEventListener('pointercancel', onCardPointerCancel);
      }
      setDropTarget(null);
    }

    function onCardPointerDown(e){
      const cardEl = e.target.closest('.card');
      if(!cardEl) return;
      if(e.pointerType === 'mouse' && e.button !== 0) return;
      const cardId = cardEl.dataset.id;
      if(!cardId) return;
      const location = getCardLocation(cardId);
      if(!location || !location.card.faceUp) return;
      if(location.type === 'waste' && location.position !== state.waste.length - 1) return;
      if(location.type === 'foundation' && location.position !== state.foundations[location.index].length - 1) return;
      const stack = location.type === 'tableau' ? location.pile.slice(location.position) : [location.card];
      const elements = stack.map(card => board.querySelector(`.card[data-id="${card.id}"]`)).filter(Boolean);
      if(!elements.length) return;
      dragState = {
        origin: { type: location.type, index: location.index, position: location.position },
        stack,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        elements,
        source: cardEl
      };
      elements.forEach(el => {
        el.classList.add('dragging');
        el.style.pointerEvents = 'none';
      });
      cardEl.setPointerCapture?.(e.pointerId);
      cardEl.addEventListener('pointermove', onCardPointerMove);
      cardEl.addEventListener('pointerup', onCardPointerUp);
      cardEl.addEventListener('pointercancel', onCardPointerCancel);
      e.preventDefault();
    }

    function onCardPointerMove(e){
      if(!dragState || e.pointerId !== dragState.pointerId) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      dragState.elements.forEach((el, index) => {
        el.style.transform = `translate(${dx}px, ${dy}px)`;
      });
      const potential = document.elementFromPoint(e.clientX, e.clientY);
      const pileEl = potential ? potential.closest('.pile') : null;
      const descriptor = describeTargetFromElement(pileEl);
      if(descriptor && isDropAllowed(descriptor, dragState)){
        setDropTarget(pileEl);
      } else {
        setDropTarget(null);
      }
    }

    function onCardPointerUp(e){
      if(!dragState || e.pointerId !== dragState.pointerId) return;
      const potential = document.elementFromPoint(e.clientX, e.clientY);
      const pileEl = potential ? potential.closest('.pile') : null;
      const descriptor = describeTargetFromElement(pileEl);
      const origin = dragState.origin;
      const stack = dragState.stack;
      clearDrag(e.currentTarget);
      const moved = descriptor && finalizeMove(origin, descriptor, stack);
      if(!moved){
        dragState.elements.forEach(el => { el.style.transform = ''; });
        if(descriptor && !isSameDestination(descriptor, origin)){
          updateStatus('That move is not allowed.');
        }
      }
      dragState = null;
    }

    function onCardPointerCancel(e){
      if(!dragState || e.pointerId !== dragState.pointerId) return;
      clearDrag(e.currentTarget);
      dragState = null;
    }

    function drawFromStock(){
      if(state.stock.length){
        saveState();
        const card = state.stock.pop();
        card.faceUp = true;
        state.waste.push(card);
        pendingFocusToken = { type: 'card', id: card.id };
        updateStatus(`Drew ${describeCard(card)}.`);
        afterMutation();
        return true;
      }
      if(state.waste.length){
        saveState();
        while(state.waste.length){
          const card = state.waste.pop();
          card.faceUp = false;
          state.stock.push(card);
        }
        pendingFocusToken = { type: 'pile', id: 'stock' };
        updateStatus('Restacked the waste into the stock.');
        afterMutation();
        return true;
      }
      updateStatus('No cards available to draw.');
      return false;
    }

    function undoMove(){
      if(!state.history.length) return;
      const snapshot = state.history.pop();
      restoreSnapshot(snapshot);
      updateStatus(snapshot.status || 'Undid the last move.');
      pendingFocusToken = null;
      render();
      updateUndo();
      checkWin();
    }

    function checkWin(){
      const total = state.foundations.reduce((sum, pile) => sum + pile.length, 0);
      if(total === 52){
        updateStatus('You win! Press Restart to play again.');
      }
    }

    function render(){
      const focusPreference = pendingFocusToken || focusToken;
      pendingFocusToken = null;

      // Stock
      stockEl.innerHTML = '';
      stockEl.classList.toggle('has-cards', state.stock.length > 0);
      stockEl.classList.toggle('is-empty', state.stock.length === 0);
      if(state.stock.length){
        const backCard = createCardElement(state.stock[state.stock.length - 1], { faceDown: true });
        backCard.setAttribute('aria-hidden', 'true');
        backCard.tabIndex = -1;
        backCard.style.pointerEvents = 'none';
        stockEl.appendChild(backCard);
        stockEl.setAttribute('data-count', state.stock.length);
        stockEl.setAttribute('aria-label', `Stock pile with ${pluralize(state.stock.length, 'card')}. Activate to draw.`);
      } else {
        stockEl.removeAttribute('data-count');
        const recycleHint = state.waste.length ? 'Activate to recycle the waste pile.' : 'Stock pile is empty.';
        stockEl.setAttribute('aria-label', recycleHint);
      }

      // Waste
      wasteEl.innerHTML = '';
      wasteEl.classList.toggle('has-cards', state.waste.length > 0);
      const wasteVisible = state.waste.slice(-3);
      wasteVisible.forEach((card, idx) => {
        const position = state.waste.length - wasteVisible.length + idx;
        const cardEl = createCardElement(card);
        cardEl.dataset.pile = 'waste';
        cardEl.dataset.position = String(position);
        cardEl.style.left = `${idx * WASTE_SPACING}px`;
        cardEl.style.zIndex = String(10 + idx);
        const isTop = position === state.waste.length - 1;
        cardEl.classList.toggle('is-top', isTop);
        cardEl.tabIndex = isTop ? 0 : -1;
        if(!isTop) cardEl.setAttribute('aria-hidden', 'true');
        wasteEl.appendChild(cardEl);
      });
      if(state.waste.length){
        const top = state.waste[state.waste.length - 1];
        wasteEl.setAttribute('aria-label', `Waste pile. Top card ${describeCard(top)}.`);
      } else {
        wasteEl.setAttribute('aria-label', 'Waste pile is empty.');
      }

      // Foundations
      foundationEls.forEach((pileEl, index) => {
        pileEl.innerHTML = '';
        const pile = state.foundations[index];
        pileEl.classList.toggle('has-cards', pile.length > 0);
        if(pile.length){
          const top = pile[pile.length - 1];
          const cardEl = createCardElement(top);
          cardEl.dataset.pile = `foundation-${index}`;
          cardEl.dataset.position = String(pile.length - 1);
          cardEl.classList.add('is-top');
          cardEl.tabIndex = 0;
          pileEl.appendChild(cardEl);
          pileEl.setAttribute('aria-label', `Foundation pile ${index + 1}. Top card ${describeCard(top)}.`);
        } else {
          pileEl.setAttribute('aria-label', `Foundation pile ${index + 1} is empty.`);
        }
      });

      // Tableau
      tableauEls.forEach((pileEl, index) => {
        pileEl.innerHTML = '';
        const pile = state.tableau[index];
        pileEl.classList.toggle('has-cards', pile.length > 0);
        let offset = 0;
        pile.forEach((card, position) => {
          const cardEl = createCardElement(card);
          cardEl.dataset.pile = `tableau-${index}`;
          cardEl.dataset.position = String(position);
          cardEl.style.top = `${offset}px`;
          cardEl.style.zIndex = String(position + 1);
          cardEl.tabIndex = card.faceUp ? 0 : -1;
          pileEl.appendChild(cardEl);
          offset += card.faceUp ? FACE_UP_SPACING : FACE_DOWN_SPACING;
        });
        const height = Math.max(CARD_HEIGHT, offset + CARD_HEIGHT - FACE_UP_SPACING);
        pileEl.style.minHeight = `${height}px`;
        if(pile.length){
          const top = pile[pile.length - 1];
          const label = top.faceUp ? describeCard(top) : 'a face-down card';
          pileEl.setAttribute('aria-label', `Tableau pile ${index + 1} with ${pluralize(pile.length, 'card')}. Top card ${label}.`);
        } else {
          pileEl.setAttribute('aria-label', `Tableau pile ${index + 1} is empty. Place a King here.`);
        }
      });

      updateUndo();
      restoreFocus(focusPreference);
      checkWin();
    }

    function restoreFocus(token){
      if(!token) return;
      if(token.type === 'card'){
        const el = board.querySelector(`.card[data-id="${token.id}"]`);
        if(el){
          el.focus({ preventScroll: true });
          return;
        }
      }
      if(token.type === 'pile'){
        const el = board.querySelector(`.pile[data-pile="${token.id}"]`);
        if(el){
          el.focus({ preventScroll: true });
        }
      }
    }

    function afterMutation(){
      render();
    }

    function setupNewGame(){
      const deck = createDeck();
      shuffle(deck);
      state.tableau = Array.from({ length: 7 }, () => []);
      for(let pile = 0; pile < 7; pile++){
        for(let depth = 0; depth <= pile; depth++){
          const card = deck.shift();
          card.faceUp = depth === pile;
          state.tableau[pile].push(card);
        }
      }
      state.stock = deck;
      state.stock.forEach(card => { card.faceUp = false; });
      state.waste = [];
      state.foundations = Array.from({ length: 4 }, () => []);
      state.history = [];
      updateUndo();
      pendingFocusToken = { type: 'pile', id: 'stock' };
      updateStatus('New game ready. Good luck!');
      render();
    }

    board.addEventListener('pointerdown', onCardPointerDown);
    restartBtn?.addEventListener('click', () => {
      setupNewGame();
      if(stockEl && typeof stockEl.focus === 'function'){
        try {
          stockEl.focus({ preventScroll: true });
        } catch (err) {
          stockEl.focus();
        }
      }
    });
    undoBtn?.addEventListener('click', () => undoMove());

    stockEl.addEventListener('click', () => drawFromStock());
    stockEl.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar'){
        e.preventDefault();
        drawFromStock();
      }
    });

    wasteEl.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar'){
        e.preventDefault();
        const top = state.waste[state.waste.length - 1];
        if(!top) return;
        if(e.shiftKey){
          attemptAutoTableau(top.id);
        } else {
          if(!attemptAutoFoundation(top.id)){
            attemptAutoTableau(top.id);
          }
        }
      }
    });

    foundationEls.forEach((pileEl, index) => {
      pileEl.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar'){
          e.preventDefault();
          const pile = state.foundations[index];
          const top = pile[pile.length - 1];
          if(!top) return;
          attemptAutoTableau(top.id);
        }
      });
    });

    board.addEventListener('dblclick', (e) => {
      const cardEl = e.target.closest('.card');
      if(!cardEl) return;
      const cardId = cardEl.dataset.id;
      if(!cardId) return;
      if(!attemptAutoFoundation(cardId)){
        attemptAutoTableau(cardId);
      }
    });

    board.addEventListener('keydown', (e) => {
      const cardEl = e.target.closest('.card');
      if(!cardEl) return;
      const cardId = cardEl.dataset.id;
      if(!cardId) return;
      if(e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar'){
        e.preventDefault();
        if(e.shiftKey){
          attemptAutoTableau(cardId);
        } else {
          if(!attemptAutoFoundation(cardId)){
            attemptAutoTableau(cardId);
          }
        }
      } else if(e.key.toLowerCase() === 'f'){
        e.preventDefault();
        attemptAutoFoundation(cardId);
      } else if(e.key.toLowerCase() === 't'){
        e.preventDefault();
        attemptAutoTableau(cardId);
      }
    });

    board.addEventListener('focusin', (e) => {
      const cardEl = e.target.closest('.card');
      if(cardEl){
        focusToken = { type: 'card', id: cardEl.dataset.id };
        return;
      }
      const pileEl = e.target.closest('.pile');
      if(pileEl){
        focusToken = { type: 'pile', id: pileEl.getAttribute('data-pile') };
      }
    });

    win.addEventListener('keydown', (e) => {
      if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z'){
        e.preventDefault();
        undoMove();
      }
    });

    setupNewGame();

    function createCardElement(card, { faceDown } = {}){
      const isFaceDown = faceDown ?? !card.faceUp;
      const el = document.createElement('div');
      el.className = 'card';
      el.dataset.id = card.id;
      el.dataset.rank = card.rank;
      el.dataset.suit = card.suit;
      el.dataset.value = String(card.value);
      if(!isFaceDown){
        el.classList.add('face-up');
        if(card.color === 'red') el.classList.add('red');
      } else {
        el.classList.add('face-down', 'back');
      }
      const rankSpan = document.createElement('span');
      rankSpan.className = 'rank';
      rankSpan.textContent = card.rank;
      const suitSpan = document.createElement('span');
      suitSpan.className = 'suit';
      suitSpan.textContent = SUIT_SYMBOLS[card.suit];
      el.append(rankSpan, suitSpan);
      el.setAttribute('role', 'button');
      if(isFaceDown){
        el.setAttribute('aria-label', 'Face-down card');
      } else {
        el.setAttribute('aria-label', describeCard(card));
      }
      return el;
    }
  }

  window.initSolitaireWindow = initSolitaireWindow;
})();
