/* ============================================================
   🐱 KITTY CARE — script.js
   Lógica completa del juego. Comentado para fácil edición.
   ============================================================ */

'use strict';

/* ════════════════════════════════════════════════════════════
   1. CONFIGURACIÓN DEL JUEGO
   Edita estos valores para ajustar la dificultad y la jugabilidad.
═══════════════════════════════════════════════════════════════ */
const CONFIG = {
  // Valores de estadísticas
  initialStat:  75,   // Valor inicial de cada barra (0-100)
  maxStat:      100,
  minStat:      0,

  // Cuánto baja cada barra por tick (en puntos)
  decayAmount:  1,

  // Cada cuántos milisegundos baja la barra (6000 = 6 segundos)
  decayInterval: 6000,

  // Cooldown entre acciones en ms (evita spam de clicks)
  busyCooldown: 1600,

  // Cuánto sube cada necesidad según la acción
  foodGain: {
    cake:  20,   // Pastel   +20
    candy: 15,   // Dulce    +15
    milk:  25,   // Leche    +25
  },
  sleepGain: 30,   // Cama     +30
  loveGain:  20,   // Corazón  +20

  // Umbrales de estado de ánimo (en puntos, sobre la barra MÁS BAJA)
  moodHappy:   55,   // >= 55 → feliz
  moodNeutral: 25,   // >= 25 → neutral
  // < 25 → triste

  // Umbral para alerta crítica
  criticalThreshold: 15,

  // Duración de mensajes de alerta en ms
  alertDuration: 2800,
};


/* ════════════════════════════════════════════════════════════
   2. ESTADO GLOBAL DEL JUEGO
   Todo el estado del juego vive aquí.
═══════════════════════════════════════════════════════════════ */
const state = {
  food:  CONFIG.initialStat,   // Barra de comida   (0-100)
  sleep: CONFIG.initialStat,   // Barra de sueño    (0-100)
  love:  CONFIG.initialStat,   // Barra de amor     (0-100)

  currentRoom: 'kitchen',      // Habitación visible
  mood: 'happy',               // Estado de ánimo: 'happy' | 'neutral' | 'sad'
  isBusy: false,               // true cuando Kitty está en animación
  speechTimeout: null,         // Referencia al timeout del globo de diálogo
};


/* ════════════════════════════════════════════════════════════
   3. REFERENCIAS AL DOM
   Guardamos todos los elementos en un objeto para acceso rápido.
═══════════════════════════════════════════════════════════════ */
const el = {
  // Barras de estadísticas
  foodBar:    document.getElementById('food-bar'),
  sleepBar:   document.getElementById('sleep-bar'),
  loveBar:    document.getElementById('love-bar'),
  foodLabel:  document.getElementById('food-label'),
  sleepLabel: document.getElementById('sleep-label'),
  loveLabel:  document.getElementById('love-label'),

  // Kitty y su globo
  kitty:        document.getElementById('kitty-character'),
  speechBubble: document.getElementById('speech-bubble'),
  speechText:   document.getElementById('speech-text'),

  // Contenedor principal (para partículas y fondo)
  gameArea:     document.getElementById('game-area'),

  // Habitaciones y navegación
  rooms:        document.querySelectorAll('.room'),
  navBtns:      document.querySelectorAll('.nav-btn'),

  // Elementos interactivos
  foodItems:    document.querySelectorAll('.food-item'),
  sleepBed:     document.getElementById('sleep-bed'),
  loveHearts:   document.querySelectorAll('.love-heart'),
};


/* ════════════════════════════════════════════════════════════
   4. ACTUALIZAR LA INTERFAZ
═══════════════════════════════════════════════════════════════ */

/**
 * Actualiza las tres barras de estadísticas y sus etiquetas.
 * Llamar después de cada cambio en state.food / state.sleep / state.love
 */
function updateBars() {
  const { food, sleep, love } = state;

  // Actualizar anchos (la transición CSS hace el efecto suave)
  el.foodBar.style.width  = food  + '%';
  el.sleepBar.style.width = sleep + '%';
  el.loveBar.style.width  = love  + '%';

  // Actualizar textos
  el.foodLabel.textContent  = Math.round(food)  + '%';
  el.sleepLabel.textContent = Math.round(sleep) + '%';
  el.loveLabel.textContent  = Math.round(love)  + '%';

  // Color de alerta crítica
  applyCriticalStyle(el.foodBar,  food);
  applyCriticalStyle(el.sleepBar, sleep);
  applyCriticalStyle(el.loveBar,  love);
}

/**
 * Aplica o quita el efecto de "barra crítica" (parpadeo).
 * @param {HTMLElement} barEl
 * @param {number} value
 */
function applyCriticalStyle(barEl, value) {
  if (value <= CONFIG.criticalThreshold) {
    barEl.classList.add('bar-critical');
  } else {
    barEl.classList.remove('bar-critical');
  }
}


/* ════════════════════════════════════════════════════════════
   5. SISTEMA DE ESTADO DE ÁNIMO
═══════════════════════════════════════════════════════════════ */

/**
 * Evalúa las 3 barras y actualiza el estado de ánimo.
 * El ánimo depende de la necesidad MÁS BAJA.
 */
function updateMood() {
  const lowestStat = Math.min(state.food, state.sleep, state.love);

  let newMood;
  if      (lowestStat >= CONFIG.moodHappy)   newMood = 'happy';
  else if (lowestStat >= CONFIG.moodNeutral) newMood = 'neutral';
  else                                        newMood = 'sad';

  // Solo cambiar si hay un cambio real (evita renders innecesarios)
  if (newMood !== state.mood) {
    state.mood = newMood;
    // Solo cambiar la cara si Kitty no está ocupada en otra animación
    if (!state.isBusy) {
      showFace(state.mood);
      applyMoodClass();
    }
  }
}

/**
 * Aplica la clase CSS de estado de ánimo a Kitty.
 */
function applyMoodClass() {
  el.kitty.classList.remove('mood-happy', 'mood-neutral', 'mood-sad');
  el.kitty.classList.add('mood-' + state.mood);
}

/**
 * Muestra la expresión facial indicada en el SVG.
 * @param {string} faceName — 'happy' | 'neutral' | 'sad' | 'eat' | 'sleep' | 'love'
 */
function showFace(faceName) {
  // Ocultar todas las expresiones
  document.querySelectorAll('.kitty-face').forEach(face => {
    face.classList.add('hidden');
  });

  // Mostrar la expresión solicitada
  const target = document.getElementById('face-' + faceName);
  if (target) target.classList.remove('hidden');
}


/* ════════════════════════════════════════════════════════════
   6. GLOBO DE DIÁLOGO
═══════════════════════════════════════════════════════════════ */

/**
 * Muestra el globo con un mensaje durante un tiempo.
 * @param {string} text     — Mensaje a mostrar
 * @param {number} duration — Milisegundos (0 = no auto-ocultar)
 */
function showSpeech(text, duration = 0) {
  // Cancelar timeout anterior si existe
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

/** Oculta el globo de diálogo. */
function hideSpeech() {
  el.speechBubble.classList.add('hidden');
  state.speechTimeout = null;
}


/* ════════════════════════════════════════════════════════════
   7. ACCIONES DEL JUGADOR
═══════════════════════════════════════════════════════════════ */

/**
 * Da de comer a Kitty.
 * @param {string} foodType — 'cake' | 'candy' | 'milk'
 * @param {HTMLElement} [btnEl] — Botón pulsado (para animación)
 */
function feedKitty(foodType, btnEl) {
  if (state.isBusy) return;

  // Sumar puntos de comida (sin pasar del máximo)
  const gain = CONFIG.foodGain[foodType] ?? 15;
  state.food = clamp(state.food + gain, CONFIG.minStat, CONFIG.maxStat);

  // Mensajes según la comida
  const messages = {
    cake:  '¡Mmm, rico pastel! 🎂',
    candy: '¡Yum, un dulcecito! 🍬',
    milk:  '¡Leche fresquita! 🥛',
  };

  // Animación en el botón de comida
  if (btnEl) animateButton(btnEl, 'pop');

  // Partículas de estrellitas
  spawnParticles('✨', btnEl ?? el.kitty, 4);

  // Animación de Kitty + globo
  triggerAction('eat', messages[foodType] ?? '¡Delicioso!');

  // Actualizar barras
  updateBars();
}

/**
 * Pone a dormir a Kitty.
 */
function putToSleep() {
  if (state.isBusy) return;

  state.sleep = clamp(state.sleep + CONFIG.sleepGain, CONFIG.minStat, CONFIG.maxStat);

  // Visual de la cama
  el.sleepBed.classList.add('is-sleeping');
  setTimeout(() => el.sleepBed.classList.remove('is-sleeping'), CONFIG.busyCooldown);

  spawnParticles('💤', el.sleepBed, 3);
  triggerAction('sleep', 'Zzz... soñando con pescaditos... 💤');
  updateBars();
}

/**
 * Da cariño a Kitty.
 * @param {HTMLElement} [heartEl] — Corazón pulsado (para animación)
 */
function giveLove(heartEl) {
  if (state.isBusy) return;

  state.love = clamp(state.love + CONFIG.loveGain, CONFIG.minStat, CONFIG.maxStat);

  // Animación en el corazón
  if (heartEl) animateButton(heartEl, 'heart-pop');

  spawnParticles('💕', heartEl ?? el.kitty, 4);
  triggerAction('love', '¡Te quiero muuuucho! 💖');
  updateBars();
}


/* ════════════════════════════════════════════════════════════
   8. ANIMACIONES Y FEEDBACK
═══════════════════════════════════════════════════════════════ */

/**
 * Dispara la animación de acción en Kitty y el globo de diálogo.
 * Bloquea nuevas acciones durante el cooldown.
 * @param {string} type    — 'eat' | 'sleep' | 'love'
 * @param {string} message — Mensaje para el globo
 */
function triggerAction(type, message) {
  state.isBusy = true;

  // Mostrar expresión específica de la acción
  showFace(type);

  // Agregar clase de animación a Kitty
  const animClass = 'anim-' + type;
  el.kitty.classList.add(animClass);

  // Mostrar globo de diálogo (sin auto-hide, lo haremos al restaurar)
  showSpeech(message);

  // Restaurar estado normal después del cooldown
  setTimeout(() => {
    el.kitty.classList.remove(animClass);
    showFace(state.mood);      // Volver a cara de estado de ánimo
    applyMoodClass();
    hideSpeech();
    state.isBusy = false;
  }, CONFIG.busyCooldown);
}

/**
 * Agrega y remueve una clase de animación CSS en un botón.
 * @param {HTMLElement} btn       — Elemento a animar
 * @param {string} animClass      — Clase CSS de animación
 * @param {number} [duration=400] — Duración en ms
 */
function animateButton(btn, animClass, duration = 400) {
  btn.classList.add(animClass);
  setTimeout(() => btn.classList.remove(animClass), duration);
}

/**
 * Crea partículas emoji flotantes en el área de juego.
 * @param {string} emoji      — Emoji a mostrar
 * @param {HTMLElement} srcEl — Elemento de origen para posición
 * @param {number} count      — Cuántas partículas crear
 */
function spawnParticles(emoji, srcEl, count = 3) {
  if (!srcEl) return;

  const srcRect  = srcEl.getBoundingClientRect();
  const areaRect = el.gameArea.getBoundingClientRect();

  // Centro del elemento fuente (relativo al game-area)
  const cx = srcRect.left - areaRect.left + srcRect.width  / 2;
  const cy = srcRect.top  - areaRect.top  + srcRect.height / 2;

  for (let i = 0; i < count; i++) {
    // Pequeño delay escalonado para efecto de ráfaga
    setTimeout(() => {
      const particle = document.createElement('span');
      particle.classList.add('floating-particle');
      particle.textContent = emoji;
      particle.setAttribute('aria-hidden', 'true');

      // Posición aleatoria alrededor del origen
      const offsetX = (Math.random() - 0.5) * 70;
      const offsetY = (Math.random() - 0.5) * 40;

      particle.style.left = (cx + offsetX) + 'px';
      particle.style.top  = (cy + offsetY) + 'px';

      el.gameArea.appendChild(particle);

      // Auto-eliminar después de la animación
      setTimeout(() => particle.remove(), 1100);
    }, i * 110);
  }
}


/* ════════════════════════════════════════════════════════════
   9. CAMBIO DE HABITACIONES
═══════════════════════════════════════════════════════════════ */

/**
 * Muestra la habitación indicada y actualiza la navegación.
 * @param {string} roomId — 'kitchen' | 'sleep' | 'love'
 */
function switchRoom(roomId) {
  if (roomId === state.currentRoom) return; // Sin cambio innecesario
  state.currentRoom = roomId;

  // Ocultar todas las habitaciones
  el.rooms.forEach(room => {
    room.classList.add('hidden');
    room.classList.remove('active');
  });

  // Mostrar la habitación destino
  const targetRoom = document.getElementById('room-' + roomId);
  if (targetRoom) {
    targetRoom.classList.remove('hidden');
    // Un frame de delay para que la transición CSS funcione
    requestAnimationFrame(() => targetRoom.classList.add('active'));
  }

  // Actualizar botones de navegación
  el.navBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.room === roomId);
  });

  // Cambiar fondo del game-area (CSS usa data-room)
  el.gameArea.dataset.room = roomId;
}


/* ════════════════════════════════════════════════════════════
   10. SISTEMA DE DECAIMIENTO
   Las barras bajan automáticamente con el tiempo.
═══════════════════════════════════════════════════════════════ */

/** Inicia el timer de decaimiento de barras. */
function startDecay() {
  setInterval(() => {
    const { decayAmount, minStat } = CONFIG;

    // Bajar cada barra (sin pasar del mínimo)
    state.food  = Math.max(minStat, state.food  - decayAmount);
    state.sleep = Math.max(minStat, state.sleep - decayAmount);
    state.love  = Math.max(minStat, state.love  - decayAmount);

    // Actualizar UI y estado de ánimo
    updateBars();
    updateMood();

    // Verificar necesidades críticas
    checkCritical();

  }, CONFIG.decayInterval);
}

/**
 * Si alguna barra está en nivel crítico, Kitty "pide ayuda".
 */
function checkCritical() {
  if (state.isBusy) return; // No interrumpir animaciones de acción

  const { food, sleep, love } = state;
  const threshold = CONFIG.criticalThreshold;

  // Ordenar por urgencia (la más baja primero)
  const criticals = [
    { val: food,  msg: '¡Tengo mucha hambre! 🍎',  room: 'kitchen' },
    { val: sleep, msg: '¡Estoy agotada! 💤',        room: 'sleep'   },
    { val: love,  msg: '¡Necesito un abrazo! ❤️',  room: 'love'    },
  ].filter(s => s.val <= threshold)
   .sort((a, b) => a.val - b.val); // La más baja primero

  if (criticals.length > 0) {
    showSpeech(criticals[0].msg, CONFIG.alertDuration);
  }
}


/* ════════════════════════════════════════════════════════════
   11. UTILIDADES
═══════════════════════════════════════════════════════════════ */

/**
 * Limita un valor entre un mínimo y un máximo.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}


/* ════════════════════════════════════════════════════════════
   12. REGISTRAR EVENTOS
═══════════════════════════════════════════════════════════════ */

function initEventListeners() {

  /* ── Navegación entre habitaciones ─────────────────────── */
  el.navBtns.forEach(btn => {
    btn.addEventListener('click', () => switchRoom(btn.dataset.room));
  });

  /* ── Comida (cada botón de la cocina) ──────────────────── */
  el.foodItems.forEach(item => {
    item.addEventListener('click', () => feedKitty(item.dataset.food, item));
  });

  /* ── Cama (dormitorio) ─────────────────────────────────── */
  if (el.sleepBed) {
    el.sleepBed.addEventListener('click', putToSleep);
  }

  /* ── Corazones (sala del amor) ─────────────────────────── */
  el.loveHearts.forEach(heart => {
    heart.addEventListener('click', () => giveLove(heart));
  });

  /* ── Tocar a Kitty directamente → efecto sorpresa ──────── */
  el.kitty.addEventListener('click', () => {
    if (state.isBusy) return;
    const surprises = ['¡Eso hace cosquillas! 😆', '¡Hola! 👋', '¡Mírame! 🌟'];
    const msg = surprises[Math.floor(Math.random() * surprises.length)];
    showSpeech(msg, 1800);
    spawnParticles('⭐', el.kitty, 3);
  });
}


/* ════════════════════════════════════════════════════════════
   13. INICIALIZACIÓN
   Punto de entrada principal del juego.
═══════════════════════════════════════════════════════════════ */

function init() {
  console.log('🐱 Kitty Care — ¡Iniciando!');

  // Pintar barras con el estado inicial
  updateBars();

  // Mostrar cara inicial (feliz)
  showFace('happy');
  applyMoodClass();

  // Asegurar que la cocina es visible
  el.gameArea.dataset.room = 'kitchen';

  // Registrar todos los eventos
  initEventListeners();

  // Arrancar el decaimiento
  startDecay();

  // Mensaje de bienvenida con delay pequeño
  setTimeout(() => {
    showSpeech('¡Hola! ¡Cuídame mucho! 🌸', 2800);
  }, 600);

  console.log('✅ Kitty Care listo. ¡Que la cuides bien!');
}

/* Esperar a que el DOM esté completamente cargado antes de iniciar */
document.addEventListener('DOMContentLoaded', init);
