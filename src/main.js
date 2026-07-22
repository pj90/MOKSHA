/**
 * ============================================================
 * src/main.js — मोक्ष Orchestrator (ES6 Module)
 * ============================================================
 *
 * यह फ़ाइल तीनों modules को एक साथ जोड़ती है:
 *   AudioManager  (audio.js  — global IIFE)
 *   KarmaEngine   (engine.js — ES6 class)
 *   Renderer      (render.js — ES6 module)
 *
 * यहाँ रहने वाली चीज़ें:
 *   • Canvas + context setup
 *   • UI DOM references
 *   • Event listeners (keyboard, gamepad, buttons, wheel)
 *   • scaleGame() / debounce()
 *   • Gamepad module (pollGamepad, vibrateGamepad, etc.)
 *   • Shastra navigation (toggleShastra, updateShastraPage)
 *   • draw() — engine.getState() + Renderer calls
 *   • gameLoop() — रा॒फ़ loop
 *   • Start-screen poller
 *
 * ============================================================
 */

import { Renderer }     from './render.js';
import { KarmaEngine, SAMAYA_PRAARAMBHIKA }  from './engine.js';
import { Audio } from './audio.js';

// ====================== AUDIO (IIFE global) ======================
// audio.js <script src> से पहले load हो चुका है — window.AudioManager
const AM = Audio;

// ====================== CANVAS SETUP ======================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', {
    alpha: false,            // compositing cost बचाएँ
    willReadFrequently: false // getImageData() नहीं — GPU path
});

const WIDTH        = 600;
const HEIGHT       = 680;
const TUNNEL_WIDTH = 180;
const TUNNEL_X     = (WIDTH - TUNNEL_WIDTH) / 2;

// HUD_TOP_Y — gameplay canvas की वह Y-सीमा जहाँ HUD overlay शुरू होता है
const HUD_TOP_Y = HEIGHT - 60 - (document.getElementById('ui-overlay')?.offsetHeight ?? 120);

// ====================== UI ELEMENT REFERENCES ======================
const UI = {
    container:       document.getElementById('gameContainer'),
    naama:           document.getElementById('naama'),
    punya:           document.getElementById('punya'),
    paap:            document.getElementById('paap'),
    prarabdha:       document.getElementById('prarabdha'),
    samarpita:       document.getElementById('samarpita'),
    punaraJanma:     document.getElementById('punaraJanma'),
    kripa:           document.getElementById('kripa'),
    shankha:         document.getElementById('shankha'),
    jyoti:           document.getElementById('jyoti'),
    drishti:         document.getElementById('drishti'),
    purnaSamarpana:  document.getElementById('purnaSamarpana'),
    chetana:         document.getElementById('chetana'),
    samayaVal:       document.getElementById('ui-samaya-val'),
    swaansaVal:      document.getElementById('ui-swaansa-val'),
    gatee:           document.getElementById('ui-gatee'),
    alertBox:        document.getElementById('alert-box'),
    overlay:         document.getElementById('screen-overlay'),
    overlayTitle:    document.getElementById('overlay-title'),
    overlaySubtitle: document.getElementById('overlay-subtitle'),
    viraamaOverlay:  document.getElementById('viraama-overlay'),
    shastraOverlay:  document.getElementById('shastra-overlay'),
};

// ====================== ENGINE INIT ======================
const engine = new KarmaEngine();

// inject callbacks
engine.setCallbacks({
    playSound:                (n)    => AM?.playSound(n),
    vibrateGamepad:           (w, s, d) => vibrateGamepad(w, s, d),
    updateAmbientVolumes:     ()     => AM?.updateAmbientVolumes(),
    stopSushuptiBreathLayer:  ()     => AM?.stopSushuptiBreathLayer(),
    startJagritaBreathLayer:  ()     => AM?.startJagritaBreathLayer(),
    stopJagritaBreathLayer:   ()     => AM?.stopJagritaBreathLayer(),
    startSushuptiBreathLayer: ()     => AM?.startSushuptiBreathLayer(),
});
engine.setUI(UI);
engine.init(WIDTH, HEIGHT, TUNNEL_X, TUNNEL_WIDTH);

// ====================== RENDERER INIT ======================
Renderer.init(ctx, WIDTH, HEIGHT);

// ====================== GAME-LOOP STATE ======================
let isGameStarted   = false;
let lastTime        = 0;
let frameNow        = 0;
let keys            = {};
let isFontsReady    = false;
let isScaleGameDone = false;

// ====================== SHASTRA STATE ======================
let currentShastraPage = 1;
// 🛠️ key-repeat बिना continuous scroll (dpad-stick जैसी consistency)
let shastraKeyState = { up: false, down: false };

// ====================== GAMEPAD MODULE ======================
const GAMEPAD_DEADZONE  = 0.18;
const GAMEPAD_BUTTON = {
    Y: 0, B: 1, X: 2, A: 3,
    LB: 4, RB: 5, LT: 6, RT: 7,
    BACK: 8, START: 9,
    DPAD_UP: 12, DPAD_DOWN: 13, DPAD_LEFT: 14, DPAD_RIGHT: 15,
};

let gamepadIndex    = null;
let gpButtonStates  = {};
let startScreenGpState = { start: false, back: false };

/** Synthetic keyboard event dispatch (DRY — gamepad→keyboard bridge) */
function dispatchKey(type, key) {
    window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true }));
}

/** Haptic feedback — Web Gamepad API */
function vibrateGamepad(weakMagnitude, strongMagnitude, duration) {
    const MIN_STRONG = 0.18;
    strongMagnitude = Math.max(strongMagnitude, MIN_STRONG * (strongMagnitude > 0 ? 1 : 0));
    if (gamepadIndex === null) return;
    const gp = navigator.getGamepads()[gamepadIndex];
    if (gp?.vibrationActuator?.playEffect) {
        gp.vibrationActuator.playEffect('dual-rumble', {
            startDelay: 0, duration,
            weakMagnitude, strongMagnitude,
        }).catch(() => {});
    }
}

/** discrete button → keyboard (edge-triggered) */
function handleDiscreteButton(gp, buttonIndex, keyName) {
    const isPressed  = !!(gp.buttons[buttonIndex]?.pressed);
    const wasPressed = !!gpButtonStates[buttonIndex];
    if (isPressed && !wasPressed) dispatchKey('keydown', keyName);
    if (!isPressed && wasPressed) dispatchKey('keyup', keyName);
    gpButtonStates[buttonIndex] = isPressed;
}

/** edge-triggered helper for any boolean condition */
function handleShastraDirection(stateKey, isActiveNow, onRise) {
    const wasActive = !!gpButtonStates[stateKey];
    if (isActiveNow && !wasActive) onRise();
    gpButtonStates[stateKey] = isActiveNow;
}

/** शास्त्र-नेविगेशन (shared between pollGamepad + pollGamepadOnStartScreen) */
function handleShastraGamepadNav(gp) {
    const stickX    = gp.axes[0] || 0;
    const stickY    = gp.axes[1] || 0;
    const dpadLeft  = !!gp.buttons[GAMEPAD_BUTTON.DPAD_LEFT]?.pressed;
    const dpadRight = !!gp.buttons[GAMEPAD_BUTTON.DPAD_RIGHT]?.pressed;
    const dpadUp    = !!gp.buttons[GAMEPAD_BUTTON.DPAD_UP]?.pressed;
    const dpadDown  = !!gp.buttons[GAMEPAD_BUTTON.DPAD_DOWN]?.pressed;

    const left  = (stickX < -GAMEPAD_DEADZONE) || dpadLeft;
    const right = (stickX > GAMEPAD_DEADZONE)  || dpadRight;

    handleShastraDirection('shastra_left',      left,    () => dispatchKey('keydown', 'ArrowLeft'));
    handleShastraDirection('shastra_right',     right,   () => dispatchKey('keydown', 'ArrowRight'));
    handleShastraDirection('shastra_dpad_up',   dpadUp,  () => dispatchKey('keydown', 'PageUp'));
    handleShastraDirection('shastra_dpad_down', dpadDown,() => dispatchKey('keydown', 'PageDown'));

    // Analog stick → smooth scroll (collision-free)
    if (stickY < -GAMEPAD_DEADZONE || stickY > GAMEPAD_DEADZONE) {
        const body = document.getElementById('shastra-body');
        if (body) body.scrollTop += stickY * 6 * 2;
    }
}

/** Main gamepad poll — हर frame gameLoop() में बुलाया जाता है */
function pollGamepad() {
    if (gamepadIndex === null) {
        const pads = navigator.getGamepads();
        for (let i = 0; i < pads.length; i++) {
            if (pads[i]) { gamepadIndex = pads[i].index; break; }
        }
        if (gamepadIndex === null) return;
    }
    const gp = navigator.getGamepads()[gamepadIndex];
    if (!gp) { gamepadIndex = null; return; }

    const stickX    = gp.axes[0] || 0;
    const dpadLeft  = !!gp.buttons[GAMEPAD_BUTTON.DPAD_LEFT]?.pressed;
    const dpadRight = !!gp.buttons[GAMEPAD_BUTTON.DPAD_RIGHT]?.pressed;

    if (engine.isShastraVisible) {
        handleShastraGamepadNav(gp);
        keys['arrowleft'] = false; keys['arrowright'] = false;
    } else {
        // Movement
        keys['arrowleft']  = (stickX < -GAMEPAD_DEADZONE) || dpadLeft;
        keys['arrowright'] = (stickX > GAMEPAD_DEADZONE)  || dpadRight;

        // Discrete buttons
        handleDiscreteButton(gp, GAMEPAD_BUTTON.RT,    ' ');   // नाम-जाप
        handleDiscreteButton(gp, GAMEPAD_BUTTON.X,     's');   // वैराग्य
        handleDiscreteButton(gp, GAMEPAD_BUTTON.RB,    'arrowup'); // नाम-समर्पण
        handleDiscreteButton(gp, GAMEPAD_BUTTON.LB,    'q');   // छोड़ें
        handleDiscreteButton(gp, GAMEPAD_BUTTON.LT,    'r');   // पुनः आरंभ
        handleDiscreteButton(gp, GAMEPAD_BUTTON.START, 'f');   // स्तम्भन
        handleDiscreteButton(gp, GAMEPAD_BUTTON.Y,     'y');   // शंख
        handleDiscreteButton(gp, GAMEPAD_BUTTON.B,     'b');   // ज्योति
    }
    handleDiscreteButton(gp, GAMEPAD_BUTTON.BACK, 'Escape'); // शास्त्र
}

// ====================== SHASTRA UI ======================

function updateShastraPage() {
    for (let p = 1; p <= 3; p++) {
        document.getElementById(`shastra-page-${p}`)?.classList.remove('active');
    }
    document.getElementById(`shastra-page-${currentShastraPage}`)?.classList.add('active');
    const navBtn = document.getElementById('shastra-nav-btn');
    if (navBtn) {
        navBtn.textContent = currentShastraPage < 3
            ? `अगला  [ ${currentShastraPage} / 3 ]`
            : `पिछला  [ ${currentShastraPage} / 3 ]`;
    }
}

/**
 * शास्त्र toggle — engine state + DOM overlay एक साथ update।
 * (DRY: ESC key, shastra-help-btn, shastra-close-btn तीनों यही बुलाते हैं)
 */
function toggleShastra() {
    engine.toggleShastra(); // engine internal state update
    if (engine.isShastraVisible) {
        // overlay DOM
        currentShastraPage = 1; updateShastraPage();
        keys = {};
    } else {
        keys = {};
    }
}

// ====================== CONTINUOUS SHASTRA SCROLL ======================
// ArrowUp/Down को OS key-repeat पर निर्भर न रखकर — held-flag से smooth scroll
function continuousShastraScrollLoop() {
    if (engine.isShastraVisible) {
        const body = document.getElementById('shastra-body');
        if (body) {
            if (shastraKeyState.up)   body.scrollTop -= 6;
            if (shastraKeyState.down) body.scrollTop += 6;
        }
    }
    requestAnimationFrame(continuousShastraScrollLoop);
}
requestAnimationFrame(continuousShastraScrollLoop);

// ====================== UTILITY ======================
function debounce(func, delay) {
    let timeoutId;
    return function() { clearTimeout(timeoutId); timeoutId = setTimeout(func, delay); };
}

// ====================== SCALE GAME ======================
function scaleGame() {
    const s = Math.min(window.innerWidth / 600, window.innerHeight / 680) * 0.90;
    UI.container.style.transform = `scale(${s})`;
    isScaleGameDone = true; // AudioManager readiness coordination
    AM?.notifyReadiness?.();

}
scaleGame();
const debouncedScale = debounce(scaleGame, 200);
window.addEventListener('resize', debouncedScale);

// ====================== EVENT LISTENERS ======================

// ── Wheel (shastra scroll) ──
window.addEventListener('wheel', (e) => {
    if (!engine.isShastraVisible) return;
    e.preventDefault();
    const body = document.getElementById('shastra-body');
    if (body) body.scrollTop += e.deltaY; // direct — collision-free
}, { passive: false });

// ── Keyboard ──
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();

    if (!isGameStarted && key !== 'escape' && !engine.isShastraVisible) return;
    AM?.ensureAudio();

    if (['arrowup','arrowdown','arrowleft','arrowright',' ','q','f','r','escape','pageup','pagedown'].includes(key)) {
        e.preventDefault();
    }

    if (key === 'escape') { toggleShastra(); return; }

    if (engine.isShastraVisible) {
        const body = document.getElementById('shastra-body');
        if (key === 'arrowleft'  && currentShastraPage > 1) { currentShastraPage--; updateShastraPage(); if (body) body.scrollTop = 0; }
        if (key === 'arrowright' && currentShastraPage < 3) { currentShastraPage++; updateShastraPage(); if (body) body.scrollTop = 0; }
        if (key === 'arrowup')   shastraKeyState.up   = true;
        if (key === 'arrowdown') shastraKeyState.down = true;
        if (key === 'pageup')   { if (body) body.scrollTop -= body.clientHeight * 0.9; }
        if (key === 'pagedown') { if (body) body.scrollTop += body.clientHeight * 0.9; }
        return;
    }

    keys[key] = true;

    // ── Engine actions from keydown ──
    if (key === 'r') { engine.reset(); lastTime = performance.now(); return; }
    if (key === 'q') { engine.actionPralaya(); return; }
    if (key === 'f') { engine.actionPause(); return; }
    if (key === ' ') { engine.actionNaamaJaapa(); return; }
    if (key === 'y') { engine.actionShankha(); return; }
    if (key === 'b') { engine.actionJyoti(); return; }
    if (key === 'arrowup' || key === 'w') { engine.actionNaamaSamarpan(); return; }
    if (key === 'arrowdown' || key === 's') { engine.actionVairaagya(); return; }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    keys[key] = false;
    if (key === 'arrowup')   shastraKeyState.up   = false;
    if (key === 'arrowdown') shastraKeyState.down = false;
});

window.addEventListener('blur',        () => { keys = {}; });
window.addEventListener('pointerdown', () => AM?.ensureAudio(), { passive: true });

// ── Gamepad connect / disconnect ──
window.addEventListener('gamepadconnected', (e) => {
    gamepadIndex = e.gamepad.index;
    gpButtonStates = {};
    console.log(`🎮 Gamepad जुड़ा: ${e.gamepad.id}`);
    if (engine._UI?.alertBox) {
        engine._UI.alertBox.innerText = "🎮 गेमपैड जुड़ा: नियंत्रण सक्रिय";
        engine._UI.alertBox.style.color = "#32ff32";
    }
});
window.addEventListener('gamepaddisconnected', (e) => {
    if (gamepadIndex === e.gamepad.index) {
        gamepadIndex = null;
        keys['arrowleft'] = false; keys['arrowright'] = false;
    }
});

// ── Visibility change → auto pause ──
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isGameStarted &&
        !engine.gameOver && !engine.won &&
        !engine.isPaused && !engine.isShastraVisible) {
        engine.isPaused = true;
        if (UI.viraamaOverlay) UI.viraamaOverlay.style.display = 'flex';
        AM?.playSound('viraama');
        keys = {};
        if (UI.alertBox) { UI.alertBox.innerText = "⏸️ खेल स्तम्भित: ध्यान भटका, टैब बदला गया।"; UI.alertBox.style.color = "#ffd700"; }
        AM?.updateAmbientVolumes();
    }
});

// ── Button click handlers ──
document.getElementById('resume-btn')?.addEventListener('click', () => {
    engine.actionResume(); lastTime = performance.now();
});
document.getElementById('restart-btn')?.addEventListener('click', () => {
    UI.viraamaOverlay.style.display = 'none';
    engine.reset(); lastTime = performance.now();
});
document.getElementById('quit-btn')?.addEventListener('click', () => {
    UI.viraamaOverlay.style.display = 'none';
    engine.actionPralaya();
});
document.getElementById('music-toggle-btn')?.addEventListener('click', () => {
    AM?.ensureAudio(); AM?.toggleBgMusic();
});
document.getElementById('shastra-help-btn')?.addEventListener('click', () => {
    AM?.ensureAudio(); toggleShastra();
});
document.getElementById('shastra-close-btn')?.addEventListener('click', () => {
    toggleShastra();
});
document.getElementById('shastra-nav-btn')?.addEventListener('click', () => {
    currentShastraPage = currentShastraPage < 3 ? currentShastraPage + 1 : 1;
    updateShastraPage();
    const body = document.getElementById('shastra-body');
    if (body) body.scrollTop = 0;
});
document.getElementById('music-volume-slider')?.addEventListener('input', (e) => {
    if (AM) {
        AM.bgMusicVolume = parseFloat(e.target.value) / 100;
        AM.updateAmbientVolumes();
    }
});

// ====================== DRAW FUNCTION ======================
// engine.getState() से सभी visual state पढ़ता है।
// Renderer utility functions + direct ctx draws — सब यहाँ।

function draw() {
    Renderer.drawScene({
        // ── Canvas dimensions & Vedic constants ──
        WIDTH, HEIGHT, TUNNEL_X, TUNNEL_WIDTH,
        SAMAYA_PRAARAMBHIKA,
        frameNow,

        // ── Engine state (सम्पूर्ण snapshot) ──
        ...engine.getState(),

        // ── Private → public name mapping ──
        // render.js इन्हें underscore-prefix के बिना expect करता है
        pulledHorseX:          engine._pulledHorseX,
        pulledHorseY:          engine._pulledHorseY,
        pendingGoodKarma:      engine._pendingGoodKarma,
        punyaTimer:            engine._punyaTimer,
        pendingGoodKarmaCount: engine._pendingGoodKarmaCount,
    });
}

// ====================== GAME LOOP ======================
lastTime = performance.now();

function gameLoop(ts) {
    pollGamepad();
    if (!engine.isPaused && !engine.gameOver && !engine.won && !engine.isShastraVisible) {
        const dt = Math.min((ts - lastTime) / (1000 / 60), 2);
        frameNow += (ts - lastTime);
        engine.update(dt, keys, frameNow);
    }
    lastTime = ts;
    draw();
    requestAnimationFrame(gameLoop);
}

// ====================== START SCREEN ======================
const startBtn = document.getElementById('start-btn');

// Start-screen gamepad poller (game शुरू होने से पहले)
function pollGamepadOnStartScreen() {
    if (isGameStarted) return; // यह poller अपना काम पूरा कर चुका

    const pads = navigator.getGamepads();
    let gp = null;
    for (let i = 0; i < pads.length; i++) { if (pads[i]) { gp = pads[i]; break; } }

    if (gp) {
        const startBtnGp   = gp.buttons[GAMEPAD_BUTTON.START];
        const startPressed  = !!(startBtnGp?.pressed);
        const startRise     = startPressed && !startScreenGpState.start;
        startScreenGpState.start = startPressed;

        if (startRise && !engine.isShastraVisible) {
            gpButtonStates[GAMEPAD_BUTTON.START] = true;
            startBtn?.click();
        }

        const backBtnGp  = gp.buttons[GAMEPAD_BUTTON.BACK];
        const backPressed = !!(backBtnGp?.pressed);
        const backRise    = backPressed && !startScreenGpState.back;
        startScreenGpState.back = backPressed;
        if (backRise) dispatchKey('keydown', 'Escape');

        if (engine.isShastraVisible) handleShastraGamepadNav(gp);
    }

    requestAnimationFrame(pollGamepadOnStartScreen);
}
requestAnimationFrame(pollGamepadOnStartScreen);

// ── Start button ──
startBtn?.addEventListener('click', () => {
    if (isGameStarted) return;
    AM?.ensureAudio();
    isGameStarted = true;
    document.getElementById('start-screen')?.remove();
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
});

// ====================== AUDIO MANAGER WIRING ======================
// AudioManager में game state getter inject करें
AM?.setGameStateProvider?.(() => ({
    isGameStarted,
    gameOver:        engine.gameOver,
    won:             engine.won,
    isPaused:        engine.isPaused,
    isShastraVisible: engine.isShastraVisible,
    chetanaaJagrita: engine.chetanaaJagrita,
}));
// पुराना API compatibility
AM?.setGameStateGetter?.(() => ({
    isGameStarted,
    gameOver:        engine.gameOver,
    won:             engine.won,
    isPaused:        engine.isPaused,
    isShastraVisible: engine.isShastraVisible,
    chetanaaJagrita: engine.chetanaaJagrita,
}));
AM?.setVibrateGamepad?.(vibrateGamepad);
AM?.setVibrateCallback?.(vibrateGamepad);
AM?.setReadinessGetters?.({
    getFontsReady:    () => isFontsReady,
    getScaleGameDone: () => isScaleGameDone,
}); 

document.fonts.ready.then(() => {
    isFontsReady = true;
    AM?.notifyReadiness?.();
    AM?.checkReadiness?.(); // old API compatibility
});

// scaleGame() के बाद readiness notify
// (scaleGame() पहले ही ऊपर call हो चुका है — AM?.setScaleDone() वहाँ बुलाया)

// ── AudioManager init ──
AM?.init?.();
