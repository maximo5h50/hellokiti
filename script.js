/* ============================================================
   🐱 KITTY CARE — script.js
   Mobile-first: touch events, swipe, vibración háptica,
   pausa automática al ocultar pestaña, y más.
   ============================================================ */

'use strict';

/* ════════════════════════════════════════════════════════════
   1. CONFIGURACIÓN
═══════════════════════════════════════════════════════════════ */
const CONFIG = {
  initialStat:   75,
  maxStat:       100,
  minStat:       0,

  decayAmount:   1,
  decayInterval: 6000,   // ms entre cada bajada automática

  busyCooldown:  1600,   // ms de "Kitty ocupada" después de una acción

  foodGain:  { cake: 20, candy: 15, milk: 25 },
  sleepGain: 30,
  loveGain:  20,

  moodHappy:   55,
  moodNeutral: 25,
  criticalThreshold: 15,

  alertDuration: 2800,   // ms que dura el globo de alerta

  // Distancia mínima (px) para reconocer un swipe horizontal
  swipeThreshold: 40,

  // Mostrar el hint de swipe la primera vez
  showSwipeHint: true,
};

/* Orden de habitaciones para el swipe */
const ROOM_ORDER = ['kitchen', 'sleep', 'love'];


/* ════════════════════════════════════════════════════════════
   2. ESTADO GLOBAL
═══════════════════════════════════════════════════════════════ */
const state = {
  food:  CONFIG.initialStat,
  sleep: CONFIG.initialStat,
  love:  CONFIG.initialStat,

  currentRoom: 'kitchen',
  mood: 'happy',
  isBusy: false,
  speechTimeout: null,
  decayTimer: null,          // referencia al setInterval de decaimiento
  swipeHintShown: false,     // ¿ya se mostró la pista de swipe?
};


/* ════════════════════════════════════════════════════════════
   3. REFERENCIAS AL DOM
═══════════════════════════════════════════════════════════════ */
const el = {
  foodBar:      document.getElementById('food-bar'),
  sleepBar:     document.getElementById('sleep-bar'),
  loveBar:      document.getElementById('love-bar'),
  foodLabel:    document.getElementById('food-label'),
  sleepLabel:   document.getElementById('sleep-label'),
  loveLabel:    document.getElementById('love-label'),

  kitty:        document.getElementById('kitty-character'),
  speechBubble: document.getElementById('speech-bubble'),
  speechText:   document.getElementById('speech-text'),
  swipeHint:    document.getElementById('swipe-hint'),

  gameArea:     document.getElementById('game-area'),
  roomsWrapper: document.getElementById('rooms-wrapper'),

  rooms:        document.querySelectorAll('.room'),
  navBtns:      document.querySelectorAll('.nav-btn'),

  foodItems:    document.querySelectorAll('.food-item'),
  sleepBed:     document.getElementById('sleep-bed'),
  loveHearts:   document.querySelectorAll('.love-heart'),
};


/* ════════════════════════════════════════════════════════════
   4. ACTUALIZAR BARRAS
═══════════════════════════════════════════════════════════════ */
function updateBars() {
  const { food, sleep, love } = state;

  el.foodBar.style.width  = food  + '%';
  el.sleepBar.style.width = sleep + '%';
  el.loveBar.style.width  = love  + '%';

  el.foodLabel.textContent  = Math.round(food)  + '%';
  el.sleepLabel.textContent = Math.round(sleep) + '%';
  el.loveLabel.textContent  = Math.round(love)  + '%';

  applyCriticalStyle(el.foodBar,  food);
  applyCriticalStyle(el.sleepBar, sleep);
  applyCriticalStyle(el.loveBar,  love);
}

function applyCriticalStyle(barEl, value) {
  barEl.classList.toggle('bar-critical', value <= CONFIG.criticalThreshold);
}


/* ════════════════════════════════════════════════════════════
   5. ESTADO DE ÁNIMO
═══════════════════════════════════════════════════════════════ */
function updateMood() {
  const lowest = Math.min(state.food, state.sleep, state.love);
  let newMood;

  if      (lowest >= CONFIG.moodHappy)   newMood = 'happy';
  else if (lowest >= CONFIG.moodNeutral) newMood = 'neutral';
  else                                    newMood = 'sad';

  if (newMood !== state.mood) {
    state.mood = newMood;
    if (!state.isBusy) { showFace(state.mood); applyMoodClass(); }
  }
}

function applyMoodClass() {
  el.kitty.classList.remove('mood-happy', 'mood-neutral', 'mood-sad');
  el.kitty.classList.add('mood-' + state.mood);
}

function showFace(name) {
  document.querySelectorAll('.kitty-face').forEach(f => f.classList.add('hidden'));
  const target = document.getElementById('face-' + name);
  if (target) target.classList.remove('hidden');
}


/* ════════════════════════════════════════════════════════════
   6. GLOBO DE DIÁLOGO
═══════════════════════════════════════════════════════════════ */
function showSpeech(text, duration = 0) {
  if (state.speechTimeout) {
    clearTimeout(state.speechTimeout);
    state.speechTimeout = null;
  }
  el.speechText.textContent = text;
  el.speechBubble.classList.remove('hidden');

  if (duration > 0) {
    state.speechTimeout = setTimeout(hideSpeech, duration);
  }
}

function hideSpeech() {
  el.speechBubble.classList.add('hidden');
  state.speechTimeout = null;
}


/* ════════════════════════════════════════════════════════════
   7. ACCIONES DEL JUGADOR
═══════════════════════════════════════════════════════════════ */
function feedKitty(foodType, btnEl) {
  if (state.isBusy) return;

  const gain = CONFIG.foodGain[foodType] ?? 15;
  state.food = clamp(state.food + gain, CONFIG.minStat, CONFIG.maxStat);

  const messages = {
    cake:  '¡Mmm, rico pastel! 🎂',
    candy: '¡Yum, un dulcecito! 🍬',
    milk:  '¡Leche fresquita! 🥛',
  };

  if (btnEl) animateButton(btnEl, 'pop');
  spawnParticles('✨', btnEl ?? el.kitty, 4);
  triggerAction('eat', messages[foodType] ?? '¡Delicioso!');
  vibrate(30);          // pulso corto de vibración
  updateBars();
}

function putToSleep() {
  if (state.isBusy) return;

  state.sleep = clamp(state.sleep + CONFIG.sleepGain, CONFIG.minStat, CONFIG.maxStat);

  el.sleepBed.classList.add('is-sleeping');
  setTimeout(() => el.sleepBed.classList.remove('is-sleeping'), CONFIG.busyCooldown);

  spawnParticles('💤', el.sleepBed, 3);
  triggerAction('sleep', 'Zzz... soñando con pescaditos... 💤');
  vibrate([20, 50, 20]);  // patrón de vibración suave
  updateBars();
}

function giveLove(heartEl) {
  if (state.isBusy) return;

  state.love = clamp(state.love + CONFIG.loveGain, CONFIG.minStat, CONFIG.maxStat);

  if (heartEl) animateButton(heartEl, 'heart-pop');
  spawnParticles('💕', heartEl ?? el.kitty, 4);
  triggerAction('love', '¡Te quiero muuuucho! 💖');
  vibrate([20, 30, 20, 30, 20]);  // patrón de corazón latiendo
  updateBars();
}


/* ════════════════════════════════════════════════════════════
   8. ANIMACIONES Y FEEDBACK VISUAL
═══════════════════════════════════════════════════════════════ */
function triggerAction(type, message) {
  state.isBusy = true;

  showFace(type);

  const animClass = 'anim-' + type;
  el.kitty.classList.add(animClass);

  showSpeech(message);

  setTimeout(() => {
    el.kitty.classList.remove(animClass);
    showFace(state.mood);
    applyMoodClass();
    hideSpeech();
    state.isBusy = false;
  }, CONFIG.busyCooldown);
}

function animateButton(btn, animClass, duration = 400) {
  btn.classList.remove(animClass);           // reset si ya estaba
  void btn.offsetWidth;                      // fuerza reflow para reiniciar animación
  btn.classList.add(animClass);
  setTimeout(() => btn.classList.remove(animClass), duration);
}

function spawnParticles(emoji, srcEl, count = 3) {
  if (!srcEl) return;

  const srcRect  = srcEl.getBoundingClientRect();
  const areaRect = el.gameArea.getBoundingClientRect();
  const cx = srcRect.left - areaRect.left + srcRect.width  / 2;
  const cy = srcRect.top  - areaRect.top  + srcRect.height / 2;

  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const p = document.createElement('span');
      p.classList.add('floating-particle');
      p.textContent = emoji;
      p.setAttribute('aria-hidden', 'true');
      p.style.left = (cx + (Math.random() - 0.5) * 70) + 'px';
      p.style.top  = (cy + (Math.random() - 0.5) * 40) + 'px';
      el.gameArea.appendChild(p);
      setTimeout(() => p.remove(), 1100);
    }, i * 110);
  }
}

/**
 * Vibración háptica cross-browser.
 * Ignora silenciosamente si el dispositivo no lo soporta.
 * @param {number|number[]} pattern — ms o array de ms (on/off)
 */
function vibrate(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (_) { /* silencioso */ }
}


/* ════════════════════════════════════════════════════════════
   9. CAMBIO DE HABITACIONES
═══════════════════════════════════════════════════════════════ */
function switchRoom(roomId) {
  if (roomId === state.currentRoom) return;
  state.currentRoom = roomId;

  el.rooms.forEach(r => { r.classList.add('hidden'); r.classList.remove('active'); });

  const target = document.getElementById('room-' + roomId);
  if (target) {
    target.classList.remove('hidden');
    requestAnimationFrame(() => target.classList.add('active'));
  }

  el.navBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.room === roomId));
  el.gameArea.dataset.room = roomId;
}

/** Avanza al siguiente o anterior cuarto según dirección. */
function switchRoomByDirection(dir) {
  const idx = ROOM_ORDER.indexOf(state.currentRoom);
  const next = ROOM_ORDER[(idx + dir + ROOM_ORDER.length) % ROOM_ORDER.length];
  switchRoom(next);
}


/* ════════════════════════════════════════════════════════════
   10. GESTOS DE SWIPE HORIZONTAL
   Se detectan sobre #rooms-wrapper para no interferir con
   el scroll vertical del contenido de las habitaciones.
═══════════════════════════════════════════════════════════════ */
function initSwipe() {
  let startX = 0;
  let startY = 0;
  let isSwiping = false;

  /**
   * touchstart — registrar punto de inicio.
   * { passive: true } → no bloquea el scroll del navegador.
   */
  el.roomsWrapper.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    startX    = t.clientX;
    startY    = t.clientY;
    isSwiping = false;
  }, { passive: true });

  /**
   * touchmove — determinar si el gesto es horizontal o vertical.
   * Solo llama preventDefault si es horizontal, para no bloquear
   * el scroll vertical dentro de cada habitación.
   */
  el.roomsWrapper.addEventListener('touchmove', (e) => {
    if (!e.touches.length) return;
    const t   = e.touches[0];
    const dx  = t.clientX - startX;
    const dy  = t.clientY - startY;

    // Si el movimiento vertical es mayor, es scroll: no intervenimos
    if (!isSwiping && Math.abs(dy) > Math.abs(dx)) return;

    if (Math.abs(dx) > 8) {
      isSwiping = true;
      // Evitar que la página haga scroll horizontal
      e.preventDefault();
    }
  }, { passive: false }); // passive: false para poder llamar preventDefault

  /**
   * touchend — si fue swipe horizontal, cambiar habitación.
   */
  el.roomsWrapper.addEventListener('touchend', (e) => {
    if (!isSwiping) return;

    const dx  = e.changedTouches[0].clientX - startX;
    const adx = Math.abs(dx);

    if (adx < CONFIG.swipeThreshold) return;

    // Izquierda → siguiente; derecha → anterior
    const dir = dx < 0 ? 1 : -1;
    switchRoomByDirection(dir);
    vibrate(15);

    // Mostrar hint de swipe solo la primera vez
    if (!state.swipeHintShown) {
      state.swipeHintShown = true;
    }
  }, { passive: true });
}


/* ════════════════════════════════════════════════════════════
   11. PISTA DE SWIPE (hint visual)
═══════════════════════════════════════════════════════════════ */
function showSwipeHint() {
  if (!CONFIG.showSwipeHint || state.swipeHintShown) return;

  el.swipeHint.classList.remove('hidden');
  state.swipeHintShown = true;

  // Se oculta solo después de 4 segundos (la animación CSS dura ~6s)
  setTimeout(() => el.swipeHint.classList.add('hidden'), 6000);
}


/* ════════════════════════════════════════════════════════════
   12. DECAIMIENTO AUTOMÁTICO
═══════════════════════════════════════════════════════════════ */
function startDecay() {
  state.decayTimer = setInterval(() => {
    state.food  = Math.max(CONFIG.minStat, state.food  - CONFIG.decayAmount);
    state.sleep = Math.max(CONFIG.minStat, state.sleep - CONFIG.decayAmount);
    state.love  = Math.max(CONFIG.minStat, state.love  - CONFIG.decayAmount);

    updateBars();
    updateMood();
    checkCritical();
  }, CONFIG.decayInterval);
}

function stopDecay() {
  if (state.decayTimer) {
    clearInterval(state.decayTimer);
    state.decayTimer = null;
  }
}

function checkCritical() {
  if (state.isBusy) return;

  const criticals = [
    { val: state.food,  msg: '¡Tengo mucha hambre! 🍎' },
    { val: state.sleep, msg: '¡Estoy agotada! 💤' },
    { val: state.love,  msg: '¡Necesito un abrazo! ❤️' },
  ].filter(s => s.val <= CONFIG.criticalThreshold)
   .sort((a, b) => a.val - b.val);

  if (criticals.length > 0) {
    showSpeech(criticals[0].msg, CONFIG.alertDuration);
    vibrate([80, 40, 80]);   // alerta háptica
  }
}


/* ════════════════════════════════════════════════════════════
   13. PAUSA CUANDO LA PESTAÑA / APP ESTÁ EN SEGUNDO PLANO
   Muy importante en mobile: si el usuario sale de la app,
   los timers siguen corriendo. Aquí los pausamos.
═══════════════════════════════════════════════════════════════ */
function initVisibilityHandling() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopDecay();
    } else {
      startDecay();
    }
  });
}


/* ════════════════════════════════════════════════════════════
   14. EVENTOS DE INTERACCIÓN
═══════════════════════════════════════════════════════════════ */
function initEventListeners() {

  /* ─── Navegación entre habitaciones ─────────────────────── */
  el.navBtns.forEach(btn => {
    // Usamos touchstart (en mobile) + click (en desktop) para respuesta instantánea.
    // touchstart dispara ~300ms antes que click en navegadores sin fast-tap.
    let touched = false;

    btn.addEventListener('touchstart', (e) => {
      touched = true;
      switchRoom(btn.dataset.room);
      vibrate(12);
    }, { passive: true });

    btn.addEventListener('click', () => {
      if (touched) { touched = false; return; } // evitar doble disparo
      switchRoom(btn.dataset.room);
    });
  });

  /* ─── Comida ─────────────────────────────────────────────── */
  el.foodItems.forEach(item => {
    let touched = false;

    item.addEventListener('touchstart', (e) => {
      touched = true;
      feedKitty(item.dataset.food, item);
    }, { passive: true });

    item.addEventListener('click', () => {
      if (touched) { touched = false; return; }
      feedKitty(item.dataset.food, item);
    });
  });

  /* ─── Cama ───────────────────────────────────────────────── */
  if (el.sleepBed) {
    let touched = false;

    el.sleepBed.addEventListener('touchstart', () => {
      touched = true;
      putToSleep();
    }, { passive: true });

    el.sleepBed.addEventListener('click', () => {
      if (touched) { touched = false; return; }
      putToSleep();
    });
  }

  /* ─── Corazones ──────────────────────────────────────────── */
  el.loveHearts.forEach(heart => {
    let touched = false;

    heart.addEventListener('touchstart', () => {
      touched = true;
      giveLove(heart);
    }, { passive: true });

    heart.addEventListener('click', () => {
      if (touched) { touched = false; return; }
      giveLove(heart);
    });
  });

  /* ─── Tocar a Kitty → sorpresa ───────────────────────────── */
  const kittyMessages = [
    '¡Eso hace cosquillas! 😆',
    '¡Hola! 👋',
    '¡Mírame! 🌟',
    '¡Soy tan linda! 🌸',
    '¡Juega conmigo! 🎀',
  ];
  let kittyTouched = false;

  const onKittyInteract = () => {
    if (state.isBusy) return;
    const msg = kittyMessages[Math.floor(Math.random() * kittyMessages.length)];
    showSpeech(msg, 1800);
    spawnParticles('⭐', el.kitty, 3);
    vibrate(25);
  };

  el.kitty.addEventListener('touchstart', () => {
    kittyTouched = true;
    onKittyInteract();
  }, { passive: true });

  el.kitty.addEventListener('click', () => {
    if (kittyTouched) { kittyTouched = false; return; }
    onKittyInteract();
  });

  /* Accesibilidad: Enter y Space sobre Kitty */
  el.kitty.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onKittyInteract();
    }
  });

  /* ─── Prevenir zoom por doble toque en toda la app ────────
     (El meta viewport ya lo hace, pero esto es doble seguro) */
  let lastTap = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTap < 300) {
      e.preventDefault();
    }
    lastTap = now;
  }, { passive: false });

  /* ─── Prevenir el menú contextual por pulsación larga ──── */
  document.addEventListener('contextmenu', (e) => e.preventDefault());
}


/* ════════════════════════════════════════════════════════════
   15. UTILIDADES
═══════════════════════════════════════════════════════════════ */
function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}


/* ════════════════════════════════════════════════════════════
   16. INICIALIZACIÓN
═══════════════════════════════════════════════════════════════ */
function init() {
  console.log('🐱 Kitty Care — iniciando (mobile-ready)');

  updateBars();
  showFace('happy');
  applyMoodClass();

  el.gameArea.dataset.room = 'kitchen';

  initEventListeners();   // Eventos de botones + teclado
  initSwipe();            // Swipe horizontal para cambiar habitación
  initVisibilityHandling(); // Pausa/reanuda cuando la app va a segundo plano
  startDecay();           // Arranca el timer de decaimiento

  // Hint de swipe: aparece 2 segundos después del inicio
  setTimeout(showSwipeHint, 2000);

  // Mensaje de bienvenida
  setTimeout(() => showSpeech('¡Hola! ¡Cuídame mucho! 🌸', 2800), 700);

  console.log('✅ Kitty Care listo. ¡Que la cuides bien!');
}

document.addEventListener('DOMContentLoaded', init);

