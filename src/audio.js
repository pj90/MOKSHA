// =============================================================================
// audio.js — मोक्ष AudioManager
// सभी ध्वनि-तर्क यहाँ केंद्रित हैं। main code से circular dependency हटाने हेतु
// Dependency Injection (setGameStateProvider / setVibrateGamepad) का उपयोग।
// =============================================================================

const AudioManager = (() => {
    'use strict';

    // ========================= CORE =========================
    let audioCtx         = null;
    let audioUnlocked    = false;

    // ========================= तत्परता (READINESS) =========================
    let _isFontsReady        = false;
    let _isAudioPreloadDone  = false;
    let _isScaleGameDone     = false;
    let _isGameFullyReady    = false;
    let _gameReadinessMode   = null;        // 'high' | 'low'
    let _audioLoadFailures   = [];
    let _readinessTimeoutId  = null;

    // ========================= ऑडियो बफ़र्स =========================
    const audioBuffers = {
        bgMusic: null, naamaSamarpita: null, samarpita: null,
        chetanaJagrita: null, punarJanma: null, pralaya: null,
        shathendriya: null, jagritaBreath: null, sushuptiBreath: null,
        timer: null, prarabdhaBandhana: null, paapaBandhana: null,
        punyaBandhana: null, bandhanMukta: null, naamaDhwani: null,
        moksha: null, aakarshana: null, tyaaga: null, jaapaDhwani: null,
        antimCharana: null, kripaDhwani: null, shankhaDhwani: null,
        jyotiDhwani: null, shankhaPrapta: null, jyotiPrapta: null,
        purnaSamarpana: null, drishti: null, andhakaara: null
    };

    // ========================= AMBIENT LAYER STATE =========================
    let bgMusicSourceNode       = null;
    let bgMusicMp3Gain          = null;
    const BG_MUSIC_MP3_LAYER_VOLUME = 0.01;

    let shathendriyaSourceNode  = null;
    let shathendriyaGain        = null;
    const RUNNING_HORSES_VOLUME = 0.16;

    let jagritaBreathSourceNode = null;
    let jagritaBreathGain       = null;
    const JAGRITA_BREATH_VOLUME = 0.22;

    let sushuptiBreathSourceNode = null;
    let sushuptiBreathGain       = null;
    const SUSHUPTI_BREATH_VOLUME = 1;

    let lastSamarpitaSoundTime  = 0;
    const SAMARPITA_SOUND_COOLDOWN = 90; // ms

    let bgMusicStarted  = false;
    let bgMusicMuted    = false;
    let bgMasterGain    = null;
    const BG_BREATH_MOD_RANGE = 0.3;

    // ========================= VOLUME STATE =========================
    // ये दोनों बाहर से set होते हैं — public setter/getter नीचे expose हैं
    let _breathPulseGlobal  = 0;
    let _bgMusicVolume      = 1.0;

    // ========================= DUCK SYSTEM =========================
    let duckLevel           = 0;
    let lastDuckCheckTime   = 0;
    const DUCK_DECAY_PER_SEC            = 1.8;
    const BG_MUSIC_DUCK_REDUCTION       = 0.75;
    const RUNNING_HORSES_DUCK_REDUCTION = 0.15;
    const JAGRITA_BREATH_DUCK_REDUCTION = 0.55;
    const SUSHUPTI_BREATH_DUCK_REDUCTION = 0.20;

    const DUCK_STRENGTH = {
        purnaSamarpana: 0.6,  drishti: 0.35,       andhakaara: 0.4,
        shuvha: 0.5,          rikta: 0.55,          jaapa: 0.55,
        samarpita: 0.45,      naamaSamarpita: 0.55, aakarshana: 0.25,
        tyaaga: 0.25,         punaha: 0.7,          viraama: 0.2,
        resume: 0.15,         takraava: 0.7,        vijaya: 0.65,
        chetana: 0.65,        timer: 0.3,           prarabdhaBandhana: 0.4,
        paapaBandhana: 0.4,   punyaBandhana: 0.4,   bandhanaMukta: 0.35,
        naama: 0.45,          antimCharana: 0.35,   kripa: 0.5,
        shankhaDhwani: 0.45,  jyotiDhwani: 0.40,    shankhaPrapta: 0.45,
        jyotiPrapta: 0.40
    };

    // ========================= DEPENDENCY INJECTION =========================
    // circular dependency से बचाव: game-state व gamepad एक getter/callback से मिलते हैं
    let _getGameState = () => ({
        isGameStarted: false, gameOver: false, won: false,
        isPaused: false, isShastraVisible: false, chetanaaJagrita: false
    });
    let _vibrateGamepad = () => {};

    // ========================= READINESS FUNCTIONS =========================

    function checkReadiness() {
        if (_isGameFullyReady) return;
        if (!_isFontsReady || !_isAudioPreloadDone || !_isScaleGameDone) return;
        finalizeReadiness();
    }

    function finalizeReadiness() {
        if (_isGameFullyReady) return;
        _isGameFullyReady = true;
        _gameReadinessMode = (_audioLoadFailures.length === 0) ? 'high' : 'low';
        if (_audioLoadFailures.length > 0) {
            console.warn('🟡 Low Mode — निम्न ऑडियो-फ़ाइलें लोड नहीं हो सकीं:', _audioLoadFailures);
        }
        if (_readinessTimeoutId) { clearTimeout(_readinessTimeoutId); _readinessTimeoutId = null; }
        showReadyState();
    }

    function showReadyState() {
        const overlay  = document.getElementById('loading-overlay');
        const badge    = document.getElementById('mode-badge');
        const startBtn = document.getElementById('start-btn');

        if (badge) {
            if (_gameReadinessMode === 'high') {
                badge.textContent = '🟢 उच्च मोड';
                badge.title = 'सभी संसाधन सफलतापूर्वक लोड हुए — पूर्ण अनुभव सक्रिय';
            } else {
                badge.textContent = '🟡 निम्न मोड';
                badge.title = 'कुछ ध्वनि-संसाधन लोड नहीं हो सके — मूल अनुभव सक्रिय, खेल पूर्णतः खेलने-योग्य है';
            }
        }
        if (overlay) {
            overlay.style.opacity = '0';
            overlay.style.pointerEvents = 'none';
            setTimeout(() => { overlay.style.display = 'none'; }, 520);
        }
        if (startBtn) { startBtn.disabled = false; }
    }

    // ========================= ऑडियो PRELOAD =========================

    async function _loadAudioBuffer(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            return await audioCtx.decodeAudioData(arrayBuffer);
        } catch (err) {
            console.warn(`⚠️ ऑडियो लोड विफल (${url}):`, err);
            _audioLoadFailures.push(url);
            return null;
        }
    }

    async function _loadAllAudioBuffers() {
        if (!audioCtx) return;
        await Promise.all([_loadCriticalAudioBuffers(), _loadDeferredAudioBuffers()]);
    }

    // बैच 1 — गेमप्ले शुरुआत पर तुरंत ज़रूरी छोटी फ़ाइलें
    async function _loadCriticalAudioBuffers() {
        const [
            naamaSamarpita, samarpita, punarJanma, shathendriya, sushuptiBreath,
            timer, prarabdhaBandhana, paapaBandhana, punyaBandhana, bandhanMukta,
            naama, jaapa, aakarshana, tyaaga, kripa, shankhaDhwani, jyotiDhwani,
            shankhaPrapta, jyotiPrapta, purnaSamarpana, drishti, andhakaara
        ] = await Promise.all([
            _loadAudioBuffer('./audio/naamaSamarpita.mp3'),
            _loadAudioBuffer('./audio/samarpita.mp3'),
            _loadAudioBuffer('./audio/punaraJanma.mp3'),
            _loadAudioBuffer('./audio/shathendriya.mp3'),
            _loadAudioBuffer('./audio/sushuptiSwaansa.mp3'),
            _loadAudioBuffer('./audio/timer.mp3'),
            _loadAudioBuffer('./audio/prarabdhaBandhana.mp3'),
            _loadAudioBuffer('./audio/paapaBandhana.mp3'),
            _loadAudioBuffer('./audio/punyaBandhana.mp3'),
            _loadAudioBuffer('./audio/bandhanaMukta.mp3'),
            _loadAudioBuffer('./audio/naamaDhwani.mp3'),
            _loadAudioBuffer('./audio/jaapaDhwani.mp3'),
            _loadAudioBuffer('./audio/aakarshana.mp3'),
            _loadAudioBuffer('./audio/tyaaga.mp3'),
            _loadAudioBuffer('./audio/kripaDhwani.mp3'),
            _loadAudioBuffer('./audio/shankhaDhwani.mp3'),
            _loadAudioBuffer('./audio/jyotiDhwani.mp3'),
            _loadAudioBuffer('./audio/shankhaPrapta.mp3'),
            _loadAudioBuffer('./audio/jyotiPrapta.mp3'),
            _loadAudioBuffer('./audio/purnaSamarpana.mp3'),
            _loadAudioBuffer('./audio/drishti.mp3'),
            _loadAudioBuffer('./audio/andhakaara.mp3'),
        ]);

        audioBuffers.naamaSamarpita  = naamaSamarpita;
        audioBuffers.samarpita       = samarpita;
        audioBuffers.punarJanma      = punarJanma;
        audioBuffers.shathendriya    = shathendriya;
        audioBuffers.sushuptiBreath  = sushuptiBreath;
        audioBuffers.timer           = timer;
        audioBuffers.prarabdhaBandhana = prarabdhaBandhana;
        audioBuffers.paapaBandhana   = paapaBandhana;
        audioBuffers.punyaBandhana   = punyaBandhana;
        audioBuffers.bandhanMukta    = bandhanMukta;
        audioBuffers.naamaDhwani     = naama;
        audioBuffers.jaapaDhwani     = jaapa;
        audioBuffers.aakarshana      = aakarshana;
        audioBuffers.tyaaga          = tyaaga;
        audioBuffers.kripaDhwani     = kripa;
        audioBuffers.shankhaDhwani   = shankhaDhwani;
        audioBuffers.jyotiDhwani     = jyotiDhwani;
        audioBuffers.shankhaPrapta   = shankhaPrapta;
        audioBuffers.jyotiPrapta     = jyotiPrapta;
        audioBuffers.purnaSamarpana  = purnaSamarpana;
        audioBuffers.drishti         = drishti;
        audioBuffers.andhakaara      = andhakaara;

        // bgMusic-ग्राफ़ पहले से चल रहा हो (देर से बने AudioContext) तो layers अभी जोड़ें
        if (bgMusicStarted) {
            startRunningHorsesLayer();
            if (!_getGameState().chetanaaJagrita) startSushuptiBreathLayer();
        }
    }

    // बैच 2 — भारी (~6.5MB bgMusic) व देर से ज़रूरी ध्वनियाँ — बैच 1 की गति पर असर न पड़े
    async function _loadDeferredAudioBuffers() {
        const [bg, chetana, pralaya, jagritaBreath, moksha, antimCharana] = await Promise.all([
            _loadAudioBuffer('./audio/bgMusic.mp3'),
            _loadAudioBuffer('./audio/chetanaJagrita.mp3'),
            _loadAudioBuffer('./audio/pralaya.mp3'),
            _loadAudioBuffer('./audio/jagritaBreath.mp3'),
            _loadAudioBuffer('./audio/moksha.mp3'),
            _loadAudioBuffer('./audio/antimaCharana.mp3'),
        ]);

        audioBuffers.bgMusic        = bg;
        audioBuffers.chetanaJagrita = chetana;
        audioBuffers.pralaya        = pralaya;
        audioBuffers.jagritaBreath  = jagritaBreath;
        audioBuffers.moksha         = moksha;
        audioBuffers.antimCharana   = antimCharana;

        if (bgMusicStarted) startBgMusicMp3Layer();
    }

    function initAudioPreload() {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) { _isAudioPreloadDone = true; checkReadiness(); return; }
            audioCtx = new AudioContextClass();
            _loadAllAudioBuffers().then(() => { _isAudioPreloadDone = true; checkReadiness(); });
        } catch (err) {
            console.warn('⚠️ ऑडियो-प्रीलोड प्रारंभ नहीं हो सका:', err);
            _isAudioPreloadDone = true;
            checkReadiness();
        }
    }

    // ========================= PLAYBACK HELPERS =========================

    function playBufferedSound(buffer, destination, gainVal = 0.6, loop = false) {
        if (!audioCtx || !buffer) return null;
        const source   = audioCtx.createBufferSource();
        const gainNode = audioCtx.createGain();
        source.buffer  = buffer;
        source.loop    = loop;
        gainNode.gain.setValueAtTime(gainVal, audioCtx.currentTime);
        source.connect(gainNode);
        gainNode.connect(destination || audioCtx.destination);
        source.start(0);
        return { source, gainNode };
    }

    function playTone(freq, duration = 0.08, type = 'sine', gain = 0.04, endFreq = null) {
        if (!audioUnlocked || !audioCtx) return;
        const now = audioCtx.currentTime;
        const osc  = audioCtx.createOscillator();
        const amp  = audioCtx.createGain();
        osc.type   = type;
        osc.frequency.setValueAtTime(freq, now);
        if (endFreq !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + duration);
        amp.gain.setValueAtTime(0.0001, now);
        amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
        amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        osc.connect(amp);
        amp.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + duration + 0.03);
    }

    // ========================= PLAY SOUND =========================

    function playSound(name) {
        if (DUCK_STRENGTH[name] !== undefined) duckBackgroundMusic(DUCK_STRENGTH[name]);

        switch (name) {
            case 'shuvha':
                playTone(523.25, 0.07, 'triangle', 0.035, 783.99);
                _vibrateGamepad(0.15, 0.10, 90);
                break;

            case 'rikta':
                playTone(155.56, 0.10, 'sawtooth', 0.03, 92.5);
                _vibrateGamepad(0.50, 0.70, 160);
                break;

            case 'ashuvha':
                playTone(100, 0.2, 'square', 0.015, 140);
                _vibrateGamepad(0.30, 0.20, 80);
                break;

            case 'jaapa':
                if (audioBuffers.jaapaDhwani) playBufferedSound(audioBuffers.jaapaDhwani, audioCtx.destination, 0.6);
                else playTone(880, 0.09, 'sine', 0.03, 1320);
                _vibrateGamepad(0.10, 0.05, 50);
                break;

            case 'naamaSamarpita':
                if (audioBuffers.naamaSamarpita) playBufferedSound(audioBuffers.naamaSamarpita, audioCtx.destination, 0.6);
                else playTone(880, 0.09, 'sine', 0.03, 1320);
                _vibrateGamepad(0.10, 0.05, 50);
                break;

            case 'purnaSamarpana':
                if (audioBuffers.purnaSamarpana) playBufferedSound(audioBuffers.purnaSamarpana, audioCtx.destination, 0.65);
                else playTone(987.77, 0.14, 'sine', 0.04, 1567.98);
                _vibrateGamepad(0.20, 0.25, 130);
                break;

            case 'drishti':
                if (audioBuffers.drishti) playBufferedSound(audioBuffers.drishti, audioCtx.destination, 0.55);
                else playTone(880, 0.10, 'sine', 0.03, 1318.51);
                _vibrateGamepad(0.10, 0.08, 60);
                break;

            case 'andhakaara':
                if (audioBuffers.andhakaara) playBufferedSound(audioBuffers.andhakaara, audioCtx.destination, 0.55);
                else playTone(196.00, 0.12, 'sawtooth', 0.03, 130.81);
                _vibrateGamepad(0.18, 0.12, 90);
                break;

            case 'shankhaDhwani':
                if (audioBuffers.shankhaDhwani) playBufferedSound(audioBuffers.shankhaDhwani, audioCtx.destination, 0.65);
                else playTone(523.25, 0.12, 'sine', 0.04, 783.99);
                _vibrateGamepad(0.20, 0.25, 120);
                break;

            case 'shankhaPrapta':
                if (audioBuffers.shankhaPrapta) playBufferedSound(audioBuffers.shankhaPrapta, audioCtx.destination, 0.6);
                else playTone(700, 0.10, 'sine', 0.035, 1000);
                _vibrateGamepad(0.12, 0.10, 70);
                break;

            case 'jyotiPrapta':
                if (audioBuffers.jyotiPrapta) playBufferedSound(audioBuffers.jyotiPrapta, audioCtx.destination, 0.6);
                else playTone(740, 0.10, 'triangle', 0.035, 1050);
                _vibrateGamepad(0.12, 0.10, 70);
                break;

            case 'jyotiDhwani':
                if (audioBuffers.jyotiDhwani) playBufferedSound(audioBuffers.jyotiDhwani, audioCtx.destination, 0.60);
                else playTone(659.25, 0.12, 'triangle', 0.04, 987.77);
                _vibrateGamepad(0.15, 0.18, 100);
                break;

            case 'kripa':
                if (audioBuffers.kripaDhwani) playBufferedSound(audioBuffers.kripaDhwani, audioCtx.destination, 0.6);
                else playTone(1046.50, 0.15, 'sine', 0.04, 1318.51);
                _vibrateGamepad(0.15, 0.20, 80);
                break;

            // 🔧 TUNED: antimCharana — fade envelope से क्लिक/पॉप हटाया गया (gain 0.65→0.35)
            case 'antimCharana': {
                if (audioBuffers.antimCharana) {
                    const acNow      = audioCtx.currentTime;
                    const acSrc      = audioCtx.createBufferSource();
                    const acGain     = audioCtx.createGain();
                    const acPeakGain = 0.35;
                    const acDuration = audioBuffers.antimCharana.duration;
                    acSrc.buffer     = audioBuffers.antimCharana;
                    acGain.gain.setValueAtTime(0.0001, acNow);
                    acGain.gain.exponentialRampToValueAtTime(acPeakGain, acNow + 0.08);
                    const acPeakHoldTime = Math.max(acNow + 0.08, acNow + acDuration - 0.15);
                    acGain.gain.setValueAtTime(acPeakGain, acPeakHoldTime);
                    const acFadeOutTime = Math.max(acPeakHoldTime + 0.02, acNow + acDuration - 0.02);
                    acGain.gain.exponentialRampToValueAtTime(0.0001, acFadeOutTime);
                    acSrc.connect(acGain);
                    acGain.connect(audioCtx.destination);
                    acSrc.start(acNow);
                } else {
                    console.warn('⚠️ antimaCharana.mp3 लोड नहीं हुई');
                }
                _vibrateGamepad(0.25, 0.30, 140);
                break;
            }

            // debounce cooldown — तेज़ टकराव पर muddy ध्वनि से बचाव
            case 'samarpita': {
                const nowMs = performance.now();
                if (nowMs - lastSamarpitaSoundTime >= SAMARPITA_SOUND_COOLDOWN) {
                    lastSamarpitaSoundTime = nowMs;
                    if (audioBuffers.samarpita) playBufferedSound(audioBuffers.samarpita, audioCtx.destination, 0.6);
                    else {
                        playTone(659.25, 0.12, 'triangle', 0.04, 987.77);
                        setTimeout(() => playTone(987.77, 0.08, 'sine', 0.025, 1318.51), 55);
                    }
                }
                _vibrateGamepad(0.20, 0.15, 100);
                break;
            }

            case 'aakarshana':
                if (audioBuffers.aakarshana) playBufferedSound(audioBuffers.aakarshana, audioCtx.destination, 0.5);
                else playTone(440, 0.07, 'sine', 0.025, 660);
                _vibrateGamepad(0.08, 0.05, 40);
                break;

            case 'tyaaga':
                if (audioBuffers.tyaaga) playBufferedSound(audioBuffers.tyaaga, audioCtx.destination, 0.5);
                else playTone(392, 0.08, 'square', 0.025, 329.63);
                _vibrateGamepad(0.10, 0.06, 60);
                break;

            case 'punaha':
                if (audioBuffers.punarJanma) playBufferedSound(audioBuffers.punarJanma, audioCtx.destination, 0.7);
                else {
                    playTone(329.63, 0.06, 'triangle', 0.025, 523.25);
                    setTimeout(() => playTone(659.25, 0.07, 'triangle', 0.025, 987.77), 60);
                }
                _vibrateGamepad(0.60, 0.85, 280);
                break;

            case 'viraama': playTone(220, 0.05, 'sine', 0.02, 196); break;
            case 'resume':  playTone(196, 0.05, 'sine', 0.02, 220); break;

            case 'takraava':
                if (audioBuffers.pralaya) playBufferedSound(audioBuffers.pralaya, audioCtx.destination, 0.7);
                else playTone(110, 0.08, 'square', 0.03, 82.41);
                _vibrateGamepad(0.60, 0.90, 220);
                break;

            case 'vijaya':
                if (audioBuffers.moksha) {
                    playBufferedSound(audioBuffers.moksha, audioCtx.destination, 0.7);
                } else {
                    playTone(523.25, 0.12, 'sine', 0.03, 783.99);
                    setTimeout(() => playTone(659.25, 0.12, 'sine', 0.03, 987.77), 70);
                    setTimeout(() => playTone(783.99, 0.14, 'sine', 0.03, 1174.66), 140);
                }
                _vibrateGamepad(0.3, 0.3, 150);
                setTimeout(() => _vibrateGamepad(0.3, 0.3, 150), 200);
                setTimeout(() => _vibrateGamepad(0.4, 0.5, 300), 400);
                break;

            // fade-in envelope — शुरुआती क्लिक/पॉप से बचाव; पूरी buffer duration तक बजे
            case 'chetana': {
                if (audioBuffers.chetanaJagrita) {
                    const cNow = audioCtx.currentTime;
                    const cSrc = audioCtx.createBufferSource();
                    const cGain = audioCtx.createGain();
                    cSrc.buffer = audioBuffers.chetanaJagrita;
                    cGain.gain.setValueAtTime(0.0001, cNow);
                    cGain.gain.exponentialRampToValueAtTime(0.7, cNow + 0.05);
                    cSrc.connect(cGain);
                    cGain.connect(audioCtx.destination);
                    cSrc.start(cNow);
                } else {
                    console.warn('⚠️ chetanaJagrita.mp3 लोड नहीं हुई');
                }
                break;
            }

            case 'timer':
                if (audioBuffers.timer) playBufferedSound(audioBuffers.timer, audioCtx.destination, 0.6);
                break;

            case 'prarabdhaBandhana':
                if (audioBuffers.prarabdhaBandhana) playBufferedSound(audioBuffers.prarabdhaBandhana, audioCtx.destination, 0.6);
                break;

            case 'paapaBandhana':
                if (audioBuffers.paapaBandhana) playBufferedSound(audioBuffers.paapaBandhana, audioCtx.destination, 0.6);
                break;

            case 'punyaBandhana':
                if (audioBuffers.punyaBandhana) playBufferedSound(audioBuffers.punyaBandhana, audioCtx.destination, 0.6);
                break;

            case 'bandhanaMukta':
                if (audioBuffers.bandhanMukta) playBufferedSound(audioBuffers.bandhanMukta, audioCtx.destination, 0.6);
                break;

            case 'naama':
                if (audioBuffers.naamaDhwani) playBufferedSound(audioBuffers.naamaDhwani, audioCtx.destination, 0.6);
                else playTone(880, 0.09, 'sine', 0.03, 1320);
                _vibrateGamepad(0.10, 0.05, 50);
                break;
        }
    }

    // ========================= AMBIENT LAYERS =========================

    function startBgMusicMp3Layer() {
        if (!bgMasterGain || !audioBuffers.bgMusic || bgMusicSourceNode) return;
        const now = audioCtx.currentTime;
        bgMusicMp3Gain = audioCtx.createGain();
        bgMusicMp3Gain.gain.setValueAtTime(BG_MUSIC_MP3_LAYER_VOLUME, now);
        bgMusicMp3Gain.connect(bgMasterGain);
        bgMusicSourceNode        = audioCtx.createBufferSource();
        bgMusicSourceNode.buffer = audioBuffers.bgMusic;
        bgMusicSourceNode.loop   = true;
        bgMusicSourceNode.connect(bgMusicMp3Gain);
        bgMusicSourceNode.start(now);
    }

    function startRunningHorsesLayer() {
        if (!bgMasterGain || !audioBuffers.shathendriya || shathendriyaSourceNode) return;
        const now = audioCtx.currentTime;
        shathendriyaGain = audioCtx.createGain();
        shathendriyaGain.gain.setValueAtTime(isActiveGameplay() ? RUNNING_HORSES_VOLUME : 0, now);
        shathendriyaGain.connect(bgMasterGain);
        shathendriyaSourceNode        = audioCtx.createBufferSource();
        shathendriyaSourceNode.buffer = audioBuffers.shathendriya;
        shathendriyaSourceNode.loop   = true;
        shathendriyaSourceNode.connect(shathendriyaGain);
        shathendriyaSourceNode.start(now);
    }

    function startJagritaBreathLayer() {
        if (!bgMasterGain || !audioBuffers.jagritaBreath || jagritaBreathSourceNode) return;
        const now = audioCtx.currentTime;
        jagritaBreathGain = audioCtx.createGain();
        jagritaBreathGain.gain.setValueAtTime(isActiveGameplay() ? JAGRITA_BREATH_VOLUME : 0, now);
        jagritaBreathGain.connect(bgMasterGain);
        jagritaBreathSourceNode        = audioCtx.createBufferSource();
        jagritaBreathSourceNode.buffer = audioBuffers.jagritaBreath;
        jagritaBreathSourceNode.loop   = true;
        jagritaBreathSourceNode.connect(jagritaBreathGain);
        jagritaBreathSourceNode.start(now);
    }

    function stopJagritaBreathLayer() {
        if (!jagritaBreathSourceNode) return;
        try { jagritaBreathSourceNode.stop(); } catch (_) {}
        jagritaBreathSourceNode.disconnect();
        jagritaBreathSourceNode = null;
    }

    function startSushuptiBreathLayer() {
        if (!bgMasterGain || !audioBuffers.sushuptiBreath || sushuptiBreathSourceNode) return;
        const now = audioCtx.currentTime;
        sushuptiBreathGain = audioCtx.createGain();
        sushuptiBreathGain.gain.setValueAtTime(isActiveGameplay() ? SUSHUPTI_BREATH_VOLUME : 0, now);
        sushuptiBreathGain.connect(bgMasterGain);
        sushuptiBreathSourceNode        = audioCtx.createBufferSource();
        sushuptiBreathSourceNode.buffer = audioBuffers.sushuptiBreath;
        sushuptiBreathSourceNode.loop   = true;
        sushuptiBreathSourceNode.connect(sushuptiBreathGain);
        sushuptiBreathSourceNode.start(now);
    }

    function stopSushuptiBreathLayer() {
        if (!sushuptiBreathSourceNode) return;
        try { sushuptiBreathSourceNode.stop(); } catch (_) {}
        sushuptiBreathSourceNode.disconnect();
        sushuptiBreathSourceNode = null;
    }

    // ========================= ENSURE AUDIO / START BG MUSIC =========================

    function ensureAudio() {
        try {
            if (!audioCtx) {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (!AudioContextClass) return;
                audioCtx = new AudioContextClass();
                // Long-task fix: audio loading को next macrotask में defer करें
                setTimeout(() => _loadAllAudioBuffers(), 0);
            }
            if (audioCtx.state === 'suspended') audioCtx.resume();
            audioUnlocked = true;
            startBackgroundMusic();
        } catch (err) { console.warn('Audio init failed:', err); }
    }

    // 🆕 जाँचता है कि अभी असली, सक्रिय गेमप्ले चल रहा है या नहीं
    function isActiveGameplay() {
        const s = _getGameState();
        return s.isGameStarted && !s.gameOver && !s.won && !s.isPaused && !s.isShastraVisible;
    }

    function startBackgroundMusic() {
        if (bgMusicStarted || !audioCtx) return;
        bgMusicStarted = true;
        bgMasterGain   = audioCtx.createGain();
        bgMasterGain.gain.setValueAtTime(bgMusicMuted ? 0 : 1, audioCtx.currentTime);
        bgMasterGain.connect(audioCtx.destination);
        startBgMusicMp3Layer();
        startRunningHorsesLayer();
        if (!_getGameState().chetanaaJagrita) startSushuptiBreathLayer();
    }

    // ========================= PER-FRAME UPDATES =========================

    function updateAmbientVolumes() {
        if (!bgMasterGain) return;
        bgMasterGain.gain.value = bgMusicMuted ? 0 : 1;
        if (bgMusicMuted) return;

        const bgMusicDuckMul      = 1 - (duckLevel * BG_MUSIC_DUCK_REDUCTION);
        const shathendriyaDuckMul = 1 - (duckLevel * RUNNING_HORSES_DUCK_REDUCTION);
        const jagritaBreathDuckMul = 1 - (duckLevel * JAGRITA_BREATH_DUCK_REDUCTION);
        const sushuptiBreathDuckMul = 1 - (duckLevel * SUSHUPTI_BREATH_DUCK_REDUCTION);

        // 🛠️ बग-फिक्स: bgMusicVolume slider पहले read नहीं होता था — अब हर layer पर लागू
        if (bgMusicMp3Gain) {
            bgMusicMp3Gain.gain.value = BG_MUSIC_MP3_LAYER_VOLUME * bgMusicDuckMul * _bgMusicVolume;
        }

        const activeNow = isActiveGameplay();

        // घोड़े — gameplay-gated, setTargetAtTime → smooth fade (click/pop नहीं)
        if (shathendriyaGain) {
            const targetVol = RUNNING_HORSES_VOLUME * shathendriyaDuckMul * _bgMusicVolume * (activeNow ? 1 : 0);
            shathendriyaGain.gain.setTargetAtTime(targetVol, audioCtx.currentTime, 0.08);
        }

        // jagritaBreath — सांस (breath) से सिंक + gameplay-gated
        if (jagritaBreathGain) {
            const breathVol    = JAGRITA_BREATH_VOLUME * (1 - BG_BREATH_MOD_RANGE + _breathPulseGlobal * BG_BREATH_MOD_RANGE);
            const targetSpaceVol = breathVol * jagritaBreathDuckMul * _bgMusicVolume * (activeNow ? 1 : 0);
            jagritaBreathGain.gain.setTargetAtTime(targetSpaceVol, audioCtx.currentTime, 0.08);
        }

        // sushuptiBreath — सांस से सिंक + gameplay-gated
        if (sushuptiBreathGain) {
            const dreamVol  = SUSHUPTI_BREATH_VOLUME * (1 - BG_BREATH_MOD_RANGE + _breathPulseGlobal * BG_BREATH_MOD_RANGE);
            const targetDreamVol = dreamVol * sushuptiBreathDuckMul * _bgMusicVolume * (activeNow ? 1 : 0);
            sushuptiBreathGain.gain.setTargetAtTime(targetDreamVol, audioCtx.currentTime, 0.08);
        }
    }

    function updateDuckDecay() {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        if (lastDuckCheckTime === 0) { lastDuckCheckTime = now; return; }
        const elapsedSec = now - lastDuckCheckTime;
        lastDuckCheckTime = now;
        if (duckLevel > 0) { duckLevel -= DUCK_DECAY_PER_SEC * elapsedSec; if (duckLevel < 0) duckLevel = 0; }
    }

    function duckBackgroundMusic(strength) {
        if (strength > duckLevel) duckLevel = strength;
    }

    function toggleBgMusic() {
        bgMusicMuted = !bgMusicMuted;
        const btn = document.getElementById('music-toggle-btn');
        if (btn) btn.textContent = bgMusicMuted ? '🔇' : '🔊';
        updateAmbientVolumes();
    }

    // ========================= PUBLIC API =========================
    return {
        // ── Dependency injection ──────────────────────────────────────
        /** main.js से एक getter pass करें जो game state object लौटाए।
         *  { isGameStarted, gameOver, won, isPaused, isShastraVisible, chetanaaJagrita }
         */
        setGameStateProvider(fn) { _getGameState = fn; },

        /** main.js का vibrateGamepad फ़ंक्शन inject करें */
        setVibrateGamepad(fn)   { _vibrateGamepad = fn; },

        // ── Readiness ─────────────────────────────────────────────────
        /** पेज-लोड पर एक बार बुलाएँ — preload + fonts + safety timeout शुरू होते हैं */
        init() {
            initAudioPreload();
            if (document.fonts && document.fonts.ready) {
                document.fonts.ready.then(() => { _isFontsReady = true; checkReadiness(); });
            } else {
                _isFontsReady = true; // FontFaceSet API न हो तो आगे बढ़ें
            }
            _readinessTimeoutId = setTimeout(() => {
                console.warn('⚠️ तत्परता-समय-सीमा (6s) पार — Low Mode में आगे बढ़ रहे हैं');
                _isFontsReady = true; _isAudioPreloadDone = true; _isScaleGameDone = true;
                finalizeReadiness();
            }, 6000);
        },

        /** scaleGame() पूरा होने पर main.js से बुलाएँ */
        setScaleDone() { _isScaleGameDone = true; checkReadiness(); },

        // ── Volume / state setters ────────────────────────────────────
        set breathPulseGlobal(v)  { _breathPulseGlobal = v; },
        get breathPulseGlobal()   { return _breathPulseGlobal; },
        set bgMusicVolume(v)      { _bgMusicVolume = v; },
        get bgMusicVolume()       { return _bgMusicVolume; },

        // ── Read-only getters ─────────────────────────────────────────
        get audioCtx()      { return audioCtx; },
        get audioUnlocked() { return audioUnlocked; },

        // ── Playback ──────────────────────────────────────────────────
        playSound,
        playTone,
        ensureAudio,

        // ── Ambient layers ────────────────────────────────────────────
        startBackgroundMusic,
        startJagritaBreathLayer,
        stopJagritaBreathLayer,
        startSushuptiBreathLayer,
        stopSushuptiBreathLayer,
        toggleBgMusic,

        // ── Per-frame (gameLoop से हर frame बुलाएँ) ────────────────────
        updateAmbientVolumes,
        updateDuckDecay,
        duckBackgroundMusic,
        isActiveGameplay,
    };
})();
