/**
 * ============================================================
 * src/audio.js — मोक्ष AudioManager (ES6 Module)
 * ============================================================
 *
 * यह फ़ाइल index.html के <script> ब्लॉक से निकाला गया
 * सम्पूर्ण Web Audio API तर्क है — अब एक ES6 class में।
 *
 * ── निकाली गई चीज़ें ──────────────────────────────────────
 *  • Readiness system (checkReadiness / finalizeReadiness / showReadyState)
 *  • 28 mp3 AudioBuffer preloading (2-batch strategy)
 *  • Ambient layer management:
 *      bgMusic, shathendriya, jagritaBreath, sushuptiBreath
 *  • SFX playback (playSound, playTone, playBufferedSound)
 *  • Sidechain ducking (duckBackgroundMusic / updateDuckDecay)
 *  • Volume control (mute toggle, bgMusicVolume slider)
 *  • Breath-pulse sync (setBreathPulse)
 *
 * ── बाहरी निर्भरताएँ (injected callbacks) ─────────────────
 *  Audio.setGameStateGetter(fn)
 *      fn() → { isGameStarted, gameOver, won, isPaused,
 *                isShastraVisible, chetanaaJagrita }
 *
 *  Audio.setVibrateCallback(fn)
 *      fn(weakMagnitude, strongMagnitude, duration) → void
 *
 *  Audio.setReadinessGetters({ getFontsReady, getScaleGameDone })
 *      fonts / scale readiness को main.js से poll करने के लिए
 *
 * ── main.js में उपयोग ────────────────────────────────────
 *  import { Audio } from './src/audio.js';
 *
 *  // पेज-लोड पर एक बार:
 *  Audio.setGameStateGetter(() => ({
 *      isGameStarted, gameOver, won, isPaused,
 *      isShastraVisible, chetanaaJagrita
 *  }));
 *  Audio.setVibrateCallback(vibrateGamepad);
 *  Audio.setReadinessGetters({
 *      getFontsReady:    () => isFontsReady,
 *      getScaleGameDone: () => isScaleGameDone,
 *  });
 *  Audio.init();   // ← initAudioPreload() की जगह
 *
 *  // draw() में हर frame:
 *  Audio.setBreathPulse(worldBreathPulse);
 *  Audio.updateDuckDecay();
 *  Audio.updateAmbientVolumes();
 *
 * ============================================================
 */

// ====================== स्थिरांक (CONSTANTS) ======================

/** bgMusic.mp3 — बहुत हल्का ambient bed (सांस से असंबद्ध) */
const BG_MUSIC_MP3_LAYER_VOLUME = 0.01;

/** shathendriya — स्पष्ट, स्थिर स्तर (सांस से असंबद्ध) */
const RUNNING_HORSES_VOLUME = 0.16;

/** jagritaBreath — चेतना-जागृति के बाद सांस-सिंक layer */
const JAGRITA_BREATH_VOLUME = 0.22;

/** sushuptiBreath — चेतना-जागृति से पहले तक बजने वाला स्वप्न-श्वास */
const SUSHUPTI_BREATH_VOLUME = 1.0;

/** samarpita ध्वनि debounce — ms में (muddy sound रोकने हेतु) */
const SAMARPITA_SOUND_COOLDOWN = 90;

/**
 * सांस के साथ jagritaBreath / sushuptiBreath का उतार-चढ़ाव अनुपात।
 * 0.3 = ±30% volume modulation (breathPulse 0→1 range पर)
 */
const BG_BREATH_MOD_RANGE = 0.3;

// ── Sidechain ducking स्थिरांक ──

/** duckLevel प्रति सेकंड कितनी तेज़ी से 0 की ओर लौटे */
const DUCK_DECAY_PER_SEC = 1.8;

/** bgMusic.mp3 SFX पर अधिकतम कितना % धीमा हो (0–1) */
const BG_MUSIC_DUCK_REDUCTION = 0.75;

/** shathendriya बहुत हल्का duck हो — हमेशा स्पष्ट सुनाई दे */
const RUNNING_HORSES_DUCK_REDUCTION = 0.15;

/** jagritaBreath मध्यम रूप से duck हो */
const JAGRITA_BREATH_DUCK_REDUCTION = 0.55;

/**
 * sushuptiBreath — घोड़ों (0.15) जैसा हल्का duck।
 * (पहले 0.55 था — बार-बार माया-टकराव पर बहुत दब जाती थी)
 */
const SUSHUPTI_BREATH_DUCK_REDUCTION = 0.20;

/**
 * हर SFX की "डकिंग शक्ति" (0–1)।
 * महत्वपूर्ण ध्वनियाँ ambient को ज़्यादा धीमा करती हैं;
 * हल्के SFX कम।
 */
const DUCK_STRENGTH = {
    purnaSamarpana:    0.60,
    drishti:           0.35,
    andhakaara:        0.40,
    shuvha:            0.50,
    rikta:             0.55,
    jaapa:             0.55,
    samarpita:         0.45,
    naamaSamarpita:    0.55,
    aakarshana:        0.25,
    tyaaga:            0.25,
    punaha:            0.70,
    viraama:           0.20,
    resume:            0.15,
    takraava:          0.70,
    vijaya:            0.65,
    chetana:           0.65,
    timer:             0.30,
    prarabdhaBandhana: 0.40,
    paapaBandhana:     0.40,
    punyaBandhana:     0.40,
    bandhanaMukta:     0.35,
    naama:             0.45,
    antimCharana:      0.35,
    kripa:             0.50,
    shankhaDhwani:     0.45,
    jyotiDhwani:       0.40,
    shankhaPrapta:     0.45,
    jyotiPrapta:       0.40,
};


// ====================== AudioManager CLASS ======================

class AudioManager {

    constructor() {

        // ── Web Audio API core ──────────────────────────────
        this.audioCtx      = null;
        this.audioUnlocked = false;

        // ── Readiness tracking ──────────────────────────────
        /** क्या सभी audio load-attempts (सफल/विफल) पूरे हो गए? */
        this._isAudioPreloadDone = false;

        /** एक बार true होने पर दोबारा नहीं बदलेगा */
        this._isGameFullyReady  = false;

        /** 'high' (सब कुछ मिला) | 'low' (कुछ ऑडियो विफल) */
        this.gameReadinessMode  = null;

        /** विफल ऑडियो-फ़ाइलों के URL (Low-Mode निर्णय हेतु) */
        this.audioLoadFailures  = [];

        /** सुरक्षा-timeout handle */
        this._readinessTimeoutId = null;

        // ── 28 mp3 AudioBuffers ─────────────────────────────
        // ⚠️ key नाम index.html के audioBuffers object से 1:1 मेल खाते हैं
        this.audioBuffers = {
            // Batch-1 (critical — gameplay शुरू होते ही ज़रूरी)
            naamaSamarpita:     null,  // नाम-समर्पण
            samarpita:          null,  // समर्पण
            punarJanma:         null,  // पुनर्जन्म
            shathendriya:       null,  // दौड़ते घोड़े (ambient loop)
            sushuptiBreath:     null,  // स्वप्न-श्वास (ambient loop)
            timer:              null,  // अंतिम-चरण चेतावनी
            prarabdhaBandhana:  null,  // प्रारब्ध-बंधन
            paapaBandhana:      null,  // पाप-बंधन
            punyaBandhana:      null,  // पुण्य-बंधन
            bandhanMukta:       null,  // बंधन-मुक्ति
            naamaDhwani:        null,  // नाम संग्रह ध्वनि
            jaapaDhwani:        null,  // नाम-जाप ध्वनि
            aakarshana:         null,  // माया-खिंचाव
            tyaaga:             null,  // खिंचाव-विघटन
            kripaDhwani:        null,  // कृपा-प्राप्ति
            shankhaDhwani:      null,  // Y-press शंख
            jyotiDhwani:        null,  // B-press ज्योति
            shankhaPrapta:      null,  // शंख-संग्रह
            jyotiPrapta:        null,  // ज्योति-संग्रह
            purnaSamarpana:     null,  // पूर्ण-समर्पण
            drishti:            null,  // दृष्टि लौटी
            andhakaara:         null,  // पाप-अंधकार
            // Batch-2 (deferred — भारी / देर से ज़रूरी)
            bgMusic:            null,  // पृष्ठभूमि संगीत (~6.5MB)
            chetanaJagrita:     null,  // चेतना-जागृति
            pralaya:            null,  // प्रलय
            jagritaBreath:      null,  // अंतरिक्ष-श्वास (ambient loop)
            moksha:             null,  // मोक्ष-विजय
            antimCharana:       null,  // अंतिम-चरण
        };

        // ── Ambient layer nodes ─────────────────────────────
        /** Master gain — सिर्फ़ mute/unmute नियंत्रण-बिंदु */
        this._bgMasterGain            = null;

        /** bgMusic.mp3 source + gain */
        this._bgMusicSourceNode       = null;
        this._bgMusicMp3Gain          = null;

        /** shathendriya (घोड़े) source + gain */
        this._shathendriyaSourceNode  = null;
        this._shathendriyaGain        = null;

        /** jagritaBreath (अंतरिक्ष-श्वास) source + gain */
        this._jagritaBreathSourceNode = null;
        this._jagritaBreathGain       = null;

        /** sushuptiBreath (स्वप्न-श्वास) source + gain */
        this._sushuptiBreathSourceNode = null;
        this._sushuptiBreathGain       = null;

        // ── State flags ─────────────────────────────────────
        /** ambient graph एक बार ही init हो */
        this._bgMusicStarted = false;

        /** Mute/Unmute बटन की वर्तमान स्थिति */
        this.bgMusicMuted = false;

        /**
         * उपयोगकर्ता-नियंत्रित volume multiplier।
         * 0.0 (पूर्ण मौन) से 1.0 (पूर्ण स्तर) — slider से setMasterVolume() द्वारा सेट होता है
         */
        this.bgMusicVolume = 1.0;

        /**
         * सांस-pulse (0→1→0) — draw() में हर frame setBreathPulse() से सेट होता है।
         * jagritaBreath और sushuptiBreath इसी से volume-sync रहते हैं।
         */
        this.breathPulseGlobal = 0;

        // ── Sidechain ducking state ─────────────────────────
        /** 0 = कोई ducking नहीं, 1 = अधिकतम ducking */
        this._duckLevel = 0;

        /** आख़िरी बार duckLevel अपडेट हुआ (audioCtx.currentTime, seconds) */
        this._lastDuckCheckTime = 0;

        // ── Samarpita debounce ──────────────────────────────
        /** performance.now() timestamp — muddy sound रोकने हेतु */
        this._lastSamarpitaSoundTime = 0;

        // ── Injected callbacks ──────────────────────────────
        /**
         * () => { isGameStarted, gameOver, won, isPaused,
         *          isShastraVisible, chetanaaJagrita }
         */
        this._getGameState = null;

        /**
         * (weakMagnitude, strongMagnitude, duration) => void
         * gamepad module से inject होता है
         */
        this._vibrate = null;

        /** () => boolean — main.js में isFontsReady */
        this._getFontsReady = null;

        /** () => boolean — main.js में isScaleGameDone */
        this._getScaleGameDone = null;
    }

    // ====================== DEPENDENCY INJECTION SETTERS ======================

    /**
     * game state getter inject करें।
     * circular dependency को callback pattern से हल करता है।
     *
     * @param {Function} fn — () => { isGameStarted, gameOver, won,
     *                                 isPaused, isShastraVisible, chetanaaJagrita }
     */
    setGameStateGetter(fn) {
        this._getGameState = fn;
    }

    /**
     * gamepad haptic feedback callback inject करें।
     *
     * @param {Function} fn — (weakMagnitude, strongMagnitude, duration) => void
     */
    setVibrateCallback(fn) {
        this._vibrate = fn;
    }

    /**
     * readiness coordination getters inject करें।
     * main.js के `isFontsReady` और `isScaleGameDone` को poll करने के लिए।
     *
     * @param {{ getFontsReady: Function, getScaleGameDone: Function }} obj
     */
    setReadinessGetters({ getFontsReady, getScaleGameDone }) {
        this._getFontsReady    = getFontsReady;
        this._getScaleGameDone = getScaleGameDone;
    }


    // ====================== PUBLIC API ======================

    /**
     * पेज-लोड पर एक बार बुलाएँ (replaces initAudioPreload())।
     * AudioContext बिना user-gesture के बनता है (suspended state में),
     * decodeAudioData suspended context पर भी काम करता है।
     */
    init() {
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) {
                // Web Audio API उपलब्ध नहीं — gracefully Low Mode में जाएँ
                this._isAudioPreloadDone = true;
                this._checkReadiness();
                return;
            }
            this.audioCtx = new AC();
            // ⚡ Long-task fix: audio loading next macrotask में defer —
            // ताकि पहला interaction frame block न हो
            this._loadAllAudioBuffers().then(() => {
                this._isAudioPreloadDone = true;
                this._checkReadiness();
            });
        } catch (err) {
            console.warn('⚠️ ऑडियो-प्रीलोड प्रारंभ नहीं हो सका:', err);
            this._isAudioPreloadDone = true;
            this._checkReadiness();
        }

        // ── सुरक्षा-समय-सीमा (6s) ──
        // फ़ाइलें KB-स्तर की हैं, सामान्य/धीमे नेट पर भी यह पर्याप्त है।
        // इस सीमा के बाद भी तत्परता न हो तो ज़बरदस्ती Low-Mode में आगे बढ़ें।
        this._readinessTimeoutId = setTimeout(() => {
            console.warn('⚠️ तत्परता-समय-सीमा (6s) पार हो गई — Low Mode में आगे बढ़ रहे हैं');
            this._isAudioPreloadDone = true;
            // _finalizeReadiness() सीधे बुलाएँ — external flags (fonts/scale) की
            // प्रतीक्षा बिना, क्योंकि timeout का उद्देश्य ही यही है कि खिलाड़ी न फँसे
            this._finalizeReadiness();
        }, 6000);
    }

    /**
     * fonts / scale readiness बदलने पर main.js से बुलाएँ।
     * checkReadiness() का public entry-point।
     * (replaces checkReadiness() calls in fonts.ready and scaleGame())
     */
    notifyReadiness() {
        this._checkReadiness();
    }

    /**
     * पहले user-interaction (pointer/key/button) पर एक बार बुलाएँ।
     * AudioContext resume करता है, background music graph शुरू करता है।
     * (replaces ensureAudio())
     */
    ensureAudio() {
        try {
            if (!this.audioCtx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return;
                this.audioCtx = new AC();
                // defer loading — पहला interaction frame block न हो
                setTimeout(() => this._loadAllAudioBuffers(), 0);
            }
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
            this.audioUnlocked = true;
            this.startBackgroundMusic(); // 🔊 पहली बार audio unlock होते ही शुरू
        } catch (err) {
            console.warn('⚠️ Audio init failed:', err);
        }
    }

    /**
     * draw() में हर frame बुलाएँ।
     * jagritaBreath और sushuptiBreath की volume इसी pulse से sync रहती है।
     *
     * @param {number} val — 0.0 to 1.0 (worldBreathPulse)
     */
    setBreathPulse(val) {
        this.breathPulseGlobal = val;
    }

    /**
     * music-volume slider (input range 0–100) से बुलाएँ।
     * सभी ambient layers पर multiplier के रूप में लागू होता है।
     *
     * @param {number} sliderVal — 0 to 100
     */
    setMasterVolume(sliderVal) {
        this.bgMusicVolume = Math.max(0, Math.min(1, sliderVal / 100));
    }

    /**
     * music-toggle-btn click पर बुलाएँ।
     * Mute/Unmute toggle + आइकॉन अपडेट।
     * (replaces toggleBgMusic())
     */
    toggleBgMusic() {
        this.bgMusicMuted = !this.bgMusicMuted;
        const btn = document.getElementById('music-toggle-btn');
        if (btn) btn.textContent = this.bgMusicMuted ? '🔇' : '🔊';
        this.updateAmbientVolumes();
    }

    /**
     * SFX बजाने का मुख्य entry-point।
     * (replaces playSound())
     *
     * @param {string} name — DUCK_STRENGTH में परिभाषित SFX नाम
     */
    playSound(name) {
        // SFX से पहले ambient duck करें
        if (DUCK_STRENGTH[name] !== undefined) {
            this.duckBackgroundMusic(DUCK_STRENGTH[name]);
        }

        const buf = this.audioBuffers;
        const ctx = this.audioCtx;

        // guard — audioCtx तैयार न हो तो synth-only path safe रहे
        if (!ctx) return;

        switch (name) {

            // ── कर्म / माया ────────────────────────────────
            case 'shuvha':
                // पुण्य संग्रह — C5 से G5 त्रिकोण स्वर
                this._playTone(523.25, 0.07, 'triangle', 0.035, 783.99);
                this._vibrate?.(0.15, 0.10, 90);
                break;

            case 'rikta':
                // अशुभ-अवरुद्ध UI feedback — कर्कश sawtooth
                this._playTone(155.56, 0.10, 'sawtooth', 0.03, 92.5);
                this._vibrate?.(0.50, 0.70, 160);
                break;

            case 'ashuvha':
                // पाप-प्रहार — गहरा square wave
                this._playTone(100, 0.2, 'square', 0.015, 140);
                this._vibrate?.(0.30, 0.20, 80);
                break;

            // ── नाम-जाप ────────────────────────────────────
            case 'jaapa':
                // SPACE/RT — नाम-जाप आरंभ
                buf.jaapaDhwani
                    ? this._playBufferedSound(buf.jaapaDhwani, ctx.destination, 0.6)
                    : this._playTone(880, 0.09, 'sine', 0.03, 1320);
                this._vibrate?.(0.10, 0.05, 50);
                break;

            case 'naamaSamarpita':
                // W/↑/RB — नाम समर्पण
                buf.naamaSamarpita
                    ? this._playBufferedSound(buf.naamaSamarpita, ctx.destination, 0.6)
                    : this._playTone(880, 0.09, 'sine', 0.03, 1320);
                this._vibrate?.(0.10, 0.05, 50);
                break;

            case 'purnaSamarpana':
                // अंतिम चरण में समस्त नाम-समर्पण (एक बार/जीवन-चक्र)
                buf.purnaSamarpana
                    ? this._playBufferedSound(buf.purnaSamarpana, ctx.destination, 0.65)
                    : this._playTone(987.77, 0.14, 'sine', 0.04, 1567.98);
                this._vibrate?.(0.20, 0.25, 130);
                break;

            // ── दृष्टि / अंधकार ────────────────────────────
            case 'drishti':
                // पाप-अंधकार (ashuvhaKarma≥3) से बाहर आने पर
                buf.drishti
                    ? this._playBufferedSound(buf.drishti, ctx.destination, 0.55)
                    : this._playTone(880, 0.10, 'sine', 0.03, 1318.51);
                this._vibrate?.(0.10, 0.08, 60);
                break;

            case 'andhakaara':
                // पाप-अंधकार छाया — ashuvhaKarma≥3 होने पर
                buf.andhakaara
                    ? this._playBufferedSound(buf.andhakaara, ctx.destination, 0.55)
                    : this._playTone(196.00, 0.12, 'sawtooth', 0.03, 130.81);
                this._vibrate?.(0.18, 0.12, 90);
                break;

            // ── शंख / ज्योति ────────────────────────────────
            case 'shankhaDhwani':
                // Y-press पर शंख-वलय आरंभ
                buf.shankhaDhwani
                    ? this._playBufferedSound(buf.shankhaDhwani, ctx.destination, 0.65)
                    : this._playTone(523.25, 0.12, 'sine', 0.04, 783.99);
                this._vibrate?.(0.20, 0.25, 120);
                break;

            case 'shankhaPrapta':
                // शंख-माया संग्रह (shankhaDhwani से अलग)
                buf.shankhaPrapta
                    ? this._playBufferedSound(buf.shankhaPrapta, ctx.destination, 0.6)
                    : this._playTone(700, 0.10, 'sine', 0.035, 1000);
                this._vibrate?.(0.12, 0.10, 70);
                break;

            case 'jyotiDhwani':
                // B-press पर ज्योति-वलय आरंभ
                buf.jyotiDhwani
                    ? this._playBufferedSound(buf.jyotiDhwani, ctx.destination, 0.60)
                    : this._playTone(659.25, 0.12, 'triangle', 0.04, 987.77);
                this._vibrate?.(0.15, 0.18, 100);
                break;

            case 'jyotiPrapta':
                // ज्योति-माया संग्रह (jyotiDhwani से अलग)
                buf.jyotiPrapta
                    ? this._playBufferedSound(buf.jyotiPrapta, ctx.destination, 0.6)
                    : this._playTone(740, 0.10, 'triangle', 0.035, 1050);
                this._vibrate?.(0.12, 0.10, 70);
                break;

            // ── कृपा ────────────────────────────────────────
            case 'kripa':
                // दिव्य कृपा-प्राप्ति — C6 से E6 सौम्य sine
                buf.kripaDhwani
                    ? this._playBufferedSound(buf.kripaDhwani, ctx.destination, 0.6)
                    : this._playTone(1046.50, 0.15, 'sine', 0.04, 1318.51);
                this._vibrate?.(0.15, 0.20, 80);
                break;

            // ── अंतिम-चरण (envelope-controlled) ────────────
            case 'antimCharana':
                // 🔧 TUNED: gain 0.65→0.35, सहज fade-in/fade-out —
                // envelope बिना अचानक शुरू/खत्म होने से click/pop आता था
                if (buf.antimCharana) {
                    const acNow  = ctx.currentTime;
                    const acSrc  = ctx.createBufferSource();
                    acSrc.buffer = buf.antimCharana;
                    const acGain = ctx.createGain();
                    const acPeak = 0.35;
                    const acDur  = acSrc.buffer.duration;

                    acGain.gain.setValueAtTime(0.0001, acNow);
                    acGain.gain.exponentialRampToValueAtTime(acPeak, acNow + 0.08); // fade-in 80ms

                    // peak-hold: buffer duration से 150ms पहले तक
                    const holdTime = Math.max(acNow + 0.08, acNow + acDur - 0.15);
                    acGain.gain.setValueAtTime(acPeak, holdTime);

                    // 🌿 guard: fade-out hold से कम-से-कम 20ms आगे —
                    // कितनी भी छोटी file हो, RangeError नहीं आएगा
                    const fadeOutTime = Math.max(holdTime + 0.02, acNow + acDur - 0.02);
                    acGain.gain.exponentialRampToValueAtTime(0.0001, fadeOutTime);

                    acSrc.connect(acGain);
                    acGain.connect(ctx.destination);
                    acSrc.start(acNow);
                } else {
                    console.warn('⚠️ antimaCharana.mp3 लोड नहीं हुई — ./audio/antimaCharana.mp3 path जाँचें');
                }
                this._vibrate?.(0.25, 0.30, 140);
                break;

            // ── समर्पित (debounced) ──────────────────────────
            case 'samarpita': {
                // तेज़ माया-टकराव पर muddy sound से बचाव हेतु debounce
                const nowMs = performance.now();
                if (nowMs - this._lastSamarpitaSoundTime >= SAMARPITA_SOUND_COOLDOWN) {
                    this._lastSamarpitaSoundTime = nowMs;
                    if (buf.samarpita) {
                        this._playBufferedSound(buf.samarpita, ctx.destination, 0.6);
                    } else {
                        this._playTone(659.25, 0.12, 'triangle', 0.04, 987.77);
                        setTimeout(() => this._playTone(987.77, 0.08, 'sine', 0.025, 1318.51), 55);
                    }
                }
                this._vibrate?.(0.20, 0.15, 100);
                break;
            }

            // ── आकर्षण / त्याग ──────────────────────────────
            case 'aakarshana':
                // माया-खिंचाव (pull) आरंभ
                buf.aakarshana
                    ? this._playBufferedSound(buf.aakarshana, ctx.destination, 0.5)
                    : this._playTone(440, 0.07, 'sine', 0.025, 660);
                this._vibrate?.(0.08, 0.05, 40);
                break;

            case 'tyaaga':
                // खिंचाव-बल विघटित
                buf.tyaaga
                    ? this._playBufferedSound(buf.tyaaga, ctx.destination, 0.5)
                    : this._playTone(392, 0.08, 'square', 0.025, 329.63);
                this._vibrate?.(0.10, 0.06, 60);
                break;

            // ── पुनर्जन्म / प्रलय / मोक्ष ──────────────────
            case 'punaha':
                // पुनर्जन्म screen — punaraJanma.mp3 या synth fallback
                if (buf.punarJanma) {
                    this._playBufferedSound(buf.punarJanma, ctx.destination, 0.7);
                } else {
                    this._playTone(329.63, 0.06, 'triangle', 0.025, 523.25);
                    setTimeout(() => this._playTone(659.25, 0.07, 'triangle', 0.025, 987.77), 60);
                }
                this._vibrate?.(0.60, 0.85, 280);
                break;

            case 'takraava':
                // प्रलय (FORCE STOPPED) — pralaya.mp3 या synth fallback
                buf.pralaya
                    ? this._playBufferedSound(buf.pralaya, ctx.destination, 0.7)
                    : this._playTone(110, 0.08, 'square', 0.03, 82.41);
                this._vibrate?.(0.60, 0.90, 220);
                break;

            case 'vijaya':
                // मोक्ष-विजय — moksha.mp3 या तीन-स्वर synth राग
                if (buf.moksha) {
                    this._playBufferedSound(buf.moksha, ctx.destination, 0.7);
                } else {
                    this._playTone(523.25, 0.12, 'sine', 0.03, 783.99);
                    setTimeout(() => this._playTone(659.25, 0.12, 'sine', 0.03, 987.77), 70);
                    setTimeout(() => this._playTone(783.99, 0.14, 'sine', 0.03, 1174.66), 140);
                }
                // तीन चरणों में बढ़ता haptic — उत्सव का अहसास
                this._vibrate?.(0.3, 0.3, 150);
                setTimeout(() => this._vibrate?.(0.3, 0.3, 150), 200);
                setTimeout(() => this._vibrate?.(0.4, 0.5, 300), 400);
                break;

            // ── चेतना-जागृति (fade-in envelope) ────────────
            case 'chetana':
                // समर्पित≥50 पर एक बार — पूरी buffer-duration तक प्राकृतिक रूप से बजे
                if (buf.chetanaJagrita) {
                    const cNow  = ctx.currentTime;
                    const cSrc  = ctx.createBufferSource();
                    cSrc.buffer = buf.chetanaJagrita;
                    const cGain = ctx.createGain();
                    cGain.gain.setValueAtTime(0.0001, cNow);
                    cGain.gain.exponentialRampToValueAtTime(0.7, cNow + 0.05); // हल्का fade-in
                    cSrc.connect(cGain);
                    cGain.connect(ctx.destination);
                    cSrc.start(cNow);
                    // premature stop() नहीं — पूरी duration तक बजे (शास्त्र-संगत)
                } else {
                    console.warn('⚠️ chetanaJagrita.mp3 लोड नहीं हुई — ./audio/chetanaJagrita.mp3 path जाँचें');
                }
                break;

            // ── अंतिम-समय चेतावनी ───────────────────────────
            case 'timer':
                // samaya<100 पर एक बार बजे
                if (buf.timer) {
                    this._playBufferedSound(buf.timer, ctx.destination, 0.6);
                }
                break;

            // ── कर्म-बंधन / मुक्ति ──────────────────────────
            case 'prarabdhaBandhana':
                if (buf.prarabdhaBandhana) {
                    this._playBufferedSound(buf.prarabdhaBandhana, ctx.destination, 0.6);
                }
                break;

            case 'paapaBandhana':
                if (buf.paapaBandhana) {
                    this._playBufferedSound(buf.paapaBandhana, ctx.destination, 0.6);
                }
                break;

            case 'punyaBandhana':
                if (buf.punyaBandhana) {
                    this._playBufferedSound(buf.punyaBandhana, ctx.destination, 0.6);
                }
                break;

            case 'bandhanaMukta':
                // कर्म शून्य पर वापस — मुक्ति-ध्वनि
                if (buf.bandhanMukta) {
                    this._playBufferedSound(buf.bandhanMukta, ctx.destination, 0.6);
                }
                break;

            // ── नाम-ध्वनि (collection — जाप से अलग) ────────
            case 'naama':
                // माया-टकराव से नाम-संग्रह (SPACE की jaapa-ध्वनि से भिन्न)
                buf.naamaDhwani
                    ? this._playBufferedSound(buf.naamaDhwani, ctx.destination, 0.6)
                    : this._playTone(880, 0.09, 'sine', 0.03, 1320);
                this._vibrate?.(0.10, 0.05, 50);
                break;

            // ── स्तम्भन / जारी ───────────────────────────────
            case 'viraama':
                // F/START — पॉज़
                this._playTone(220, 0.05, 'sine', 0.02, 196);
                break;

            case 'resume':
                // पॉज़ से जारी
                this._playTone(196, 0.05, 'sine', 0.02, 220);
                break;

            default:
                // अज्ञात SFX — silently ignore (future-proofing)
                break;
        }
    }

    /**
     * SFX की "डकिंग शक्ति" से duckLevel बढ़ाएँ।
     * अधिकतम मान रखते हैं — कई SFX एक साथ बजें तो ओवरलैप सही रहे।
     * (replaces duckBackgroundMusic())
     *
     * @param {number} strength — 0.0 to 1.0
     */
    duckBackgroundMusic(strength) {
        if (strength > this._duckLevel) this._duckLevel = strength;
    }

    /**
     * हर frame draw() में बुलाएँ।
     * duckLevel को असली audioCtx time के अनुसार सहजता से घटाता है।
     * pause के दौरान भी सही गति से recover होगा (frameNow/dt पर निर्भर नहीं)।
     * (replaces updateDuckDecay())
     */
    updateDuckDecay() {
        if (!this.audioCtx) return;
        const now = this.audioCtx.currentTime;
        if (this._lastDuckCheckTime === 0) { this._lastDuckCheckTime = now; return; }
        const elapsed = now - this._lastDuckCheckTime;
        this._lastDuckCheckTime = now;
        if (this._duckLevel > 0) {
            this._duckLevel -= DUCK_DECAY_PER_SEC * elapsed;
            if (this._duckLevel < 0) this._duckLevel = 0;
        }
    }

    /**
     * हर frame draw() में बुलाएँ (updateDuckDecay के बाद)।
     * सभी ambient layers की volume compute करके Web Audio param पर set करता है।
     * duck decay + breath-sync + gameplay gating + mute + user-volume — सब यहाँ।
     * (replaces updateAmbientVolumes())
     */
    updateAmbientVolumes() {
        if (!this._bgMasterGain) return;

        // ── Master mute — एक ही द्वार से सभी layers ──
        this._bgMasterGain.gain.value = this.bgMusicMuted ? 0 : 1;
        if (this.bgMusicMuted) return; // मौन होने पर आगे compute करना ज़रूरी नहीं

        const dl  = this._duckLevel;
        const vol = this.bgMusicVolume;
        const bp  = this.breathPulseGlobal;
        const ctx = this.audioCtx;

        // प्रत्येक layer की duck-गुणक (परत के अनुसार अलग तीव्रता)
        const bgMusicDuckMul      = 1 - (dl * BG_MUSIC_DUCK_REDUCTION);
        const shathendriyaDuckMul = 1 - (dl * RUNNING_HORSES_DUCK_REDUCTION);
        const jagritaDuckMul      = 1 - (dl * JAGRITA_BREATH_DUCK_REDUCTION);
        const sushuptiDuckMul     = 1 - (dl * SUSHUPTI_BREATH_DUCK_REDUCTION);

        // ⚡ DRY: isActiveGameplay() एक ही बार compute — तीनों gameplay-gated layers में प्रयोग
        const active = this._isActiveGameplay();

        // ── bgMusic — स्थिर वॉल्यूम, सांस से असंबद्ध ──
        // 🛠️ बग-फिक्स: bgMusicVolume पहले set होता था पर read नहीं → slider असर-हीन था
        if (this._bgMusicMp3Gain) {
            this._bgMusicMp3Gain.gain.value = BG_MUSIC_MP3_LAYER_VOLUME * bgMusicDuckMul * vol;
        }

        // ── shathendriya — gameplay-gated, सांस से असंबद्ध ──
        // 🛠️ बग-फिक्स: पहले start-screen पर भी, pause में भी बजती थी।
        // setTargetAtTime से सहज fade-in/out (क्लिक/पॉप नहीं)
        if (this._shathendriyaGain) {
            const target = RUNNING_HORSES_VOLUME * shathendriyaDuckMul * vol * (active ? 1 : 0);
            this._shathendriyaGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
        }

        // ── jagritaBreath — gameplay-gated, सांस-सिंक ──
        // 🛠️ बग-फिक्स: पहले pause/shastra/pralaya/moksha में भी बजती थी
        if (this._jagritaBreathGain) {
            const breathVol = JAGRITA_BREATH_VOLUME *
                (1 - BG_BREATH_MOD_RANGE + bp * BG_BREATH_MOD_RANGE);
            const target = breathVol * jagritaDuckMul * vol * (active ? 1 : 0);
            this._jagritaBreathGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
        }

        // ── sushuptiBreath — gameplay-gated, सांस-सिंक (pre-chetanaaJagrita) ──
        // 🛠️ बग-फिक्स: shathendriya जैसा gameplay-gating — pause/shastra पर मौन
        if (this._sushuptiBreathGain) {
            const dreamVol = SUSHUPTI_BREATH_VOLUME *
                (1 - BG_BREATH_MOD_RANGE + bp * BG_BREATH_MOD_RANGE);
            const target = dreamVol * sushuptiDuckMul * vol * (active ? 1 : 0);
            this._sushuptiBreathGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
        }
    }

    /**
     * पूरे ambient graph को एक बार initialize करता है।
     * पहले ensureAudio() → startBackgroundMusic() chain में बुलाया जाता है।
     * (replaces startBackgroundMusic())
     */
    startBackgroundMusic() {
        if (this._bgMusicStarted || !this.audioCtx) return;
        this._bgMusicStarted = true;

        // bgMasterGain अब सिर्फ़ mute/unmute का "मुख्य द्वार" (1=बजे, 0=मौन)।
        // हर layer अपनी volume खुद संभालती है — विरासत में breath-sync नहीं मिलता।
        this._bgMasterGain = this.audioCtx.createGain();
        this._bgMasterGain.gain.setValueAtTime(this.bgMusicMuted ? 0 : 1, this.audioCtx.currentTime);
        this._bgMasterGain.connect(this.audioCtx.destination);

        this._startBgMusicMp3Layer();    // bgMusic.mp3 — हल्का ambient bed
        this._startRunningHorsesLayer(); // shathendriya — स्पष्ट, स्थिर स्तर
        // sushuptiBreath — चेतना-जागृति से पहले तक
        const state = this._getGameState?.();
        if (!state?.chetanaaJagrita) {
            this._startSushuptiBreathLayer();
        }
    }

    /**
     * chetanaaJagrita true होने पर एक बार बुलाएँ।
     * sushuptiBreath बंद → jagritaBreath शुरू।
     * (update() में chetanaaJagrita flip detect होने पर call करें)
     */
    onChetanaaJagrita() {
        this.stopSushuptiBreathLayer();
        this._startJagritaBreathLayer();
    }

    /**
     * punahaPrarambha() में बुलाएँ — jagritaBreath बंद करें।
     * अगले जीवन में chetanaaJagrita होने पर दोबारा शुरू होगी।
     * (replaces stopJagritaBreathLayer())
     */
    stopJagritaBreathLayer() {
        if (this._jagritaBreathSourceNode) {
            try { this._jagritaBreathSourceNode.stop(); } catch (_) { /* already stopped */ }
            this._jagritaBreathSourceNode.disconnect();
            this._jagritaBreathSourceNode = null;
        }
        // gain node को भी null करें ताकि updateAmbientVolumes में गलत node access न हो
        this._jagritaBreathGain = null;
    }

    /**
     * punahaPrarambha() में बुलाएँ — नए जीवन-चक्र के लिए sushuptiBreath फिर शुरू।
     * (replaces startSushuptiBreathLayer() public call in punahaPrarambha)
     */
    startSushuptiBreathLayer() {
        this._startSushuptiBreathLayer();
    }

    /**
     * onChetanaaJagrita() से internally बुलाया जाता है।
     * Public भी रखा है ताकि edge-case में main.js manually बुला सके।
     * (replaces stopSushuptiBreathLayer())
     */
    stopSushuptiBreathLayer() {
        if (this._sushuptiBreathSourceNode) {
            try { this._sushuptiBreathSourceNode.stop(); } catch (_) { /* already stopped */ }
            this._sushuptiBreathSourceNode.disconnect();
            this._sushuptiBreathSourceNode = null;
        }
        this._sushuptiBreathGain = null;
    }


    // ====================== PRIVATE METHODS ======================

    // ── Gameplay state check ────────────────────────────────

    /**
     * क्या अभी असली, सक्रिय गेमप्ले चल रहा है?
     * (start-screen / pause / शास्त्र / end-screen में false)
     * ambient layers इसी से gameplay-gated हैं।
     *
     * @returns {boolean}
     */
    _isActiveGameplay() {
        const s = this._getGameState?.();
        if (!s) return false;
        return s.isGameStarted && !s.gameOver && !s.won && !s.isPaused && !s.isShastraVisible;
    }

    // ── Synth / buffer playback ─────────────────────────────

    /**
     * Synth oscillator tone — mp3 buffer उपलब्ध न हो तो fallback।
     *
     * @param {number}  freq     — Hz (मूल आवृत्ति)
     * @param {number}  duration — seconds
     * @param {string}  type     — OscillatorType ('sine'|'triangle'|'sawtooth'|'square')
     * @param {number}  gain     — peak amplitude (0–1)
     * @param {number|null} endFreq — glide target Hz (null = कोई glide नहीं)
     */
    _playTone(freq, duration = 0.08, type = 'sine', gain = 0.04, endFreq = null) {
        if (!this.audioUnlocked || !this.audioCtx) return;
        const ctx = this.audioCtx;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const amp = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (endFreq !== null) {
            // exponentialRamp को 0/negative से बचाएँ
            osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + duration);
        }

        // smooth attack-release envelope (click/pop रोकने के लिए)
        amp.gain.setValueAtTime(0.0001, now);
        amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
        amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(amp);
        amp.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration + 0.03); // trailing silence के लिए +30ms
    }

    /**
     * किसी AudioBuffer को एक बार (या loop में) बजाएँ।
     * source + gainNode दोनों return करता है (caller ज़रूरत पड़ने पर stop कर सके)।
     *
     * @param {AudioBuffer}        buffer      — decode किया हुआ buffer
     * @param {AudioNode}          destination — connect target (usually ctx.destination)
     * @param {number}             gainVal     — playback gain (0–1)
     * @param {boolean}            loop        — क्या loop में बजाएँ?
     * @returns {{ source: AudioBufferSourceNode, gainNode: GainNode } | null}
     */
    _playBufferedSound(buffer, destination, gainVal = 0.6, loop = false) {
        if (!this.audioCtx || !buffer) return null;
        const ctx      = this.audioCtx;
        const source   = ctx.createBufferSource();
        source.buffer  = buffer;
        source.loop    = loop;

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(gainVal, ctx.currentTime);

        source.connect(gainNode);
        gainNode.connect(destination || ctx.destination);
        source.start(0);
        return { source, gainNode };
    }

    // ── Readiness (private) ─────────────────────────────────

    /**
     * जब भी कोई readiness शर्त पूरी हो, यह जाँचता है कि बाकी सब भी तैयार हैं या नहीं।
     * सभी तीन (fonts + audio + scale) ready होने पर _finalizeReadiness() बुलाता है।
     */
    _checkReadiness() {
        if (this._isGameFullyReady) return; // एक बार निर्णय — दोबारा नहीं
        const fontsReady = this._getFontsReady?.()    ?? true; // getter न हो तो assume ready
        const scaleReady = this._getScaleGameDone?.() ?? true;
        if (!fontsReady || !this._isAudioPreloadDone || !scaleReady) return;
        this._finalizeReadiness();
    }

    /**
     * अंतिम निर्णय — High या Low mode तय करता है।
     * ओवरले fade-out, footer-बैज अपडेट, start-btn सक्रिय।
     */
    _finalizeReadiness() {
        if (this._isGameFullyReady) return;
        this._isGameFullyReady = true;

        this.gameReadinessMode = (this.audioLoadFailures.length === 0) ? 'high' : 'low';
        if (this.audioLoadFailures.length > 0) {
            console.warn('🟡 Low Mode — निम्न ऑडियो-फ़ाइलें लोड नहीं हो सकीं:', this.audioLoadFailures);
        }

        // timeout cancel करें (पहले ही ready हो गए)
        if (this._readinessTimeoutId) {
            clearTimeout(this._readinessTimeoutId);
            this._readinessTimeoutId = null;
        }

        this._showReadyState();
    }

    /**
     * DOM को readiness state के अनुसार अपडेट करता है।
     * loading-overlay fade-out, mode-badge सेट, start-btn enable।
     */
    _showReadyState() {
        const overlay  = document.getElementById('loading-overlay');
        const badge    = document.getElementById('mode-badge');
        const startBtn = document.getElementById('start-btn');

        if (badge) {
            if (this.gameReadinessMode === 'high') {
                badge.textContent = '🟢 उच्च मोड';
                badge.title = 'सभी संसाधन सफलतापूर्वक लोड हुए — पूर्ण अनुभव सक्रिय';
            } else {
                badge.textContent = '🟡 निम्न मोड';
                badge.title = 'कुछ ध्वनि-संसाधन लोड नहीं हो सके (धीमा नेट/पुराना डिवाइस) ' +
                              '— मूल अनुभव सक्रिय, खेल पूर्णतः खेलने-योग्य है';
            }
        }

        if (overlay) {
            overlay.style.opacity      = '0';
            overlay.style.pointerEvents = 'none';
            // CSS transition (0.5s) पूर्ण होने के बाद display:none
            setTimeout(() => { overlay.style.display = 'none'; }, 520);
        }

        if (startBtn) startBtn.disabled = false;
    }

    // ── Buffer loading (private) ────────────────────────────

    /**
     * दोनों batches को parallel में load करता है।
     * await Promise.all ताकि isAudioPreloadDone दोनों के बाद ही set हो।
     */
    async _loadAllAudioBuffers() {
        if (!this.audioCtx) return;
        await Promise.all([
            this._loadCriticalAudioBuffers(),
            this._loadDeferredAudioBuffers(),
        ]);
    }

    /**
     * बैच 1 — छोटी, gameplay शुरू होते ही ज़रूरी फ़ाइलें (22 files)।
     * (माया-टकराव, नाम-जाप, समर्पण, घोड़े, स्वप्न-श्वास, कर्म-बंधन ध्वनियाँ)
     */
    async _loadCriticalAudioBuffers() {
        const [
            naamaSamarpita, samarpita, punarJanma,   shathendriya,
            sushuptiBreath, timer,     prarabdhaBandhana, paapaBandhana,
            punyaBandhana,  bandhanMukta, naama,     jaapa,
            aakarshana,     tyaaga,    kripa,         shankhaDhwani,
            jyotiDhwani,    shankhaPrapta, jyotiPrapta, purnaSamarpana,
            drishti,        andhakaara,
        ] = await Promise.all([
            this._loadAudioBuffer('./audio/naamaSamarpita.mp3'),
            this._loadAudioBuffer('./audio/samarpita.mp3'),
            this._loadAudioBuffer('./audio/punaraJanma.mp3'),
            this._loadAudioBuffer('./audio/shathendriya.mp3'),
            this._loadAudioBuffer('./audio/sushuptiSwaansa.mp3'),
            this._loadAudioBuffer('./audio/timer.mp3'),
            this._loadAudioBuffer('./audio/prarabdhaBandhana.mp3'),
            this._loadAudioBuffer('./audio/paapaBandhana.mp3'),
            this._loadAudioBuffer('./audio/punyaBandhana.mp3'),
            this._loadAudioBuffer('./audio/bandhanaMukta.mp3'),
            this._loadAudioBuffer('./audio/naamaDhwani.mp3'),
            this._loadAudioBuffer('./audio/jaapaDhwani.mp3'),
            this._loadAudioBuffer('./audio/aakarshana.mp3'),
            this._loadAudioBuffer('./audio/tyaaga.mp3'),
            this._loadAudioBuffer('./audio/kripaDhwani.mp3'),
            this._loadAudioBuffer('./audio/shankhaDhwani.mp3'),
            this._loadAudioBuffer('./audio/jyotiDhwani.mp3'),
            this._loadAudioBuffer('./audio/shankhaPrapta.mp3'),
            this._loadAudioBuffer('./audio/jyotiPrapta.mp3'),
            this._loadAudioBuffer('./audio/purnaSamarpana.mp3'),
            this._loadAudioBuffer('./audio/drishti.mp3'),
            this._loadAudioBuffer('./audio/andhakaara.mp3'),
        ]);

        // audioBuffers object में assign करें (key names index.html से 1:1 match)
        Object.assign(this.audioBuffers, {
            naamaSamarpita,
            samarpita,
            punarJanma,          // (पुरानी key थी punarJanma)
            shathendriya,
            sushuptiBreath,
            timer,
            prarabdhaBandhana,
            paapaBandhana,
            punyaBandhana,
            bandhanMukta,
            naamaDhwani:    naama,
            jaapaDhwani:    jaapa,
            aakarshana,
            tyaaga,
            kripaDhwani:    kripa,
            shankhaDhwani,
            jyotiDhwani,
            shankhaPrapta,
            jyotiPrapta,
            purnaSamarpana,
            drishti,
            andhakaara,
        });

        // ── Late-loading fix ──
        // यदि bgMusicGraph पहले से चल रहा है (देर से बने AudioContext की स्थिति में)
        // तो ये layers अभी जोड़ें — startBackgroundMusic() में याद नहीं आई थीं
        if (this._bgMusicStarted) {
            this._startRunningHorsesLayer();
            const state = this._getGameState?.();
            if (!state?.chetanaaJagrita) {
                this._startSushuptiBreathLayer();
            }
        }
    }

    /**
     * बैच 2 — भारी (bgMusic ~6.5MB) और देर से ज़रूरी फ़ाइलें (6 files)।
     * बैच 1 से अलग रखा गया ताकि शुरुआती SFX bgMusic के पीछे network-queue में न अटकें।
     */
    async _loadDeferredAudioBuffers() {
        const [bg, chetana, pralaya, jagritaBreath, moksha, antimCharana] = await Promise.all([
            this._loadAudioBuffer('./audio/bgMusic.mp3'),
            this._loadAudioBuffer('./audio/chetanaJagrita.mp3'),
            this._loadAudioBuffer('./audio/pralaya.mp3'),
            this._loadAudioBuffer('./audio/jagritaBreath.mp3'),
            this._loadAudioBuffer('./audio/moksha.mp3'),
            this._loadAudioBuffer('./audio/antimaCharana.mp3'),
        ]);

        Object.assign(this.audioBuffers, {
            bgMusic:        bg,
            chetanaJagrita: chetana,
            pralaya,
            jagritaBreath,
            moksha,
            antimCharana,
        });

        // ── Late-loading fix ──
        // यदि bgMusicGraph पहले से चल रहा है तो bgMusic-layer अभी जोड़ें
        if (this._bgMusicStarted) {
            this._startBgMusicMp3Layer();
        }
    }

    /**
     * एक mp3 URL को fetch → arrayBuffer → decodeAudioData → AudioBuffer।
     * किसी भी error पर null return (graceful fallback — synth-tone काम करता रहेगा)।
     *
     * @param   {string}       url — ./audio/filename.mp3
     * @returns {Promise<AudioBuffer|null>}
     */
    async _loadAudioBuffer(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            return await this.audioCtx.decodeAudioData(arrayBuffer);
        } catch (err) {
            console.warn(`⚠️ ऑडियो लोड विफल (${url}):`, err);
            this.audioLoadFailures.push(url); // Low-Mode बैज हेतु track
            return null;                       // fallback synth-tone काम करेगा
        }
    }

    // ── Ambient layer starters (private) ───────────────────

    /**
     * bgMusic.mp3 को एक हल्के, लूपिंग layer के रूप में शुरू करता है।
     * bgMasterGain से जुड़ने के कारण mute-toggle से प्रभावित होगा।
     */
    _startBgMusicMp3Layer() {
        // guard: पहले से चल रहा हो, या buffer अभी तैयार न हो
        if (!this._bgMasterGain || !this.audioBuffers.bgMusic || this._bgMusicSourceNode) return;

        const now = this.audioCtx.currentTime;
        this._bgMusicMp3Gain = this.audioCtx.createGain();
        this._bgMusicMp3Gain.gain.setValueAtTime(BG_MUSIC_MP3_LAYER_VOLUME, now);
        this._bgMusicMp3Gain.connect(this._bgMasterGain);

        this._bgMusicSourceNode = this.audioCtx.createBufferSource();
        this._bgMusicSourceNode.buffer = this.audioBuffers.bgMusic;
        this._bgMusicSourceNode.loop   = true;
        this._bgMusicSourceNode.connect(this._bgMusicMp3Gain);
        this._bgMusicSourceNode.start(now);
    }

    /**
     * shathendriya (दौड़ते घोड़े) ambient layer शुरू करता है।
     * isActiveGameplay() से gameplay-gated — start-screen पर silent।
     */
    _startRunningHorsesLayer() {
        if (!this._bgMasterGain || !this.audioBuffers.shathendriya || this._shathendriyaSourceNode) return;

        const now = this.audioCtx.currentTime;
        this._shathendriyaGain = this.audioCtx.createGain();

        // 🛠️ बग-फिक्स: volume RUNNING_HORSES_VOLUME पर सीधे न रखें —
        // अगर game अभी active नहीं है (start-screen पर ensureAudio से आए हों)
        // तो शुरुआती gain 0 रखें
        const initVol = this._isActiveGameplay() ? RUNNING_HORSES_VOLUME : 0;
        this._shathendriyaGain.gain.setValueAtTime(initVol, now);
        this._shathendriyaGain.connect(this._bgMasterGain);

        this._shathendriyaSourceNode = this.audioCtx.createBufferSource();
        this._shathendriyaSourceNode.buffer = this.audioBuffers.shathendriya;
        this._shathendriyaSourceNode.loop   = true;
        this._shathendriyaSourceNode.connect(this._shathendriyaGain);
        this._shathendriyaSourceNode.start(now);
    }

    /**
     * jagritaBreath (अंतरिक्ष-श्वास) layer शुरू करता है।
     * चेतना-जागृति (chetanaaJagrita = true) होने पर एक बार बुलाया जाता है।
     * gameplay-gated + सांस-सिंक — updateAmbientVolumes() में संभाला।
     */
    _startJagritaBreathLayer() {
        if (!this._bgMasterGain || !this.audioBuffers.jagritaBreath || this._jagritaBreathSourceNode) return;

        const now = this.audioCtx.currentTime;
        this._jagritaBreathGain = this.audioCtx.createGain();

        // 🛠️ बग-फिक्स: node बनने के तुरंत बाद isActiveGameplay() check —
        // ताकि pause/shastra के दौरान node बनते ही पूर्ण-स्तर gain न मिले
        const initVol = this._isActiveGameplay() ? JAGRITA_BREATH_VOLUME : 0;
        this._jagritaBreathGain.gain.setValueAtTime(initVol, now);
        this._jagritaBreathGain.connect(this._bgMasterGain);

        this._jagritaBreathSourceNode = this.audioCtx.createBufferSource();
        this._jagritaBreathSourceNode.buffer = this.audioBuffers.jagritaBreath;
        this._jagritaBreathSourceNode.loop   = true;
        this._jagritaBreathSourceNode.connect(this._jagritaBreathGain);
        this._jagritaBreathSourceNode.start(now);
    }

    /**
     * sushuptiBreath (स्वप्न-श्वास) layer शुरू करता है।
     * खेल आरंभ से चेतना-जागृति तक बजता है।
     * gameplay-gated + सांस-सिंक — updateAmbientVolumes() में संभाला।
     */
    _startSushuptiBreathLayer() {
        if (!this._bgMasterGain || !this.audioBuffers.sushuptiBreath || this._sushuptiBreathSourceNode) return;

        const now = this.audioCtx.currentTime;
        this._sushuptiBreathGain = this.audioCtx.createGain();

        // 🛠️ बग-फिक्स: shathendriya जैसा pattern (DRY) — node बनने के तुरंत बाद
        // isActiveGameplay() check, ताकि start-screen पर pointerdown से
        // ensureAudio() चलने पर sushuptiBreath सुनाई न दे
        const initVol = this._isActiveGameplay() ? SUSHUPTI_BREATH_VOLUME : 0;
        this._sushuptiBreathGain.gain.setValueAtTime(initVol, now);
        this._sushuptiBreathGain.connect(this._bgMasterGain);

        this._sushuptiBreathSourceNode = this.audioCtx.createBufferSource();
        this._sushuptiBreathSourceNode.buffer = this.audioBuffers.sushuptiBreath;
        this._sushuptiBreathSourceNode.loop   = true;
        this._sushuptiBreathSourceNode.connect(this._sushuptiBreathGain);
        this._sushuptiBreathSourceNode.start(now);
    }
}


// ====================== Singleton Export ======================
/**
 * पूरे game में एक ही AudioManager instance प्रयोग करें।
 *
 * import { Audio } from './src/audio.js';
 * Audio.setGameStateGetter(...);
 * Audio.init();
 */
const Audio = new AudioManager();

export { Audio };