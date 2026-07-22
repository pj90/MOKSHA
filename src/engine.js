/**
 * ============================================================
 * src/engine.js — मोक्ष KarmaEngine (ES6 Module)
 * ============================================================
 *
 * सम्पूर्ण Vedic Karma तर्क, physics, object-pooling, और
 * game-state transition rules यहाँ encapsulate हैं।
 *
 * ── निकाली गई चीज़ें (index.html से) ──────────────────────
 *  • सभी कर्म/मोक्ष state variables
 *  • चार pre-allocated object pools (mayaPool, particlePool,
 *    glowEffectPool, floatingTextPool) — GC-pressure शून्य
 *  • update(dt, keys, frameNow)  — मुख्य game-logic tick
 *  • reset()  — punahaPrarambha (पवित्र/R-key पुनर्जन्म)
 *  • showEndScreen(reason)  — end-game UI
 *  • getState()  — renderer/main के लिए सम्पूर्ण state snapshot
 *  • सभी Vedic helper functions (grantKripa, collectResource, etc.)
 *
 * ── बाहरी निर्भरताएँ (injected callbacks) ─────────────────
 *  engine.setCallbacks({
 *      playSound,                // (name) => void
 *      vibrateGamepad,           // (weak, strong, ms) => void
 *      updateAmbientVolumes,     // () => void
 *      stopSushuptiBreathLayer,  // () => void
 *      startJagritaBreathLayer,  // () => void
 *      stopJagritaBreathLayer,   // () => void
 *      startSushuptiBreathLayer, // () => void
 *  });
 *  engine.setUI(UI);  // DOM element references object
 *
 * ── main.js में उपयोग ────────────────────────────────────
 *  import { KarmaEngine } from './src/engine.js';
 *  const engine = new KarmaEngine();
 *  engine.setCallbacks({...});
 *  engine.setUI(UI);
 *  engine.init(600, 680, TUNNEL_X, 180);
 *
 *  // gameLoop में:
 *  engine.update(dt, keys, frameNow);
 *  // draw() में: engine.* से state पढ़ें (public properties)
 * ============================================================
 */

// ====================== शास्त्रीय स्थिरांक (VEDIC CONSTANTS) ======================

/** समय-प्रारंभिक: प्रत्येक जीवन-चक्र में यही मान (पुनर्जन्म पर भी) */
export const SAMAYA_PRAARAMBHIKA = 2880;

/** समर्पित की वह सीमा जिस पर चेतना जागृत होती है */
export const CHETANA_JAGRITI_THRESHOLD = 50;

/** नाम-जाप-वलय प्रति-frame विस्तार गति (px, dt=1 पर) */
export const NAAMA_JAAP_GROWTH_SPEED = 22;

/** इस त्रिज्या पर नाम-जाप-वलय स्वतः समाप्त */
export const NAAMA_JAAP_MAX_RADIUS = 1000;

/** घोड़ों का माया-आकर्षण दायरा (px) */
export const HORSE_PULL_RANGE = 160;

/** हर 20 नए नाम-संग्रह पर कृपा++ */
export const KRIPA_NAAM_MILESTONE = 20;

/** हर 30 नए समर्पित-अर्जन पर कृपा++ */
export const KRIPA_SAMARPITA_MILESTONE = 30;

/**
 * माया-size lookup-table (DRY: nested-ternary का स्थान)।
 * नया type जोड़ने पर सिर्फ़ यहाँ एक entry जोड़ें।
 */
export const MAYA_SIZE_TABLE = {
    naama:   { width: 36, height: 36 },
    kripa:   { width: 32, height: 32 },
    cyclone: { width: 32, height: 32 },
    shankha: { width: 32, height: 32 },
    jyoti:   { width: 32, height: 32 },
    default: { width: 20, height: 24 },   // shuvha / rikta
};

/**
 * Resource-pickup lookup-table (DRY: शंख/ज्योति दोनों एक pattern)।
 */
export const RESOURCE_PICKUP_TABLE = {
    shankha: { icon: "🐚", color: "#7dd3fc", sound: "shankhaPrapta",
               alert: "🐚 शंख प्राप्त: विक्षेप-शमन हेतु सुरक्षित रखें।" },
    jyoti:   { icon: "🪔", color: "#ffe932", sound: "jyotiPrapta",
               alert: "🪔 ज्योति प्राप्त: B दबाकर अंधकार में प्रकाश फैलाएं।" },
};


// ====================== KarmaEngine CLASS ======================

export class KarmaEngine {

    constructor() {

        // ── Canvas dimensions (init() में सेट) ──────────────
        this.WIDTH        = 600;
        this.HEIGHT       = 680;
        this.TUNNEL_X     = 210;
        this.TUNNEL_WIDTH = 180;

        // ── Player ──────────────────────────────────────────
        /** player object — draw() इसे सीधे पढ़ता है */
        this.player = { x: 270, y: 430, width: 60, height: 60, baseSpeed: 8 };

        // ── Vedic Karma State ────────────────────────────────
        this.shuvhaKarma      = 0;   // पुण्य (सक्रिय)
        this.ashuvhaKarma     = 0;   // पाप (सक्रिय)
        this.activeNaam       = 0;   // ॐ नाम (उपयोग-योग्य)
        this.prarabdha        = 0;   // प्रारब्ध (संचित — सिर्फ़ 10-नाम से भस्म)
        this.samarpita        = 0;   // समर्पित (lifetime)
        this.punaraJanmaCount = 0;   // पुनर्जन्म गिनती
        this.isKarmaImmune    = false; // purnaSamarpana के बाद अस्थायी कर्म-रक्षा
        this.kripa            = 0;   // कृपा (अनुग्रह)
        this.shankha          = 0;   // शंख resource
        this.jyoti            = 0;   // ज्योति resource

        // ── Spiritual State ──────────────────────────────────
        this.chetanaaJagrita = false;  // मोक्ष की प्रामाणिक शर्त
        this.purnaSamarpana  = false;  // अंतिम-चरण में समस्त नाम समर्पित
        this.jaapaNaama      = "राधा"; // नाम-जाप पर floating text
        this.isNaamaJaapa    = false;  // क्या अभी नाम-जाप-वलय सक्रिय है?
        this.naamaGhera      = 0;     // नाम-जाप-वलय की वर्तमान त्रिज्या
        this.naamaJaapaPower = 0;     // SPACE दबाने पर उपलब्ध activeNaam

        // ── Time / Breath ────────────────────────────────────
        this.samaya          = SAMAYA_PRAARAMBHIKA;
        this.swaansa         = 10;
        this.swaansaTimer    = 0;      // 0→360 per breath-cycle
        this.swaansaSamapta  = false;  // क्या ब्रह्मांडीय क्षितिज आ गया?

        // ── Game Flow Flags ──────────────────────────────────
        this.gameOver        = false;
        this.isPaused        = false;
        this.won             = false;
        this.isShastraVisible = false;
        this.wasAlreadyPaused = false; // shastra खुलने से पहले का pause-state

        // ── Visual / Animation State ─────────────────────────
        this.smoothSize      = 60;       // player body-size (lerped)
        this.bodyGlowTimer   = 0;
        this.bodyGlowColor   = "#ffffff";
        this.shakeTimer      = 0;
        this.naamaGlowTimer  = 0;
        this.playerInTunnel  = false;
        this.notifyTimer     = 0;
        this.notifyText      = "♻️ पवित्र पुनर्जन्म";
        this.currentBorderColor = "";

        // ── Glow Ring System (DRY) ───────────────────────────
        /**
         * तीनों expanding-ring वलयें — engine state में हैं,
         * draw() इन्हें पढ़कर render करता है।
         */
        this.glowRings = {
            jyoti:  { active: false, radius: 0, speed: 18, maxRadius: 420,
                      strokeColor: "rgba(255, 233, 50, 0.85)",   lineWidthMul: 0.004,
                      shadowBlur: 28, glowColor: "#ffe932", fillColor: "rgba(255, 233, 50, 0.05)" },
            shankha:{ active: false, radius: 0, speed: 18, maxRadius: 420,
                      strokeColor: "rgba(220, 240, 255, 0.85)", lineWidthMul: 0.004,
                      shadowBlur: 28, glowColor: "#ddf0ff", fillColor: "rgba(220, 240, 255, 0.04)" },
            kripa:  { active: false, radius: 0, speed: 22, maxRadius: 420,
                      strokeColor: "rgba(255, 215, 0, 0.85)",   lineWidthMul: 0.005,
                      shadowBlur: 22, glowColor: "#ffd700", fillColor: "rgba(255, 215, 0, 0.06)" },
        };

        // ── Outer Orbits (karma emoji rings) ────────────────
        /**
         * 9 कक्षाएँ — count>0 वाली ही draw होती हैं।
         * glowTimer: temporary pulse (नाम/समर्पित milestone पर)
         */
        this.outerOrbits = [
            { count: 0, color: "#32ff32", speed:  0.8, emoji: "🌿" },  // 0 पुण्य
            { count: 0, color: "#ff3232", speed: -0.9, emoji: "🥀" },  // 1 पाप
            { count: 0, color: "#a78bfa", speed:  0.6, emoji: "📜" },  // 2 प्रारब्ध
            { count: 0, color: "#ffffff", speed:  1.0, emoji: "ॐ",  glowTimer: 0 }, // 3 नाम
            { count: 0, color: "#ffe9a8", speed:  0.7, emoji: "✋" },  // 4 कृपा
            { count: 0, color: "#7dd3fc", speed:  0.5, emoji: "🐚" },  // 5 शंख
            { count: 0, color: "#ffe932", speed: -0.6, emoji: "🪔" },  // 6 ज्योति
            { count: 0, color: "#fb923c", speed:  1.1, emoji: "🙏", glowTimer: 0 }, // 7 समर्पित
            { count: 0, color: "#f87171", speed: -0.5, emoji: "♻️" }, // 8 पुनर्जन्म
        ];

        // ── Pre-allocated Object Pools (§2.3) ───────────────
        /** 50 maya entities (shuvha/rikta/naama/cyclone/kripa/shankha/jyoti) */
        this.mayaPool       = [];
        /** 50 explosion particles */
        this.particlePool   = [];
        /** 20 gained-glow rings (प्राप्ति-आभा) */
        this.glowEffectPool = [];
        /** 25 floating text labels (ॐ/🙏/+N etc.) */
        this.floatingTextPool = [];

        // ── Stars & Tunnel Sparkles ──────────────────────────
        this.stars           = [];
        this.tunnelSparkles  = [];

        // ── Horse pull system ────────────────────────────────
        /** 6 घोड़ों की chain-slot state (draw में प्रयुक्त) */
        this.chainSlots = [
            { active: false, color: "", strength: 0, isHeavy: false },
            { active: false, color: "", strength: 0, isHeavy: false },
            { active: false, color: "", strength: 0, isHeavy: false },
        ];
        /** 6 घोड़ों की X/Y positions (draw में प्रयुक्त) */
        this.finalHorsePositions = [
            {x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0},
        ];
        this.pulledHorseIndex = -1;
        this._pulledHorseX    = 0;
        this._pulledHorseY    = 0;

        // ── Pending punya timer ──────────────────────────────
        this._pendingGoodKarma      = false;
        this._punyaTimer            = 0;
        this._pendingGoodKarmaCount = 0;

        // ── Spawn timer ──────────────────────────────────────
        this._spawnTimer = 0;

        // ── Audio/sound edge-detection flags ─────────────────
        this._prevGoodKarmaForSound  = 0;
        this._prevBadKarmaForSound   = 0;
        this._prevPrarabdhaForSound  = 0;
        this._prevPurnaSamarpana     = false;
        this._prevDrishtiClear       = true;
        this._prevPulledHorseIndex   = -1;
        this._mayaConsumedWhilePulling = false;

        // ── Kripa milestone tracking ─────────────────────────
        this._prevActiveNaamForKripa  = 0;
        this._prevSamarpitaForKripa   = 0;
        this._naamaSinceLastKripa     = 0;
        this._samarpitaSinceLastKripa = 0;

        // ── Timer sound flags ────────────────────────────────
        this._timerSoundPlayed     = false;
        this._timerTickAccumulator = 0;
        this._lastPunyaAlertSecond = -1;

        // ── HUD animation state ──────────────────────────────
        this._oldStats = { naama:-1, punya:-1, paap:-1, prarabdha:-1, samarpita:-1,
                           punaraJanma:-1, gatee:"-1", kripa:-1, chetana:"",
                           shankha:-1, drishti:"", purnaSamarpana:"", jyoti:-1 };
        this._uiScales = { naama:1, punya:1, paap:1, prarabdha:1, samarpita:1,
                           punaraJanma:1, gatee:1, kripa:1, chetana:1,
                           shankha:1, drishti:1, purnaSamarpana:1, jyoti:1 };
        this._uiGlows  = { naama:0, punya:0, paap:0, prarabdha:0, samarpita:0,
                           punaraJanma:0, gatee:0, kripa:0, chetana:0,
                           shankha:0, drishti:0, purnaSamarpana:0, jyoti:0 };

        // ── Injected dependencies ────────────────────────────
        this._cb = {};   // callbacks — see setCallbacks()
        this._UI = null; // DOM references — see setUI()
    }

    // ====================== DEPENDENCY INJECTION ======================

    /**
     * Audio + haptic callbacks inject करें।
     * circular dependency को callback-pattern से हल करते हैं।
     *
     * @param {{
     *   playSound: function,
     *   vibrateGamepad: function,
     *   updateAmbientVolumes: function,
     *   stopSushuptiBreathLayer: function,
     *   startJagritaBreathLayer: function,
     *   stopJagritaBreathLayer: function,
     *   startSushuptiBreathLayer: function,
     * }} callbacks
     */
    setCallbacks(callbacks) {
        this._cb = callbacks;
    }

    /**
     * DOM element references inject करें।
     * main.js में बनाए गए UI object को यहाँ pass करें।
     *
     * @param {Object} UI — { naama, punya, paap, prarabdha, samarpita,
     *                         punaraJanma, kripa, shankha, jyoti, drishti,
     *                         purnaSamarpana, chetana, samayaVal, swaansaVal,
     *                         gatee, alertBox, overlay, overlayTitle,
     *                         overlaySubtitle, viraamaOverlay, shastraOverlay,
     *                         container }
     */
    setUI(UI) {
        this._UI = UI;
    }

    // ====================== INITIALIZATION ======================

    /**
     * Pools, stars, sparkles initialize करें।
     * scaleGame() के बाद एक बार बुलाएँ।
     */
    init(WIDTH, HEIGHT, TUNNEL_X, TUNNEL_WIDTH) {
        this.WIDTH        = WIDTH;
        this.HEIGHT       = HEIGHT;
        this.TUNNEL_X     = TUNNEL_X;
        this.TUNNEL_WIDTH = TUNNEL_WIDTH;

        // reset player position
        this.player.x = WIDTH / 2 - 30;
        this.player.y = HEIGHT - 250;

        // ── Pre-allocate pools (§2.3) — push/splice कभी नहीं ──
        for (let i = 0; i < 50; i++) {
            this.mayaPool.push({ active:false, x:0, y:0, width:20, height:24,
                                  type:"rikta", isPulling:false });
        }
        for (let i = 0; i < 50; i++) {
            this.particlePool.push({ active:false, x:0, y:0,
                                      vx:0, vy:0, radius:0, color:"#ffffff", alpha:0 });
        }
        for (let i = 0; i < 20; i++) {
            this.glowEffectPool.push({ active:false, x:0, y:0,
                                        radius:0, maxRadius:0, color:"#ffffff", alpha:0 });
        }
        for (let i = 0; i < 25; i++) {
            this.floatingTextPool.push({ active:false, x:0, y:0,
                                          text:"", color:"#ffffff", alpha:0, vy:0,
                                          isBigName:false,
                                          _cachedTextWidth:undefined, _cachedText:"" });
        }

        // ── Background stars ──
        for (let i = 0; i < 35; i++) {
            this.stars.push({ x: Math.random() * WIDTH, y: Math.random() * HEIGHT,
                               speed: Math.random() * 1.5 + 0.5, size: Math.random() * 1.0 + 0.3 });
        }
        // ── Tunnel sparkles ──
        for (let i = 0; i < 20; i++) {
            this.tunnelSparkles.push({
                x: TUNNEL_X + Math.random() * TUNNEL_WIDTH, y: Math.random() * HEIGHT,
                speed: Math.random() * 1.2 + 0.6, size: Math.random() * 1.5 + 0.5,
                alpha: Math.random() * 0.7 + 0.3, fadeSpeed: 0.01 + Math.random() * 0.02,
            });
        }
    }

    // ====================== MAIN UPDATE TICK ======================

    /**
     * एक frame की सम्पूर्ण game logic चलाता है।
     * gameLoop() से प्रत्येक frame में बुलाएँ।
     *
     * @param {number} dt       — frame delta (60fps-normalised, max 2)
     * @param {Object} keys     — keyboard state { 'a':true, ' ':true, ... }
     * @param {number} frameNow — performance.now() timestamp (render animations हेतु)
     */
    update(dt, keys, frameNow) {
        if (this.gameOver || this.isPaused || this.isShastraVisible) return;

        // ── 1. Outer-orbit counts sync ───────────────────────
        this._syncOrbitCounts();



        // ── 3. चेतना-जागृति (chetanaaJagrita) transition ───
        if (!this.gameOver && !this.chetanaaJagrita && this.samarpita >= CHETANA_JAGRITI_THRESHOLD) {
            this.chetanaaJagrita = true;
            this._cb.playSound?.('chetana');
            this._cb.stopSushuptiBreathLayer?.();
            this._cb.startJagritaBreathLayer?.();
            this._addFloatingText("👁️", "#ffffff", { yOffset:-10, alpha:1.5, vy:-3, isBigName:true });
        }

        // ── 4. कर्म-बंधन ध्वनि edge-detection ──────────────
        if (this.shuvhaKarma > 0 && this._prevGoodKarmaForSound === 0) this._cb.playSound?.('punyaBandhana');
        if (this.ashuvhaKarma > 0 && this._prevBadKarmaForSound === 0) this._cb.playSound?.('paapaBandhana');
        if (this.shuvhaKarma === 0 && this._prevGoodKarmaForSound > 0) this._cb.playSound?.('bandhanaMukta');
        if (this.ashuvhaKarma === 0 && this._prevBadKarmaForSound > 0) this._cb.playSound?.('bandhanaMukta');
        this._prevGoodKarmaForSound = this.shuvhaKarma;
        this._prevBadKarmaForSound  = this.ashuvhaKarma;

        if (this.prarabdha > 0 && this._prevPrarabdhaForSound === 0) this._cb.playSound?.('prarabdhaBandhana');
        if (this.prarabdha === 0 && this._prevPrarabdhaForSound > 0) this._cb.playSound?.('bandhanaMukta');
        this._prevPrarabdhaForSound = this.prarabdha;

        // ── 5. कृपा-माइलस्टोन edge-detection ────────────────
        if (this.activeNaam > this._prevActiveNaamForKripa)
            this._naamaSinceLastKripa += (this.activeNaam - this._prevActiveNaamForKripa);
        this._prevActiveNaamForKripa = this.activeNaam;

        while (this._naamaSinceLastKripa >= KRIPA_NAAM_MILESTONE) {
            this._naamaSinceLastKripa -= KRIPA_NAAM_MILESTONE;
            this._grantKripa(undefined, undefined, 'naam');
            if (this.outerOrbits[3]) this.outerOrbits[3].glowTimer = 60;
        }

        if (this.samarpita > this._prevSamarpitaForKripa)
            this._samarpitaSinceLastKripa += (this.samarpita - this._prevSamarpitaForKripa);
        this._prevSamarpitaForKripa = this.samarpita;

        while (this._samarpitaSinceLastKripa >= KRIPA_SAMARPITA_MILESTONE) {
            this._samarpitaSinceLastKripa -= KRIPA_SAMARPITA_MILESTONE;
            this._grantKripa(undefined, undefined, 'samarpita');
            if (this.outerOrbits[7]) this.outerOrbits[7].glowTimer = 60;
        }

        // ── 6. पूर्ण-समर्पण edge-detection ──────────────────
        if (this.purnaSamarpana && !this._prevPurnaSamarpana) {
            this._cb.playSound?.('purnaSamarpana');
            this._addFloatingText("🙌", "#ffe9a8", { alpha:1.5, vy:-3, isBigName:true });
        }
        this._prevPurnaSamarpana = this.purnaSamarpana;

        // ── 7. दृष्टि/अंधकार edge-detection ─────────────────
        const isDrishtiClear = this.ashuvhaKarma < 3;
        if (isDrishtiClear && !this._prevDrishtiClear) {
            this._cb.playSound?.('drishti');
            this._addFloatingText("☀️", "#ffe9a8", { alpha:1.5, vy:-3, isBigName:true });
        }
        if (!isDrishtiClear && this._prevDrishtiClear) {
            this._cb.playSound?.('andhakaara');
            this._addFloatingText("⚫", "#888888", { alpha:1.5, vy:-3, isBigName:true });
        }
        this._prevDrishtiClear = isDrishtiClear;

        if (this.notifyTimer > 0) { this.notifyTimer -= dt; if (this.notifyTimer < 0) this.notifyTimer = 0; }

        // ── 8. Player movement ───────────────────────────────
        const currentSpeed = this.player.baseSpeed * dt;
        if (keys['arrowleft'] || keys['a']) this.player.x -= currentSpeed;
        if (keys['arrowright'] || keys['d']) this.player.x += currentSpeed;
        this.player.x = Math.max(0, Math.min(this.WIDTH - this.player.width, this.player.x));

        this.playerInTunnel = this._isPlayerInsideTunnel();

        // ── 9. Body metrics (computed for collision & draw) ──
        let bodyRadius = this.smoothSize / 2;
        let cx = this.player.x + bodyRadius;
        let cy = this.player.y + bodyRadius;

        // ── 10. Horse pull system ─────────────────────────────
        let isAlreadyPulled = false;
        this.pulledHorseIndex = -1;
        for (let i = 0; i < this.mayaPool.length; i++) this.mayaPool[i].isPulling = false;

        const horseCount   = 6;
        const horseSpacing = 10;
        const startX       = cx - ((horseCount - 1) * horseSpacing) / 2;

        for (let i = 0; i < this.mayaPool.length; i++) {
            let m = this.mayaPool[i]; if (!m || !m.active) continue;
            let mCx = m.x + m.width / 2; let mCy = m.y + m.height / 2;

            if (!isAlreadyPulled && !this.chetanaaJagrita && m.y < cy - bodyRadius) {
                let closestIdx = -1; let minDistance = Infinity;
                let targetHx = 0; let targetHy = 0;
                for (let h = 0; h < horseCount; h++) {
                    let hx = startX + h * horseSpacing;
                    let wave = Math.sin((frameNow / 70) + h) * 3;
                    let hy = cy - bodyRadius - 45 + wave;
                    let d = Math.hypot(hx - mCx, hy - mCy);
                    if (d < minDistance) { minDistance = d; closestIdx = h; targetHx = hx; targetHy = hy; }
                }
                if (minDistance < HORSE_PULL_RANGE) {
                    isAlreadyPulled = true; m.isPulling = true; this.pulledHorseIndex = closestIdx;
                    let tx = targetHx + (mCx - targetHx) * 0.45;
                    let ty = targetHy + (mCy - targetHy) * 0.45;
                    this._pulledHorseX += (tx - this._pulledHorseX) * 0.3 * dt;
                    this._pulledHorseY += (ty - this._pulledHorseY) * 0.3 * dt;
                    if (cx < mCx) this.player.x += 1.8 * dt;
                    else if (cx > mCx) this.player.x -= 1.8 * dt;
                }
            }
        }

        // आकर्षण/त्याग ध्वनि edge-detection
        if (this.pulledHorseIndex !== -1 && this._prevPulledHorseIndex === -1) {
            this._cb.playSound?.('aakarshana');
        } else if (this.pulledHorseIndex === -1 && this._prevPulledHorseIndex !== -1) {
            if (!this._mayaConsumedWhilePulling) this._cb.playSound?.('tyaaga');
            this._mayaConsumedWhilePulling = false;
        }
        this._prevPulledHorseIndex = this.pulledHorseIndex;

        // ── 11. Cyclone — माया-विक्षेप-बल ────────────────────
        const CYCLONE_FORCE = 2.2;
        for (let ci = 0; ci < this.mayaPool.length; ci++) {
            let cy0 = this.mayaPool[ci]; if (!cy0.active || cy0.type !== "cyclone") continue;
            let cyCx = cy0.x + cy0.width / 2;
            for (let mi = 0; mi < this.mayaPool.length; mi++) {
                let m2 = this.mayaPool[mi];
                if (!m2.active || m2 === cy0) continue;
                if (m2.type !== "shuvha" && m2.type !== "rikta") continue;
                m2.x += (cyCx - (m2.x + m2.width / 2)) * 0.05 * CYCLONE_FORCE * dt;
            }
        }
        this.player.x = Math.max(0, Math.min(this.WIDTH - this.player.width, this.player.x));

        // ── 12. नाम-जाप-वलय (naam-jaap ring) logic ───────────
        if (this.isNaamaJaapa) {
            this.naamaGhera += NAAMA_JAAP_GROWTH_SPEED * dt;

            let takraavaMaya = false;
            for (let i = 0; i < this.mayaPool.length; i++) {
                let m = this.mayaPool[i]; if (!m.active) continue;
                let mCx = m.x + m.width / 2; let mCy = m.y + m.height / 2;
                let dist = Math.hypot(mCx - cx, mCy - cy);
                let explColor = m.type === 'shuvha' ? '#32ff32' : m.type === 'rikta' ? '#ff3232' : '#ffffff';

                if (dist <= this.naamaGhera) {
                    // cyclone — naam-ring से प्रभावित नहीं (शास्त्र-संगत)
                    if (m.type === 'cyclone') continue;
                    if (m.isPulling) this._mayaConsumedWhilePulling = true;

                    if (m.type === 'naama') {
                        this.activeNaam++;
                        this._addFloatingText("ॐ", "#ffffff", { x:mCx, y:mCy });
                        this._createGainedGlow(mCx, mCy, "#ffffff");
                        this.naamaGlowTimer = 40; this._triggerGlow("#ffffff");
                        this._cb.playSound?.('naama');
                        m.active = false; continue;
                    } else if (m.type === 'shankha') {
                        this._collectResource('shankha', mCx, mCy, { withGainedGlow:true, alert:false });
                        m.active = false; continue;
                    } else if (m.type === 'jyoti') {
                        this._collectResource('jyoti', mCx, mCy, { withGainedGlow:true, alert:false });
                        m.active = false; continue;
                    } else if (m.type === 'kripa') {
                        this._grantKripa(mCx, mCy);
                        takraavaMaya = true; m.active = false; continue;
                    } else if (m.type === 'shuvha') {
                        this._createExplosion(mCx, mCy, explColor);
                        this._addFloatingText("🙏", "#fb923c", { x:mCx, y:mCy });
                        this.samarpita++; takraavaMaya = true; m.active = false; continue;
                    } else if (m.type === 'rikta') {
                            this._createExplosion(mCx, mCy, explColor);
                            this._addFloatingText("🙏", "#fb923c", { x:mCx, y:mCy });
                            this.samarpita++; takraavaMaya = true; m.active = false; continue;
                    }
                }
            }
            if (takraavaMaya) this._cb.playSound?.('samarpita');

            // वलय पूर्ण — नाम-शक्ति जाँचें
            if (this.naamaGhera > NAAMA_JAAP_MAX_RADIUS) {
                this.isNaamaJaapa = false; this.naamaGhera = 0;
                if (this.naamaJaapaPower >= 10 && this.prarabdha > 0) {
                    this.prarabdha--;
                    this._addFloatingText("-📜", "#a78bfa", { vy:-3, isBigName:true });
                    this._cb.playSound?.('bandhanaMukta');
                    this._updateAlert("🔥 दस नाम से प्रारब्ध भस्म हुआ!", "#a78bfa");
                } else {
                    this._updateAlert("नाम जपत मंगल दिसि दसहूँ॥", "#ffd700");
                }
                this.naamaJaapaPower = 0;
            }
        }

        // ── 13. Glow-ring updates (DRY helper) ───────────────
        // ज्योति — सिर्फ़ दृश्य
        this._updateGlowRing(this.glowRings.jyoti, dt);

        // शंख — cyclone-collision भी जाँचे
        this._updateGlowRing(this.glowRings.shankha, dt, (ring) => {
            let shankhaHit = false;
            for (let si = 0; si < this.mayaPool.length; si++) {
                let sm = this.mayaPool[si]; if (!sm.active || sm.type !== "cyclone") continue;
                let smCx = sm.x + sm.width / 2; let smCy = sm.y + sm.height / 2;
                if (Math.hypot(smCx - cx, smCy - cy) <= ring.radius) {
                    sm.active = false; this.samarpita++;
                    this._createExplosion(smCx, smCy, "#7dd3fc");
                    this._addFloatingText("🙏", "#fb923c", { x:smCx, y:smCy });
                    shankhaHit = true;
                }
            }
            if (shankhaHit) { this._cb.playSound?.('samarpita'); this._updateAlert("🐚 शंख-ध्वनि: चक्रवात समर्पित हुआ।", "#7dd3fc"); }
        });

        // कृपा — सिर्फ़ दृश्य (माया-भस्म नहीं — शास्त्र-संगत)
        this._updateGlowRing(this.glowRings.kripa, dt);

        // ── 14. Pending punya timer ───────────────────────────
        if (this._pendingGoodKarma) {
            this._punyaTimer -= dt;
            let secondsLeft = Math.ceil(this._punyaTimer / 60);
            if (secondsLeft !== this._lastPunyaAlertSecond) {
                this._lastPunyaAlertSecond = secondsLeft;
                this._updateAlert("⚠️ पुण्य प्रभाव (+" + this._pendingGoodKarmaCount + ")! समय: " + secondsLeft + "s | ⬇️ या S: वैराग्य ⚠️", "#ffd700");
            }
            if (this._punyaTimer <= 0) {
                this._lastPunyaAlertSecond = -1;
                let gained = this._pendingGoodKarmaCount;
                this._pendingGoodKarma = false;
                this.shuvhaKarma += gained; this._pendingGoodKarmaCount = 0;
                this._addFloatingText(`+${gained} 🌿`, "#32ff32");
                this._triggerBlast("#32ff32");
                this._updateAlert("🔥 पुण्य अवशोषित: सारथी के मन ने अच्छे कर्म स्वीकार किए।", "#32ff32");
            }
        }

        // ── 15. Time / Samaya ─────────────────────────────────
        const riktaTimeModifier = Math.pow(0.7, this.ashuvhaKarma);
        const shuvhaTimeModifier = Math.pow(0.8, this.shuvhaKarma);

        if (!this.swaansaSamapta) {
            this.samaya -= 0.8 * riktaTimeModifier * shuvhaTimeModifier * dt;
            this.swaansaTimer += dt;
            if (this.swaansaTimer >= 360) {
                this.swaansaTimer -= 360;
                if (this.swaansa > 0) this.swaansa--;
            }

            // DOM updates (guarded)
            const samayaDisplay = `${Math.max(0, Math.ceil(this.samaya))}s`;
            const swaansaDisplay = `${Math.max(0, Math.ceil(this.swaansa))}`;
            if (this._UI?.samayaVal?.innerText !== samayaDisplay) {
                if (this._UI?.samayaVal) this._UI.samayaVal.innerText = samayaDisplay;
            }
            if (this._UI?.swaansaVal?.innerText !== swaansaDisplay) {
                if (this._UI?.swaansaVal) this._UI.swaansaVal.innerText = swaansaDisplay;
            }

            const currentWarpVal = (riktaTimeModifier * shuvhaTimeModifier * 100).toFixed(0);
            this._updateStatWithPulse(this._UI?.gatee, 'gatee', currentWarpVal, '⚡', '%');

            if (this.samaya <= 0) {
                this.samaya = 0; this.swaansa = 0; this.swaansaSamapta = true;
                this._updateAlert("ब्रह्मांडीय क्षितिज पर पहुंचे। समय स्थिर है।", "#ffffff");
            }
        } else {
            // ── 16. ब्रह्मांडीय क्षितिज (Brahmaandiya Kshitij) — निर्णय ──
            this._checkMokhsha();
        }

        // ── 17. अंतिम-चरण टाइमर-ध्वनि ───────────────────────
        const samayaAntimaCharana = (this.samaya < 100 && this.samaya > 0 && !this.swaansaSamapta);
        const antimaCharana = samayaAntimaCharana || this._pendingGoodKarma;
        if (samayaAntimaCharana && !this._timerSoundPlayed) {
            this._timerSoundPlayed = true;
            this._cb.playSound?.('antimCharana');
        }
        if (antimaCharana) {
            this._timerTickAccumulator += dt;
            if (this._timerTickAccumulator >= 60) {
                this._timerTickAccumulator -= 60;
                this._cb.playSound?.('timer');
            }
        } else {
            this._timerTickAccumulator = 0;
        }

        // ── 18. Stars & sparkles movement ─────────────────────
        this.stars.forEach(star => {
            if (!this.swaansaSamapta) {
                star.y += star.speed * (riktaTimeModifier * shuvhaTimeModifier + 0.1) * dt;
                if (star.y > this.HEIGHT) { star.y = 0; star.x = Math.random() * this.WIDTH; }
            }
        });
        this.tunnelSparkles.forEach(sparkle => {
            if (!this.swaansaSamapta) {
                sparkle.y -= sparkle.speed * (riktaTimeModifier * shuvhaTimeModifier + 0.2) * dt;
                sparkle.alpha += sparkle.fadeSpeed * dt;
                if (sparkle.alpha > 0.9 || sparkle.alpha < 0.2) sparkle.fadeSpeed = -sparkle.fadeSpeed;
                if (sparkle.y < 0) { sparkle.y = this.HEIGHT; sparkle.x = this.TUNNEL_X + Math.random() * this.TUNNEL_WIDTH; sparkle.alpha = Math.random() * 0.5 + 0.2; }
            }
        });

        // ── 19. Pool aging ────────────────────────────────────
        for (let i = 0; i < this.particlePool.length; i++) {
            let p = this.particlePool[i]; if (!p.active) continue;
            p.x += p.vx * dt; p.y += p.vy * dt; p.alpha -= 0.03 * dt;
            if (p.alpha <= 0) p.active = false;
        }
        for (let i = 0; i < this.glowEffectPool.length; i++) {
            let g = this.glowEffectPool[i]; if (!g.active) continue;
            g.radius += 1.4 * dt; g.alpha -= 0.045 * dt;
            if (g.alpha <= 0 || g.radius >= g.maxRadius) g.active = false;
        }
        for (let i = 0; i < this.floatingTextPool.length; i++) {
            let ft = this.floatingTextPool[i]; if (!ft.active) continue;
            ft.y += ft.vy * dt; ft.alpha -= 0.015 * dt;
            if (ft.alpha <= 0) ft.active = false;
        }

        // ── 20. Maya spawn ────────────────────────────────────
        this._spawnTimer += dt;
        const spawnRate = this.swaansaSamapta ? 35 : 45;
        if (this._spawnTimer > spawnRate) {
            this._spawnTimer = 0;
            this._spawnMaya();
        }

        // ── 21. Maya movement & player collision ───────────────
        const mayaSpeed = Math.max(1.2, 4 * riktaTimeModifier * shuvhaTimeModifier);
        for (let i = 0; i < this.mayaPool.length; i++) {
            let m = this.mayaPool[i]; if (!m.active) continue;
            m.y += mayaSpeed * dt;
            if (m.y > this.HEIGHT) { m.active = false; continue; }

            const hitX = m.x < this.player.x + this.player.width && m.x + m.width > this.player.x;
            const hitY = m.y < this.player.y + this.player.height && m.y + m.height > this.player.y;
            if (hitX && hitY) {
                if (m.isPulling) this._mayaConsumedWhilePulling = true;
                if (this.isKarmaImmune) {
                    this._createExplosion(m.x, m.y, "#ffffff"); m.active = false; continue;
                }
                this.shakeTimer = 8;
                this._handlePlayerMayaCollision(m, cx);
            }
        }

        // ── 22. Timer decays ──────────────────────────────────
        if (this.shakeTimer > 0) this.shakeTimer -= dt;
        if (this.naamaGlowTimer > 0) this.naamaGlowTimer -= dt;
        if (this.bodyGlowTimer > 0) this.bodyGlowTimer -= dt;
        if (this.outerOrbits[3]?.glowTimer > 0) this.outerOrbits[3].glowTimer -= dt;
        if (this.outerOrbits[7]?.glowTimer > 0) this.outerOrbits[7].glowTimer -= dt;

        this.smoothSize += ((this.playerInTunnel ? 30 : 60) - this.smoothSize) * 0.18 * dt;

        // ── 23. HUD scale/glow animations ────────────────────
        this._updateHUDAnimations(dt);
        // ── 2. HUD update ────────────────────────────────────
        this._updateUIStats();
    }

    // ====================== KEYBOARD ACTIONS ======================
    // (main.js के keydown handler से बुलाए जाते हैं)

    /**
     * SPACE / RT — नाम-जाप शुरू करें
     */
    actionNaamaJaapa() {
        if (this.gameOver || this.isPaused) return;
        if (this.activeNaam >= 1 && !this.isNaamaJaapa) {
            this.naamaJaapaPower = this.activeNaam;
            this.activeNaam--;
            this.isNaamaJaapa = true;
            this.naamaGhera = this.smoothSize / 2;
            this._cb.playSound?.('jaapa');
            this._updateAlert("🌿 नाम जपते मंगल दिसि दसहूँ 🌿", "#ffff00");
            this._addFloatingText(this.jaapaNaama, "#ffff00", { yOffset:-10, alpha:1.5, vy:-2, isBigName:true });
        } else if (this.activeNaam === 0 && !this.isNaamaJaapa) {
            this._updateAlert("❌ नाम जाप के लिए नाम की आवश्यकता है!", "#ff3232");
            this._cb.playSound?.('rikta');
        }
    }

    /**
     * Y / Gamepad-Y — शंख-वलय शुरू करें
     */
    actionShankha() {
        if (this.gameOver || this.isPaused) return;
        if (this.shankha > 0) {
            this.shankha--;
            this.glowRings.shankha.active = true; this.glowRings.shankha.radius = 0;
            this._cb.playSound?.('shankhaDhwani');
            this._updateAlert("🐚 शंख-ध्वनि: श्वेत प्रकाश फैल रहा है...", "#ffffff");
        } else {
            this._updateAlert("❌ शंख-शक्ति समाप्त — पहले शंख संग्रह करें।", "#ff3232");
            this._cb.playSound?.('rikta');
        }
    }

    /**
     * B / Gamepad-B — ज्योति-वलय शुरू करें
     */
    actionJyoti() {
        if (this.gameOver || this.isPaused) return;
        if (this.jyoti > 0) {
            this.jyoti--;
            this.glowRings.jyoti.active = true; this.glowRings.jyoti.radius = 0;
            this._cb.playSound?.('jyotiDhwani');
            this._updateAlert("🪔 ज्योति जली: पाप-अंधकार में प्रकाश फैल रहा है...", "#ffe932");
        } else {
            this._updateAlert("❌ ज्योति-शक्ति समाप्त — पहले ज्योति संग्रह करें।", "#ff3232");
            this._cb.playSound?.('rikta');
        }
    }

    /**
     * W / ↑ / RB — अंतिम-चरण में नाम-समर्पण
     */
    actionNaamaSamarpan() {
        if (this.gameOver || this.isPaused) return;
        if (this.samaya >= 100) {
            this._updateAlert("❌ नाम समर्पण केवल 'अंतिम चरण' में संभव है।", "#ff3232");
            this._cb.playSound?.('rikta'); return;
        }
        if (this.activeNaam === 0) {
            this._updateAlert("❌ समर्पण हेतु नाम शेष नहीं है।", "#ff3232");
            this._cb.playSound?.('rikta'); return;
        }
        if (!this.playerInTunnel) {
            this._updateAlert("❌ नाम समर्पण करने के लिए आपको भक्ति-मार्ग के अंदर होना चाहिए।", "#ff3232");
            this._cb.playSound?.('rikta'); return;
        }
        let gained = (this.activeNaam * 3) + (this.kripa + this.shankha + this.jyoti);
        this.samarpita += gained;
        this.activeNaam = 0; this.kripa = 0; this.shankha = 0; this.jyoti = 0;
        this.purnaSamarpana = true; this.isKarmaImmune = true;
        this._addFloatingText(`+${gained} ॐ🙏`, "#ffff00", { alpha:1.5, vy:-2, isBigName:true, yOffset:-10 });
        this._updateAlert("🌿 नाम समर्पित: +" + gained + " मिले।", "#ffff00");
        this._cb.playSound?.('naamaSamarpita');
    }

    /**
     * S / ↓ / X — वैराग्य (पुण्य-प्रलोभन त्यागें)
     */
    actionVairaagya() {
        if (this.gameOver || this.isPaused) return;
        if (this._pendingGoodKarma) {
            let gained = this._pendingGoodKarmaCount;
            this.samarpita += gained;
            this._pendingGoodKarma = false; this._punyaTimer = 0; this._pendingGoodKarmaCount = 0;
            this._addFloatingText(`+${gained} 🙏`, "#fb923c");
            this._triggerBlast("#32ff32");
            this._cb.playSound?.('samarpita');
            this._updateAlert("🛑 वैराग्य: सारथी ने पुण्य का प्रलोभन ठुकराया।", "#ff3232");
        } else {
            this._cb.playSound?.('rikta');
        }
    }

    /**
     * Q / LB — प्रलय (FORCE STOP)
     */
    actionPralaya() {
        if (this.gameOver) return;
        this.gameOver = true; this.won = false;
        this.showEndScreen("FORCE STOPPED");
        this._cb.playSound?.('takraava');
    }

    /**
     * F / START — स्तम्भन (Pause toggle)
     * @returns {boolean} क्या pause हुआ?
     */
    actionPause() {
        if (this.gameOver || this.won) { this._cb.playSound?.('rikta'); return false; }
        this.isPaused = !this.isPaused;
        if (this._UI?.viraamaOverlay) {
            this._UI.viraamaOverlay.style.display = this.isPaused ? 'flex' : 'none';
        }
        if (this.isPaused) {
            this._cb.playSound?.('viraama');
        } else {
            this._cb.playSound?.('resume');
        }
        this._cb.updateAmbientVolumes?.();
        return this.isPaused;
    }

    /**
     * Resume (resume-btn click)
     */
    actionResume() {
        this.isPaused = false;
        if (this._UI?.viraamaOverlay) this._UI.viraamaOverlay.style.display = 'none';
        this._cb.playSound?.('resume');
    }

    // ====================== GAME STATE TRANSITIONS ======================

    /**
     * शास्त्र overlay toggle — engine का internal state update।
     * main.js से toggleShastra() में बुलाएँ।
     */
    toggleShastra() {
        // viraama मेनू खुला हो तो पहले छिपाएँ
        if (this._UI?.viraamaOverlay?.style.display === 'flex') {
            this._UI.viraamaOverlay.style.display = 'none';
        }
        this.isShastraVisible = !this.isShastraVisible;
        if (this._UI?.shastraOverlay) {
            this._UI.shastraOverlay.style.display = this.isShastraVisible ? 'flex' : 'none';
        }
        if (this.isShastraVisible) {
            this.wasAlreadyPaused = this.isPaused;
            this.isPaused = true;
            this._cb.playSound?.('viraama');
        } else {
            if (this.wasAlreadyPaused) {
                this.isPaused = true;
                if (this._UI?.viraamaOverlay) this._UI.viraamaOverlay.style.display = 'flex';
                this._cb.playSound?.('viraama');
            } else {
                this.isPaused = false;
                this._cb.playSound?.('resume');
            }
            this.wasAlreadyPaused = false;
        }
        this._cb.updateAmbientVolumes?.();
    }

    /**
     * showEndScreen — game-over / moksha / rebirth overlay।
     * update() से internally बुलाया जाता है; main.js से भी बुला सकते हैं।
     *
     * @param {string} reason — "FORCE STOPPED" | "EVALUATING" (default)
     */
    showEndScreen(reason = "EVALUATING") {
        if (this._UI?.viraamaOverlay) this._UI.viraamaOverlay.style.display = 'none';
        if (this._UI?.overlay) this._UI.overlay.style.display = 'flex';

        if (reason === "FORCE STOPPED") {
            if (this._UI?.overlayTitle) {
                this._UI.overlayTitle.innerText = "🛑 प्रलय 🛑";
                this._UI.overlayTitle.style.fontFamily = "'Noto Sans Devanagari', sans-serif";
                this._UI.overlayTitle.style.color = "#ff3232";
            }
            if (this._UI?.overlaySubtitle) {
                this._UI.overlaySubtitle.innerHTML =
                    `<b>यात्रा रद्द:</b><br>सारथी ने रथ को बीच में ही छोड़ दिया।<br>` +
                    `चित्त की अवस्था: पुण्य: ${this.shuvhaKarma} | पाप: ${this.ashuvhaKarma}<br><br>` +
                    `आत्मा अप्रकट अंधकारमय स्थान में फंसी रहती है।<br>` +
                    `अतः, घोड़े आत्मा को संसार में एक नए शरीर की ओर खींच ले जाते हैं।<br><br>` +
                    `<span style="font-family:'Noto Sans Devanagari',sans-serif;color:#f87171;font-size:14px;">` +
                    `♻️ पुनर्जन्म: <b>${this.punaraJanmaCount}</b></span>` +
                    `<br><br><div style="font-size:10px;color:#444;font-family:sans-serif;">Developed by Weired Codes</div>`;
            }
        } else if (this.won) {
            if (this._UI?.overlayTitle) {
                this._UI.overlayTitle.innerText = "💥 मोक्ष 💥";
                this._UI.overlayTitle.style.color = "#ffffff";
            }
            if (this._UI?.overlaySubtitle) {
                this._UI.overlaySubtitle.innerHTML =
                    "<div style='color:#ffa600;font-family:\"Orbitron\",sans-serif;font-size:15px;font-weight:700;margin-bottom:8px;'>" +
                    "आपको पुनः जन्म लेने की आवश्यकता नहीं है। यह संसार एक माया जाल है, जिससे आपने अंततः मुक्ति पा ली है।</div>" +
                    "<div style='color:#a78bfa;font-family:\"Orbitron\",sans-serif;font-size:11px;font-weight:600;letter-spacing:1.5px;margin-bottom:20px;'>" +
                    "आपने जन्म-मरण के इस खेल पर विजय प्राप्त कर ली है।</div>" +
                    "<span style='color:rgba(255,255,255,0.6);font-size:13px;line-height:1.6;display:block;max-width:90%;margin:0 auto;'>" +
                    "<b>गुणों और कर्मों से परे</b><br>अद्भुत अनुभूति! सारथी ने इंद्रियों रूपी घोड़ों को स्थिर रखा और मन को पूर्णतः आसक्ति मुक्त कर दिया।</span>" +
                    `<br><br><div style="font-size:10px;color:#444;font-family:sans-serif;">Developed by Weired Codes</div>`;
            }
            this._cb.playSound?.('vijaya');
        } else {
            if (this._UI?.overlayTitle) {
                this._UI.overlayTitle.innerText = "संसार में पुनर्जन्म";
                this._UI.overlayTitle.style.color = "#ff3232";
            }
            if (this._UI?.overlaySubtitle) {
                this._UI.overlaySubtitle.innerHTML =
                    `<b>मोह की लगाम:</b><br>` +
                    (this.ashuvhaKarma > 0 ? `आपके (${this.ashuvhaKarma}) पापों ने सारथी को अंधा कर दिया।<br>` : '') +
                    (this.shuvhaKarma > 0 ? `आपके (${this.shuvhaKarma}) पुण्यों में मन आसक्त हो गया।<br>` : '') +
                    `<br>घोड़े आत्मा को नए शरीर की ओर ले जाते हैं।<br><br>` +
                    `<span style="font-family:'Noto Sans Devanagari',sans-serif;color:#f87171;font-size:14px;">` +
                    `♻️ पुनर्जन्म: <b>${this.punaraJanmaCount}</b></span>` +
                    `<br><br><div style="font-size:10px;color:#444;font-family:sans-serif;">Developed by Weired Codes</div>`;
            }
        }
    }

    /**
     * punahaPrarambha (R-key / restart-btn) — सम्पूर्ण reset।
     * पवित्र (voluntary) पुनर्जन्म — सभी counters शून्य।
     */
    reset() {
        // ── Karma reset ──
        this.prarabdha = 0; this.shuvhaKarma = 0; this.ashuvhaKarma = 0;
        this.activeNaam = 0; this.samarpita = 0; this.punaraJanmaCount = 0;
        this.isKarmaImmune = false; this.kripa = 0; this.shankha = 0; this.jyoti = 0;

        // ── Time reset ──
        this.samaya = SAMAYA_PRAARAMBHIKA; this.swaansa = 10;
        if (this._UI?.samayaVal) this._UI.samayaVal.innerText = `${SAMAYA_PRAARAMBHIKA}s`;
        if (this._UI?.swaansaVal) this._UI.swaansaVal.innerText = `10`;

        // ── Spiritual state reset ──
        this.chetanaaJagrita = false; this.purnaSamarpana = false;

        // ── Edge-detection flags reset ──
        this._prevPurnaSamarpana = false; this._prevDrishtiClear = true;
        this._prevGoodKarmaForSound = 0; this._prevBadKarmaForSound = 0;
        this._prevPrarabdhaForSound = 0;
        this._prevActiveNaamForKripa = 0; this._prevSamarpitaForKripa = 0;
        this._naamaSinceLastKripa = 0; this._samarpitaSinceLastKripa = 0;
        this._prevPulledHorseIndex = -1; this._mayaConsumedWhilePulling = false;

        // ── Timer flags reset ──
        this._timerSoundPlayed = false; this._timerTickAccumulator = 0;
        this._lastPunyaAlertSecond = -1;

        // ── Physics reset ──
        this.swaansaTimer = 0; this.gameOver = false; this.isPaused = false;
        this.won = false; this.swaansaSamapta = false; this._spawnTimer = 0;
        this._pendingGoodKarma = false; this._pendingGoodKarmaCount = 0; this._punyaTimer = 0;
        this.pulledHorseIndex = -1; this._pulledHorseX = 0; this._pulledHorseY = 0;
        this.naamaGlowTimer = 0; this.bodyGlowTimer = 0; this.smoothSize = 60;
        this.isNaamaJaapa = false; this.naamaGhera = 0; this.naamaJaapaPower = 0;

        // ── Orbit glow reset ──
        if (this.outerOrbits[3]) this.outerOrbits[3].glowTimer = 0;
        if (this.outerOrbits[7]) this.outerOrbits[7].glowTimer = 0;
        this._resetAllGlowRings();

        // ── Pool reset (pool-pattern: splice नहीं) ──
        for (let i = 0; i < this.glowEffectPool.length; i++) this.glowEffectPool[i].active = false;
        for (let i = 0; i < this.particlePool.length; i++) this.particlePool[i].active = false;
        for (let i = 0; i < this.floatingTextPool.length; i++) this.floatingTextPool[i].active = false;
        for (let i = 0; i < this.mayaPool.length; i++) this.mayaPool[i].active = false;

        // ── Audio layers reset ──
        this._cb.stopJagritaBreathLayer?.();
        this._cb.startSushuptiBreathLayer?.();

        // ── HUD cache invalidate ──
        this._oldStats = { purnaSamarpana:"", naama:-1, punya:-1, paap:-1,
                           prarabdha:-1, samarpita:-1, punaraJanma:-1,
                           gatee:"-1", kripa:-1, chetana:"", shankha:-1, drishti:"", jyoti:-1 };

        // ── UI reset ──
        if (this._UI?.overlay) this._UI.overlay.style.display = 'none';
        if (this._UI?.viraamaOverlay) this._UI.viraamaOverlay.style.display = 'none';
        this._updateUIStats();
        this._cb.playSound?.('punaha');

        // ── Player position reset ──
        this.player.x = this.WIDTH / 2 - 30;

        this._updateAlert("♻️ पवित्र पुनर्जन्म: नया सफर शुरू होता है।", "#32ff32");
        this.notifyTimer = 100; this.notifyText = "♻️ पवित्र पुनर्जन्म";
    }

    /**
     * draw() के लिए complete state snapshot।
     * renderer इसे destructure करके सब कुछ render करता है।
     *
     * @returns {Object} — सभी visual state properties
     */
    getState() {
        return {
            // Karma
            shuvhaKarma:      this.shuvhaKarma,
            ashuvhaKarma:     this.ashuvhaKarma,
            activeNaam:       this.activeNaam,
            prarabdha:        this.prarabdha,
            samarpita:        this.samarpita,
            punaraJanmaCount: this.punaraJanmaCount,
            kripa:            this.kripa,
            shankha:          this.shankha,
            jyoti:            this.jyoti,
            // Spiritual
            chetanaaJagrita:  this.chetanaaJagrita,
            purnaSamarpana:   this.purnaSamarpana,
            // Time
            samaya:           this.samaya,
            swaansa:          this.swaansa,
            swaansaTimer:     this.swaansaTimer,
            swaansaSamapta:   this.swaansaSamapta,
            // Game flow
            gameOver:         this.gameOver,
            isPaused:         this.isPaused,
            won:              this.won,
            isShastraVisible: this.isShastraVisible,
            // Visual
            player:           this.player,
            smoothSize:       this.smoothSize,
            shakeTimer:       this.shakeTimer,
            bodyGlowTimer:    this.bodyGlowTimer,
            bodyGlowColor:    this.bodyGlowColor,
            naamaGlowTimer:   this.naamaGlowTimer,
            playerInTunnel:   this.playerInTunnel,
            notifyTimer:      this.notifyTimer,
            notifyText:       this.notifyText,
            isNaamaJaapa:     this.isNaamaJaapa,
            naamaGhera:       this.naamaGhera,
            // Pools (references — draw reads directly)
            mayaPool:           this.mayaPool,
            particlePool:       this.particlePool,
            glowEffectPool:     this.glowEffectPool,
            floatingTextPool:   this.floatingTextPool,
            stars:              this.stars,
            tunnelSparkles:     this.tunnelSparkles,
            // Orbits & rings
            outerOrbits:      this.outerOrbits,
            glowRings:        this.glowRings,
            chainSlots:       this.chainSlots,
            finalHorsePositions: this.finalHorsePositions,
            pulledHorseIndex: this.pulledHorseIndex,
            _pulledHorseX:    this._pulledHorseX,
            _pulledHorseY:    this._pulledHorseY,
        };
    }

    // ====================== PRIVATE METHODS ======================

    /** Outer-orbit counts को current state के साथ sync करें */
    _syncOrbitCounts() {
        this.outerOrbits[0].count = this.shuvhaKarma;
        this.outerOrbits[1].count = this.ashuvhaKarma;
        this.outerOrbits[2].count = this.prarabdha;
        this.outerOrbits[3].count = this.activeNaam;
        this.outerOrbits[4].count = this.kripa;
        this.outerOrbits[5].count = this.shankha;
        this.outerOrbits[6].count = this.jyoti;
        this.outerOrbits[7].count = this.samarpita;
        this.outerOrbits[8].count = this.punaraJanmaCount;
    }

    /**
     * ब्रह्मांडीय क्षितिज पर मोक्ष-शर्त जाँचे।
     * swaansaSamapta === true होने पर हर frame चलता है।
     */
    _checkMokhsha() {
        // ── मोक्ष-शर्त (§1.2) ──
        if (this.shuvhaKarma === 0 && this.ashuvhaKarma === 0 &&
            !this._pendingGoodKarma && this.prarabdha === 0 &&
            this.chetanaaJagrita && this.purnaSamarpana) {
            if (this._UI?.samayaVal) this._UI.samayaVal.innerText = `मोक्ष 🌿`;
            if (this._UI?.swaansaVal) this._UI.swaansaVal.innerText = `0`;
            if (!this.gameOver) { this.gameOver = true; this.won = true; this.showEndScreen(); }
            return;
        }

        // ── पुनर्जन्म (अपवित्र/पवित्र) ──
        const isApavitra = (this.shuvhaKarma > 0 || this.ashuvhaKarma > 0 || this.prarabdha > 0);
        const earnsKripaOnRebirth = (this.activeNaam >= 20 || this.samarpita >= 30 || this.chetanaaJagrita);
        const gainedPrarabdha = (this.shuvhaKarma + this.ashuvhaKarma) +
                                 (this._pendingGoodKarma ? this._pendingGoodKarmaCount : 0);

        if (this._pendingGoodKarma) {
            this.prarabdha += this._pendingGoodKarmaCount;
            this._pendingGoodKarma = false; this._punyaTimer = 0; this._pendingGoodKarmaCount = 0;
        }
        this.prarabdha += (this.shuvhaKarma + this.ashuvhaKarma);
        if (gainedPrarabdha > 0) this._addFloatingText(`+${gainedPrarabdha} 📜`, "#a78bfa");

        this.ashuvhaKarma = 0; this.shuvhaKarma = 0;
        this.punaraJanmaCount++;
        this._triggerBlast("#f87171");
        this.samaya = SAMAYA_PRAARAMBHIKA; this.swaansa = 10; this.swaansaSamapta = false;
        this._timerTickAccumulator = 0; this._timerSoundPlayed = false;

        if (isApavitra) {
            this._updateAlert("♻️ अपवित्र पुनर्जन्म: कर्म असंतुलित रह गया, चक्र जारी है...", "#ff3232");
            this.notifyText = "♻️ अपवित्र पुनर्जन्म";
        } else {
            this._updateAlert("♻️ पवित्र पुनर्जन्म: कर्म शुद्ध था, परंतु यात्रा अधूरी रही।", "#ffd700");
            this.notifyText = "♻️ पवित्र पुनर्जन्म";
        }
        this.notifyTimer = 100;

        // कृपा-जन्म-बोनस (शास्त्र-संगत)
        if (earnsKripaOnRebirth) {
            this.kripa++;
            this._createGainedGlow(this.player.x + this.player.width / 2,
                                    this.player.y + this.player.height / 2, "#ffe9a8");
            this._addFloatingText("✋", "#ffe9a8", { alpha:1.3, vy:-1.6, isBigName:true });
            if (this.activeNaam >= 20) this._addFloatingText("ॐ", "#ffffff", { alpha:1.5, vy:-2.2, isBigName:true });
            if (this.samarpita >= 30) this._addFloatingText("🙏", "#fb923c", { alpha:1.5, vy:-2.2, isBigName:true });
            this._updateAlert("🙏 अतिरिक्त कृपा लेकर नए जीवन में प्रवेश!", "#ffe9a8");
            this._triggerGlow("#ffe9a8");
            this._cb.playSound?.('kripa');
        }
        this._cb.playSound?.('punaha');
    }

    /**
     * Maya spawn logic — spawnTimer overflow पर एक entity spawn।
     */
    _spawnMaya() {
        const rand = Math.random();
        let type = "rikta"; let xPos;

        // कृपा-factor: प्रति-कृपा 5% माया-अनुपात बदलाव
        const kripaFactor    = this.kripa * 0.05;
        const shuvhaThreshold = Math.max(0.10, 0.425 - (kripaFactor * 1.5));
        const freedFromPaapa  = 0.425 - shuvhaThreshold;
        const punyaProb       = 0.425 + freedFromPaapa * 0.4;
        const naamaThreshold  = shuvhaThreshold + punyaProb;

        if      (rand > 0.985) { type = "kripa";   xPos = Math.random() * (this.WIDTH - 110) + 40; }
        else if (rand > 0.97)  { type = "cyclone"; xPos = Math.random() * (this.WIDTH - 110) + 40; }
        else if (rand > 0.945) { type = "shankha"; xPos = Math.random() * (this.WIDTH - 110) + 40; }
        else if (rand > 0.92)  { type = "jyoti";   xPos = Math.random() * (this.WIDTH - 110) + 40; }
        else if (rand > naamaThreshold) { type = "naama"; xPos = this.TUNNEL_X + Math.random() * (this.TUNNEL_WIDTH - 20); }
        else if (rand > shuvhaThreshold) { type = "shuvha"; xPos = Math.random() * (this.WIDTH - 110) + 40; }
        else { type = "rikta"; xPos = Math.random() * (this.WIDTH - 110) + 40; }

        for (let i = 0; i < this.mayaPool.length; i++) {
            if (!this.mayaPool[i].active) {
                const sizeInfo = MAYA_SIZE_TABLE[type] || MAYA_SIZE_TABLE.default;
                this.mayaPool[i].active = true; this.mayaPool[i].x = xPos; this.mayaPool[i].y = -30;
                this.mayaPool[i].width = sizeInfo.width; this.mayaPool[i].height = sizeInfo.height;
                this.mayaPool[i].type = type; this.mayaPool[i].isPulling = false;
                break;
            }
        }
    }

    /**
     * Player-Maya direct collision handler।
     * उपयुक्त Vedic logic apply करता है।
     */
    _handlePlayerMayaCollision(m, cx) {
        if (m.type === "naama") {
            this.activeNaam++;
            this._addFloatingText("ॐ", "#ffffff");
            this.naamaGlowTimer = 40; this._triggerGlow("#ffffff");
            this._cb.playSound?.('naama');
            this._updateAlert("🌿 नाम सुमिरन: शुद्धिकरण...", "#ffff00");
            if (this.playerInTunnel) {
                // शास्त्र-संगत क्रम: पुण्य → पाप → प्रारब्ध (एक बार में एक इकाई)
                if (this.shuvhaKarma > 0 && this.activeNaam >= 1) {
                    this.activeNaam -= 1; this.shuvhaKarma -= 1; this.samarpita += 1;
                    this._addFloatingText("🌸", "#32ff32"); this._triggerGlow("#32ff32"); this._cb.playSound?.('samarpita');
                } else if (this.ashuvhaKarma > 0 && this.activeNaam >= 5) {
                    this.activeNaam -= 5; this.ashuvhaKarma -= 1; this.samarpita += 1;
                    this._addFloatingText("💧", "#ff3232"); this._triggerGlow("#ff3232"); this._cb.playSound?.('samarpita');
                } else if (this.prarabdha > 0 && this.activeNaam >= 10) {
                    this.activeNaam -= 10; this.prarabdha -= 1; this.samarpita += 1;
                    this._addFloatingText("⚖️", "#a78bfa"); this._triggerGlow("#a78bfa"); this._cb.playSound?.('samarpita');
                }
            }
        } else if (m.type === "kripa") {
            this._grantKripa(m.x, m.y);
        } else if (m.type === "shankha") {
            this._collectResource('shankha', m.x, m.y);
        } else if (m.type === "jyoti") {
            this._collectResource('jyoti', m.x, m.y);
        } else if (m.type === "cyclone") {
            const cycloneCx = m.x + m.width / 2;
            const pushDir = (cx < cycloneCx) ? -1 : 1;
            this.player.x = Math.max(0, Math.min(this.WIDTH - this.player.width, this.player.x + pushDir * 200));
            this._addFloatingText("🌪️", "#aaaaaa", { x: m.x + m.width / 2, y: m.y });
            this._cb.vibrateGamepad?.(0.4, 0.6, 180);
            this._updateAlert("🌪️ विक्षेप: चक्रवात ने रथ को झकझोरा!", "#aaaaaa");
            return; // m.active = false नहीं — cyclone यथावत
        } else if (m.type === "shuvha") {
            if (!this._pendingGoodKarma) { this._pendingGoodKarma = true; this._punyaTimer = 180; }
            this._pendingGoodKarmaCount++;
            this._cb.playSound?.('shuvha');
        } else {
            // rikta (पाप)
            this.ashuvhaKarma++;
            this._addFloatingText("🥀", "#ff3232"); this._triggerBlast("#ff3232");
            this._cb.playSound?.('ashuvha');
            this._updateAlert("🚨 पाप हमला!", "#ff3232");
        }
        m.active = false;
    }

    // ── Vedic Helper Methods ──────────────────────────────────

    /**
     * कृपा-प्रभाव — सक्रिय पुण्य व पाप भस्म; प्रारब्ध अप्रभावित।
     * बंधन हो → kripa--, karma→samarpita; बंधन न हो → kripa++।
     * (§1.4)
     */
    _grantKripa(x, y, reason = null) {
        const freedKarma = this.shuvhaKarma + this.ashuvhaKarma;
        const hadKarma   = freedKarma > 0;
        if (hadKarma) {
            if (this.kripa > 0) this.kripa--;
            this.samarpita   += freedKarma;
            this.shuvhaKarma  = 0; this.ashuvhaKarma = 0;
            // ⚠️ प्रारब्ध जानबूझकर अप्रभावित — पूर्व-जन्मों का भार
        } else {
            this.kripa++;
        }
        const px = x ?? (this.player.x + this.player.width / 2);
        const py = y ?? (this.player.y + this.player.height / 2);
        this._createGainedGlow(px, py, "#ffe9a8");
        if (reason === 'naam')     this._addFloatingText("✋ॐ", "#ffffff", { x:px, y:py, alpha:1.5, vy:-2.2, isBigName:true });
        else if (reason === 'samarpita') this._addFloatingText("✋🙏", "#fb923c", { x:px, y:py, alpha:1.5, vy:-2.2, isBigName:true });
        else                             this._addFloatingText("✋", "#ffe9a8", { x:px, y:py, alpha:1.3, vy:-1.6, isBigName:true });
        if (hadKarma) {
            const bandhanX = this.player.x + this.player.width / 2;
            const bandhanY = this.player.y + this.player.height / 2 + 50;
            this._createExplosion(bandhanX, bandhanY, "#ffe9a8");
            this._addFloatingText(`+${freedKarma} 🙏`, "#ffe9a8", { x:bandhanX, y:bandhanY - 20 });
        }
        this._triggerGlow("#ffe9a8");
        this._cb.playSound?.('kripa');
        this._updateAlert(hadKarma ? "✋ कृपा: सारथी के सभी सांसारिक पुण्य-पाप समर्पित हुए।"
                                   : "✋ कृपा प्राप्त हुई।", "#ffe9a8");
        this.glowRings.kripa.active = true; this.glowRings.kripa.radius = 0;
    }

    /**
     * Resource-collect helper (DRY: शंख/ज्योति दोनों के लिए)।
     * @param {string}  type — 'shankha' | 'jyoti'
     * @param {number}  x, y — world position
     * @param {Object}  opts — { withGainedGlow, alert }
     */
    _collectResource(type, x, y, opts = {}) {
        const info = RESOURCE_PICKUP_TABLE[type];
        if (!info) return;
        if (type === "shankha") this.shankha++;
        else if (type === "jyoti") this.jyoti++;
        this._addFloatingText(info.icon, info.color, { x, y });
        if (opts.withGainedGlow) this._createGainedGlow(x, y, info.color);
        this._triggerGlow(info.color);
        this._cb.playSound?.(info.sound);
        if (opts.alert !== false) this._updateAlert(info.alert, info.color);
    }

    /**
     * Pool pattern: floatingText activate करें।
     * (§2.3 — कोई push नहीं, पहला inactive slot reuse)
     */
    _addFloatingText(text, color, opts = {}) {
        const baseX = opts.x ?? (this.player.x + this.player.width / 2);
        const baseY = opts.y ?? this.player.y;
        for (let i = 0; i < this.floatingTextPool.length; i++) {
            let ft = this.floatingTextPool[i];
            if (ft.active) continue;
            ft.active = true;
            ft.x      = baseX + (Math.random() * 20 - 10);
            ft.y      = baseY + (opts.yOffset ?? 10);
            ft.text   = text; ft.color = color;
            ft.alpha  = opts.alpha ?? 1.0;
            ft.vy     = opts.vy ?? (-1 - Math.random() * 0.5);
            ft.isBigName = opts.isBigName || false;
            if (ft._cachedText !== text) { ft._cachedTextWidth = undefined; ft._cachedText = text; }
            return;
        }
        // सभी slots व्यस्त — silently skip (pool-integrity बनाए रखें)
    }

    /** Explosion particles spawn (pool pattern) */
    _createExplosion(x, y, color) {
        let spawned = 0;
        for (let i = 0; i < this.particlePool.length && spawned < 10; i++) {
            let p = this.particlePool[i];
            if (!p.active) {
                p.active = true; p.x = x; p.y = y;
                p.vx = (Math.random() - 0.5) * 5; p.vy = (Math.random() - 0.5) * 5;
                p.radius = Math.random() * 1.8 + 0.5; p.color = color; p.alpha = 1;
                spawned++;
            }
        }
    }

    /** Body-glow timer set करें */
    _triggerGlow(color) { this.bodyGlowTimer = 40; this.bodyGlowColor = color; }

    /** Explosion + glow एक साथ */
    _triggerBlast(color) {
        this._createExplosion(this.player.x + this.player.width / 2,
                               this.player.y + this.player.height / 2, color);
        this._triggerGlow("#fb923c");
    }

    /** Gained-glow ring spawn (pool pattern) */
    _createGainedGlow(x, y, color) {
        for (let i = 0; i < this.glowEffectPool.length; i++) {
            let g = this.glowEffectPool[i];
            if (!g.active) {
                g.active = true; g.x = x; g.y = y;
                g.radius = 4; g.maxRadius = 26; g.color = color; g.alpha = 1;
                break;
            }
        }
    }

    /** क्या player अभी tunnel के अंदर है? */
    _isPlayerInsideTunnel() {
        const buffer = 4;
        return (this.player.x >= (this.TUNNEL_X - buffer) &&
                (this.player.x + this.player.width) <= (this.TUNNEL_X + this.TUNNEL_WIDTH + buffer));
    }

    /**
     * Glow-ring विस्तार (DRY — §2.4)।
     * @param {Object}   ring    — glowRings.jyoti / .shankha / .kripa
     * @param {number}   dt
     * @param {Function} onTick  — optional (शंख-vलय के cyclone-check हेतु)
     */
    _updateGlowRing(ring, dt, onTick) {
        if (!ring.active) return;
        ring.radius += ring.speed * dt;
        if (onTick) onTick(ring);
        if (ring.radius > ring.maxRadius) { ring.active = false; ring.radius = 0; }
    }

    /** सभी glow-rings निष्क्रिय/reset करें (punahaPrarambha में प्रयुक्त) */
    _resetAllGlowRings() {
        for (let key in this.glowRings) {
            this.glowRings[key].active = false; this.glowRings[key].radius = 0;
        }
    }

    /** Alert box DOM update */
    _updateAlert(text, color) {
        if (!this._UI?.alertBox) return;
        this._UI.alertBox.innerText = text;
        this._UI.alertBox.style.color = color;
    }

    /** HUD stat update (pulse animation trigger) */
    _updateStatWithPulse(el, key, newVal, icon, suffix = "") {
        if (!el) return;
        if (this._oldStats[key] !== newVal) {
            el.textContent = `${icon} ${newVal}${suffix}`;
            this._uiScales[key] = 1.15; this._uiGlows[key] = 1.0;
            this._oldStats[key] = newVal;
        }
    }

    /** सभी HUD stats एक साथ update करें */
    _updateUIStats() {
        if (!this._UI) return;
        this._updateStatWithPulse(this._UI.naama,       'naama',       this.activeNaam,       'ॐ');
        this._updateStatWithPulse(this._UI.punya,       'punya',       this.shuvhaKarma,      '🌿');
        this._updateStatWithPulse(this._UI.paap,        'paap',        this.ashuvhaKarma,     '🥀');
        this._updateStatWithPulse(this._UI.prarabdha,   'prarabdha',   this.prarabdha,        '📜');
        this._updateStatWithPulse(this._UI.samarpita,   'samarpita',   this.samarpita,        '🙏', ` / ${CHETANA_JAGRITI_THRESHOLD}`);
        this._updateStatWithPulse(this._UI.punaraJanma, 'punaraJanma', this.punaraJanmaCount, '♻️');
        this._updateStatWithPulse(this._UI.kripa,       'kripa',       this.kripa,            '✋');
        this._updateStatWithPulse(this._UI.shankha,     'shankha',     this.shankha,          '🐚');
        this._updateStatWithPulse(this._UI.jyoti,       'jyoti',       this.jyoti,            '🪔');
        this._updateStatWithPulse(this._UI.chetana,     'chetana',     this.chetanaaJagrita ? "👁️" : "😴", "");
        this._updateStatWithPulse(this._UI.drishti,     'drishti',     this.ashuvhaKarma >= 3 ? "⚫" : "☀️", "");
        this._updateStatWithPulse(this._UI.purnaSamarpana, 'purnaSamarpana', this.purnaSamarpana ? "🙌" : "🤲", "");
    }

    /** HUD scale/glow animation एक frame advance करें */
    _updateHUDAnimations(dt) {
        const uiKeys = ['purnaSamarpana','naama','punya','paap','prarabdha','samarpita',
                         'punaraJanma','gatee','chetana','shankha','drishti','jyoti','kripa'];
        for (const key of uiKeys) {
            if (Math.abs(this._uiScales[key] - 1.0) > 0.001) {
                this._uiScales[key] += (1.0 - this._uiScales[key]) * 0.15 * dt;
                if (Math.abs(this._uiScales[key] - 1.0) < 0.01) this._uiScales[key] = 1.0;
            }
            if (this._uiGlows[key] > 0) {
                this._uiGlows[key] -= 0.025 * dt;
                if (this._uiGlows[key] < 0) this._uiGlows[key] = 0;
            }
            const el = this._UI?.[key];
            if (el) {
                const currentGlow = this._uiGlows[key] * 15;
                const newTransform = `scale(${this._uiScales[key].toFixed(4)})`;
                const newShadow = currentGlow < 0.1 ? '' : `0 0 ${currentGlow.toFixed(1)}px currentColor`;
                if (el._lastTransform !== newTransform) { el.style.transform = newTransform; el._lastTransform = newTransform; }
                if (el._lastShadow !== newShadow)   { el.style.boxShadow = newShadow; el._lastShadow = newShadow; }
            }
        }
    }

    /** Container border color (DRY: सिर्फ़ बदलने पर DOM write) */
    setContainerBorderColor(color) {
        if (this.currentBorderColor !== color && this._UI?.container) {
            this._UI.container.style.borderColor = color;
            this.currentBorderColor = color;
        }
    }
}
