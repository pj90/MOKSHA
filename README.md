# 🕉️ *मोक्ष*

> **"मोक्ष प्राप्ति का एकमात्र मार्ग — त्याग।"**
> *The only path to liberation — is letting go.*

An HTML5 browser game rooted in **Sanatan Shastra** and **Karmic Philosophy**.
Control your chariot through the cosmic field, master your senses, burn your karma, and attain **Moksha**.

🎮 **[Play on itch.io](https://pj904ich.itch.io/moksha)** &nbsp;|&nbsp;
💛 **[Support on PayPal](https://paypal.me/pankajsharma18)** &nbsp;|&nbsp;
☕ **[Ko-fi](https://ko-fi.com/pankajsharma84017)**

---

## 🕉️ Spiritual Philosophy (Sanatan Model)

The game is built on **Katha Upanishad's chariot metaphor** (Nachiketopakhyana):

| Symbol | Game Element | Meaning |
|---|---|---|
| 🐎 6 Horses | Six senses of the player | इंद्रियाँ — The senses |
| 🪢 Reins | Player control | मन — The mind |
| 🛻 Chariot | Game entity | शरीर — The body |
| 👁️ Passenger | Soul (Aatma) | आत्मा — The soul |
| ॐ Naam-Jaap | SPACE / RT button | नाम-स्मरण — Self-remembrance |
| 🌬️ Breath | Lotus petals ring | आयु-शेष — Remaining life |

### Core Karma System

| Concept | Variable | Behaviour |
|---|---|---|
| **पुण्य** (Good Karma) | `shuvhaKarma` | Slows chariot; auto-binds if not released in time |
| **पाप** (Bad Karma) | `ashuvhaKarma` | Slows + strikes chariot (vision distortion) |
| **प्रारब्ध** (Past Life Karma) | `prarabdha` | Accumulates on rebirth; only 10 Naam can burn it |
| **समर्पित** (Surrendered) | `samarpita` | ≥50 triggers चेतना-जागृति (Awakening) |
| **चेतना-जागृति** (Awakening) | `chetanaaJagrita` | **True gate for Moksha** |
| **कृपा** (Grace) | `kripa` | Earned through surrender; frees karma-bondage |
| **शंख** (Conch) | `shankha` | Dispels cyclone (तूफ़ान) of Maya |
| **ज्योति** (Lamp) | `jyoti` | Restores vision in the darkness of bad karma |

## 🎮 Controls

| Action | Keyboard | Gamepad | Spiritual Meaning |
|---|---|---|---|
| Steer Chariot | `A` / `D`, `←` / `→` | DPAD L/R | इंद्रिय-नियंत्रण |
| Naam-Jaap (Chant) | `SPACE` | RT (7) | 1 Naam burns Punya; 5 = Paap; 10 = Prarabdha |
| Vairagya (Detach) | `S`, `↓` | X (2) | Prevent good-karma bondage |
| Naam Samarpana | `W`, `↑` | RB (5) | Only in final phase (samaya < 100) |
| Pralaya (Sacrifice) | `Q` | LB (4) | Voluntary chariot dissolution |
| Pure Rebirth | `R` | LT (6) | Zero karma → new life |
| Shastra (Knowledge) | `ESC` | BACK (8) | Open wisdom scroll |
| Pause | `F` | START (9) | Stillness |
| Shankha (Conch) | `Y` | Y (0) | Dispel cyclone |
| Jyoti (Lamp) | `B` | B (1) | Restore vision in bad-karma darkness |
| Shastra Scroll | `↑` / `↓` (hold) | DPAD U/D | Navigate wisdom text |

---

## ✨ Key Features

- 🕉️ **Vedic Karma Engine** — Real-time Punya/Paap/Prarabdha/Samarpita system
- 🌸 **Lotus Petal Ring** — 10 animated petals visualise remaining breath (Swaansa)
- 🌀 **Cyclone (Maya Tufaan)** — Can only be dispelled by Shankha, not Naam-Jaap
- 🎵 **Layered Ambient Audio** — 4 continuous loops (bgMusic, Shathendriya, SushuptiBreath, JagritaBreath) with smooth duck/fade
- 🔮 **Sci-Fi Yantra Visuals** — CRT scanlines, gold scan-sweep, Yantra polygons, cyberGrid
- 🏆 **Three End States** — Moksha (liberation), Pralaya (dissolution), Punarjanma (rebirth)
- 🎮 **Full Gamepad Support** — Xbox/generic controller with deadzone handling
- ⚡ **60fps Performance** — Pool-based architecture (no GC pressure), sprite caching, gradient buckets
- 📜 **In-Game Shastra** — Full philosophical treatise accessible via ESC

---

## 🚀 How to Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/weirdcodesofficial/MOKSHA.git
cd moksha

# 2. Serve locally (required for audio — file:// blocks fetch)
npx serve .
# OR
python -m http.server 8080

# 3. Open in browser
http://localhost:8080
```

> ⚠️ **Do NOT open `index.html` directly** (`file://` protocol blocks audio loading → Low Mode).

---

## 💻 System Requirements

### Browser
- **Recommended:** Chrome / Edge (evergreen)
- **Supported:** Firefox, Safari (evergreen)
- **Required APIs:** HTML5 Canvas 2D, RequestAnimationFrame, Web Audio API, Fetch

### High Mode vs Low Mode
```
gameReadinessMode = (audioLoadFailures.length === 0) ? 'high' : 'low'
```
> High/Low Mode is determined by **audio load success**, not hardware specs.

| Factor | High Mode | Low Mode |
|---|---|---|
| Network | All 28 mp3 files load in time | Timeout exceeded → Low |
| Web Audio API | Available | Old browser → Low |
| Server/CDN | HTTP 200 | CORS / blocker → Low |

### Hardware (for 60fps)
- **CPU:** Dual-core 2015+ (minimum), Quad-core (recommended)
- **RAM:** 4GB (minimum), 8GB+ (recommended)
- **GPU:** Integrated graphics sufficient

### Browser Settings
1. Hardware acceleration **ON**
2. Run in **foreground tab** (background RAF throttles timer)
3. Browser zoom at **100%** (conflicts with `scaleGame()`)
4. Disable aggressive extensions (may block CDN audio/fonts → Low Mode)

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Rendering | HTML5 Canvas 2D |
| Logic | Vanilla JS (ES6+) — no framework, no build tool |
| Audio | Web Audio API (layered ambient + SFX duck system) |
| Input | Keyboard + Gamepad API |
| Visuals | Pure Canvas — no sprites, no external assets except audio |

---

## 👤 Credits

**Developed by [Weired Codes](https://github.com/weiredcodes)**
*Inspired by Katha Upanishad, Bhagavad Gita, and Sanatan Dharma.*

---

---

# 📖 मोक्ष — प्रोजेक्ट संदर्भ-दस्तावेज़ (Developer Reference)

> **उद्देश्य:** यह दस्तावेज़ `index.html` के लिए एक स्थायी संदर्भ (reference) है।
> **अंतिम अपडेट आधार-फ़ाइल:** `index.html` (3835 lines, single-file vanilla JS + Canvas)
> **भाषा/स्टैक:** HTML5 Canvas, Vanilla JS (no build tooling, no TypeScript, no framework), Web Audio API, Gamepad API

---

## 1. शास्त्रीय मॉडल (The Spiritual Model)

| शास्त्रीय अवधारणा | कोड वेरिएबल/कांस्टेंट | अर्थ एवं व्यवहार |
|---|---|---|
| **पुण्य** (शुभ कर्म) | `shuvhaKarma`, `pendingGoodKarma` | गति को मंद करता है; मोहक प्रलोभन — समय रहते त्याग न करने पर स्वतः बंध |
| **पाप** (अशुभ कर्म) | `ashuvhaKarma` | गति मंद + रथ पर आघात (कंपन/दृष्टि-भ्रम) |
| **प्रारब्ध** | `prarabdha` | पुनर्जन्म पर भारी होकर जुड़ता है; 10 नाम से भस्म होता है |
| **समर्पित** | `samarpita` | जब >= CHETANA_JAGRITI_THRESHOLD (50), चेतना-जागृति ट्रिगर |
| **चेतना-जागृति** | `chetanaaJagrita` (boolean) | **मोक्ष की प्रामाणिक शर्त** — `samarpita >= 50` केवल ट्रिगर |
| **नाम** | `activeNaam` | 1 नाम=पुण्य भस्म, 5=पाप भस्म, 10=प्रारब्ध भस्म |
| **कृपा** | `kripa` | बंधन हो → kripa-- व कर्म समर्पित में; बंधन न हो → kripa++ |
| **शंख** | `shankha` | Y/gamepad — cyclone-शमन हेतु |
| **ज्योति** | `jyoti` | B/gamepad — पाप-अंधकार में दृष्टि हेतु |
| **श्वास** | `swaansa`, `samaya` | कमल-पंखुड़ी वलय से दृश्यित (§2.8) |
| **ब्रह्मांडीय क्षितिज** | `samaya <= 0` | मोक्ष या पुनर्जन्म का निर्णय-क्षण |
| **पुनर्जन्म** | `punaraJanmaCount` + `isApavitra` | समय SAMAYA_PRAARAMBHIKA (2880) से पुनः आरंभ |

### 1.1 प्रतीकवाद
- **6 घोड़े** = 6 इंद्रियाँ; **लगाम** = मन; **रथ** = शरीर; **सारथी** = मन; **यात्री** = आत्मा
- **ॐ नाम** = आत्म-स्मरण; **श्वास** = आयु-शेष — कमल-पंखुड़ी (§2.8) से दृश्यित

### 1.2 मोक्ष-शर्त
```js
if (shuvhaKarma === 0 && ashuvhaKarma === 0 && !pendingGoodKarma
    && prarabdha === 0 && chetanaaJagrita && purnaSamarpana) { /* मोक्ष */ }
```
⚠️ सदैव `chetanaaJagrita` boolean प्रयोग करें, `samarpita >= 50` नहीं।

### 1.3 पुनर्जन्म — पवित्र बनाम अपवित्र
```js
let isApavitra = (shuvhaKarma > 0 || ashuvhaKarma > 0 || prarabdha > 0);
let earnsKripaOnRebirth = (activeNaam >= 20 || samarpita >= 30 || chetanaaJagrita);
```
सिर्फ कर्म-बंधन शेष रहने पर "अपवित्र" — समर्पित/नाम की कमी "अपवित्र" नहीं।

### 1.4 कृपा-तर्क (grantKripa) — शास्त्र-संगत व्यवहार
```js
function grantKripa(x, y, reason = null) {
    let hadKarma = (shuvhaKarma + ashuvhaKarma) > 0;
    if (hadKarma) {
        if (kripa > 0) { kripa--; }   // कृपा व्यय — बंधन-मुक्ति में उपयोग
        samarpita += freedKarma;       // मुक्त कर्म समर्पित में
        shuvhaKarma = 0; ashuvhaKarma = 0;
        // ⚠️ प्रारब्ध अप्रभावित — पूर्व-जन्मों का भार, सिर्फ 10-नाम से भस्म
    } else { kripa++; }               // शुद्ध अनुग्रह-प्राप्ति
}
```

### 1.5 cyclone — शास्त्र-संगत व्यवहार
- cyclone **player को नहीं खींचता** — सिर्फ shuvha/rikta माया को
- naam-jaap वलय cyclone को नहीं छूती — सिर्फ शंख-वलय (Y) ही cyclone भस्म करती है

---

## 2. कोर गेम-स्टेट — वेरिएबल मानचित्र

### 2.1 कर्म/मोक्ष-संबंधी स्टेट
```
shuvhaKarma, ashuvhaKarma, activeNaam    — वर्तमान सक्रिय मात्रा
  ⚠️ पुराने नाम activeGoodKarma/activeBadKarma — कोड में अब shuvhaKarma/ashuvhaKarma
prarabdha, samarpita, punaraJanmaCount  — संचित/आजीवन काउंटर
kripa, shankha, jyoti                   — दुर्लभ resource काउंटर
chetanaaJagrita (boolean)               — मोक्ष-गेट
isKarmaImmune                           — अस्थायी सुरक्षा
```

### 2.2 समय/श्वास
```
SAMAYA_PRAARAMBHIKA = 2880  — प्रारंभिक व पुनर्जन्म दोनों पर यही मान
samaya                      — वर्तमान समय
swaansa, swaansaTimer       — श्वास-शेष (swaansa = samaya / 288)
```

### 2.3 पूल-आधारित आर्किटेक्चर — ⚠️ अनिवार्य पैटर्न

| Pool | आकार | उपयोग |
|---|---|---|
| `mayaPool` | 50 | शुभ/अशुभ माया |
| `particlePool` | 50 | विस्फोट कण |
| `glowEffectPool` | 20 | फैलती-मिटती प्राप्ति-आभा |
| `floatingTextPool` | 25 | तैरते टेक्स्ट (ॐ/🙏/+N आदि) — गोल-ग्लास-बॉक्स + text-clamping + measureText() cache |

**नियम:** `active: false` slot खोजें → reuse करें → `active = false` सेट करें। कभी array resize नहीं।

### 2.4 ग्लो-रिंग सिस्टम (DRY)
```js
let glowRings = {
    jyoti:   { active, radius, speed:18, maxRadius:420, strokeColor, lineWidthMul, shadowBlur, glowColor, fillColor },
    shankha: { ...same... },
    kripa:   { ...same... }
};
// helpers: updateGlowRing(ring, dt, onTick), drawGlowRing(cx, cy, ring), resetAllGlowRings()
```
- **शंख-वलय onTick:** cyclone-collision-चेक (Y-press पर नहीं — शास्त्र-संगत)
- **ज्योति-वलय:** सिर्फ यही पाप-दृष्टि-भ्रम हटाती है — शंख नहीं

### 2.5 रिसोर्स-पिकअप यूनिफिकेशन (DRY)
```js
const MAYA_SIZE_TABLE = { naama:{36,36}, kripa:{32,32}, cyclone:{32,32}, shankha:{32,32}, jyoti:{32,32}, default:{20,24} };
const RESOURCE_PICKUP_TABLE = {
    shankha: { icon:"🐚", color:"#7dd3fc", sound:"shankhaPrapta", alert:"..." },
    jyoti:   { icon:"🪔", color:"#ffe932", sound:"jyotiPrapta",  alert:"..." }
};
function collectResource(type, x, y, opts = {}) { ... }
function drawPickupGlowIcon(cx, cy, bScale, icon, midColorRGB, midAlpha, shadowColor, pulseSpeed, pulseAmp) { ... }
```

### 2.6 नामित कांस्टेंट
```js
const CHETANA_JAGRITI_THRESHOLD = 50;
const NAAMA_JAAP_GROWTH_SPEED   = 22;
const NAAMA_JAAP_MAX_RADIUS     = 1000;
const HORSE_PULL_RANGE          = 160;
const GAMEPAD_DEADZONE          = 0.18;
const SHASTRA_SCROLL_SPEED      = 6;
const SAMARPITA_SOUND_COOLDOWN  = 90;    // ms
const KRIPA_NAAM_MILESTONE      = 20;
const KRIPA_SAMARPITA_MILESTONE = 30;
const SAMAYA_PRAARAMBHIKA       = 2880;
```

### 2.7 गति/समय-वलय व कर्म-कक्षा (outerOrbits)

**वलय रेडियस:**
```js
let gatiRadius  = (breathingSmoothSize / 2) + 5;   // शरीर से 5px बाहर
let samayRadius = gatiRadius + 12;                  // गति-वलय से 12px बाहर
```
- **रंग:** neon-gold `#ffc83c` — यंत्र-वर्ण-सुसंगति
- **head indicators:** ⚡ (गति), ⏳ (समय)
- **अंतिम चरण (samaya<100):** समय-वलय neon-red/pink `#ff005a`

**outerOrbits array — 9 entries (श्वास हटी):**
```js
outerOrbits = [
    { count:shuvhaKarma,      emoji:"🌿", color:"#32ff32", speed:0.8  },  // 0 पुण्य
    { count:ashuvhaKarma,     emoji:"🥀", color:"#ff3232", speed:-0.9 },  // 1 पाप
    { count:prarabdha,        emoji:"📜", color:"#a78bfa", speed:0.6  },  // 2 प्रारब्ध
    { count:activeNaam,       emoji:"ॐ",  color:"#ffffff", speed:1.0  },  // 3 नाम
    { count:kripa,            emoji:"✋", color:"#ffe9a8", speed:0.7  },  // 4 कृपा
    { count:shankha,          emoji:"🐚", color:"#7dd3fc", speed:0.5  },  // 5 शंख
    { count:jyoti,            emoji:"🪔", color:"#ffe932", speed:-0.6 },  // 6 ज्योति
    { count:samarpita,        emoji:"🙏", color:"#fb923c", speed:1.1  },  // 7 समर्पित
    { count:punaraJanmaCount, emoji:"♻️", color:"#f87171", speed:-0.5 },  // 8 पुनर्जन्म
];
```
⚠️ **श्वास (🌬️) अब outerOrbits में नहीं** — कमल-पंखुड़ी वलय (§2.8) से दृश्यित।

**sorting:** हर frame count-ascending sort (count>0 वाले ही draw):
```js
let baseDist = pankhudiRadius + (pankhudiLength * 1.5) + 8;
```

### 2.8 कमल-पंखुड़ी वलय (श्वास का दृश्य-प्रतिनिधित्व)
```js
let PANKHUDI_COUNT    = 10;
let pankhudiRadius    = samayRadius + 3;
let pankhudiLength    = 22;
let pankhudiRotation  = frameNow / 4500;   // ~28s प्रति-चक्कर
let breathBoost       = Math.sin((swaansaTimer / 360) * Math.PI);
```
**तीन अवस्थाएँ:**
- `isConsumed` (p < 10 - swaansa): खर्च — dim/पतली
- `isActive` (p === 10 - swaansa): अभी सांस — 1.5× लंबी, 1.4× चौड़ी, चमकीली gold
- future: सामान्य gold

### 2.9 innerOrbit system (गति↔समय वलयों के बीच)
```js
let outerRadius = gatiRadius + ((samayRadius - gatiRadius) / 2);
let innerOrbit = [
    chetanaaJagrita ? "👁️" : "😴",
    ashuvhaKarma >= 3 ? "⚫" : "☀️",
    purnaSamarpana ? "🙌" : "🤲"
    // + count>0 होने पर: ♻️ 🌿 🥀 📜 ॐ ✋ 🐚 🪔 🙏
];
```

### 2.10 sci-fi विज़ुअल तंत्र
```css
#scifi-scan-sweep   → gold पट्टी ऊपर→नीचे (7s CSS animation), z-index 3
#gameContainer::after → CRT scanlines (repeating gold gradient), z-index 4
```
```js
drawRingTicks(cx, cy, radius, count, color)
drawYantraPolygon(cx, cy, radius, sides, rotation, …)
getMayaSprite(type, bScale)   // shuvha/rikta sprite cache — offscreen canvas
// cyberGrid sprite → radar-grid एक बार pre-render
```

---

## 3. इनपुट मानचित्र

| क्रिया | Keyboard | Gamepad | शास्त्रीय अर्थ |
|---|---|---|---|
| रथ-संचालन | A/D, ←/→ | DPAD L/R (14/15) | इंद्रिय-नियंत्रण |
| नाम-जाप | SPACE | RT (7) | 1 नाम व्यय → फैलती आभा |
| वैराग्य | S, ↓ | X (2) | पुण्य-बंधन रोकें |
| नाम समर्पण | W, ↑ | RB (5) | सिर्फ अंतिम चरण (samaya<100) |
| प्रलय | Q | LB (4) | स्वैच्छिक रथ-त्याग |
| पवित्र पुनर्जन्म | R | LT (6) | कर्म शून्य, नया जीवन |
| शास्त्र | ESC | BACK (8) | ज्ञान-द्वार |
| स्तम्भन | F | START (9) | विराम |
| शंख | Y | Y (0) | cyclone-शमन वलय |
| ज्योति | B | B (1) | पाप-अंधकार में दृष्टि |
| शास्त्र-नेविगेशन | ↑↓ (held) | DPAD U/D (12/13) | scroll |

> ⚠️ `handleShastraGamepadNav()` अब `pollGamepadOnStartScreen()` से भी कॉल होता है।

---

## 4. ऑडियो आर्किटेक्चर

### 4.1 लेयर्ड एम्बिएंट (4 निरंतर लूप)
```
bgMusic         → BG_MUSIC_MP3_LAYER_VOLUME=0.01, स्थिर
shathendriya    → RUNNING_HORSES_VOLUME=0.16, स्थिर (फ़ाइल: ./audio/shathendriya.mp3)
sushuptiBreath  → SUSHUPTI_BREATH_VOLUME=1, श्वास-सिंक — खेल-आरंभ से chetanaaJagrita तक
jagritaBreath   → JAGRITA_BREATH_VOLUME=0.22, श्वास-सिंक — chetanaaJagrita के बाद
```
`sushuptiBreath` व `jagritaBreath` कभी एक साथ नहीं।

**bgMusicVolume slider:** 0–100 → 0.0–1.0 multiplier — सभी layers पर लागू।

### 4.2 Duck Reduction per Layer
```
BG_MUSIC_DUCK_REDUCTION        = 0.75
JAGRITA_BREATH_DUCK_REDUCTION  = 0.55
SUSHUPTI_BREATH_DUCK_REDUCTION = 0.20  // पहले 0.55 — बहुत दब रही थी
RUNNING_HORSES_DUCK_REDUCTION  = 0.15
```

### 4.3 गेटिंग
```js
function isActiveGameplay() {
    return isGameStarted && !gameOver && !won && !isPaused && !isShastraVisible;
}
// setTargetAtTime() से smooth fade — कोई click/pop नहीं
```

### 4.4 Readiness
```
isFontsReady + isAudioPreloadDone + isScaleGameDone → isGameFullyReady
gameReadinessMode = (audioLoadFailures.length === 0) ? 'high' : 'low'
```

### 4.5 Audio Files (28 total)
```
Eager load (22):  naamaSamarpita, samarpita, punaraJanma, shathendriya,
                  sushuptiSwaansa, timer, prarabdhaBandhana, paapaBandhana,
                  punyaBandhana, bandhanaMukta, naamaDhwani, jaapaDhwani,
                  aakarshana, tyaaga, kripaDhwani, shankhaDhwani, jyotiDhwani,
                  shankhaPrapta, jyotiPrapta, purnaSamarpana, drishti, andhakaara

Deferred load (6): bgMusic, chetanaJagrita, pralaya, jagritaBreath,
                   moksha, antimaCharana
```

### 4.6 Edge-detection ध्वनि flags
```
prevGoodKarmaForSound, prevBadKarmaForSound, prevPrarabdhaForSound
prevPulledHorseIndex, prevPurnaSamarpana, prevDrishtiClear (true=☀️)
```

---

## 5. परफ़ॉर्मेंस पैटर्न

1. **Pool pattern** (§2.3) — 4 pools, push/splice कभी नहीं
2. **Bucket-cached gradients** — `cachedBreathGrad`/`cachedTunnelGrad`
3. **DOM throttle** — `lastPunyaAlertSecond` जैसे guards
4. **`updateStatWithPulse()`** — बदलाव पर ही UI update (`oldStats` compare)
5. **mayaSpriteCache** — shuvha/rikta offscreen canvas
6. **cyberGridSprite** — radar-grid एक बार pre-render
7. **floatingText measureText cache** — `_cachedTextWidth/_cachedText`

---

## 6. Change Log Summary

| क्षेत्र | परिवर्तन |
|---|---|
| ग्लो-रिंग | 6 variables → `glowRings` object + 3 helpers |
| माया-रेंडर | duplicate draw → `drawPickupGlowIcon()` |
| resource-संग्रहण | duplicate → `collectResource()` + `RESOURCE_PICKUP_TABLE` |
| माया-साइज़ | nested ternary → `MAYA_SIZE_TABLE` |
| Magic numbers | → named constants (§2.6) |
| ऑडियो | प्रारब्ध-मुक्ति cue जोड़ा |
| Dead code | duplicate .stat-row CSS हटाया |
| मोक्ष-गेट | samarpita>=50 → `chetanaaJagrita` boolean |
| Scroll UX | CSS animation → `e.deltaY` direct (smooth) |
| वलय gap | 9→12px; head-dot → emoji ⚡/⏳ |
| कर्म-कक्षा | dot → emoji rendering |
| शंख/ज्योति | static icon → outerOrbits में |
| कर्म-कक्षा क्रम | fixed → sankhya-ascending dynamic sort |
| **shuvhaKarma** | `activeGoodKarma` → `shuvhaKarma` (पूरे codebase में) |
| **ashuvhaKarma** | `activeBadKarma` → `ashuvhaKarma` |
| **outerOrbits 10→9** | श्वास-orbit हटी → कमल-पंखुड़ी से दृश्यित |
| **कमल-पंखुड़ी वलय** | नई — 10 पंखुड़ियाँ, swaansa दिखाती हैं, breathBoost animation |
| **innerOrbit** | नई — गति↔समय वलयों के बीच status-icons |
| **floatingTextPool** | नया 4th pool — 25 slots, glass-box, text-clamp, measureText cache |
| **mayaSpriteCache** | नया — shuvha/rikta offscreen canvas |
| **sci-fi विज़ुअल** | scan-sweep, CRT scanlines, drawRingTicks, drawYantraPolygon, cyberGrid |
| **वलय रंग** | violet/cyan → neon-gold #ffc83c |
| **grantKripa()** | बंधन हो → kripa--, karma→samarpita; बंधन न हो → kripa++ |
| **cyclone** | player नहीं खींचता; naam-jaap वलय cyclone नहीं छूती |
| **bgMusicVolume** | fix: set था, read नहीं → अब सभी layers पर multiplier |
| **SUSHUPTI duck** | 0.55→0.20 — बहुत दब रही थी |
| **start-screen gamepad** | handleShastraGamepadNav() अब pollGamepadOnStartScreen से भी |
| **toggleShastra() DRY** | ESC/help-btn/close-btn → एक ही function |
| **नाम-जाप draw order** | पंखुड़ियों/outerOrbits के बाद draw |
| **orbit baseDist** | pankhudiRadius + 1.5×pankhudiLength + 8 |
| **कृपा floating-text** | दो texts → एक संयुक्त "✋ॐ" / "✋🙏" |
| **mp3 count** | 24 → 28 loadAudioBuffer() calls |
| **Audio eager/deferred** | 22 eager + 6 deferred — अलग Promise.all batches |
| **line count** | 3733 → 3835 |
| **Developer credit** | PS → Weired Codes |

---

## 7. कार्यप्रणाली व सहयोग-नियम (स्थायी)

1. **डिफ़ॉल्ट: केवल diff** — explicit `old_str`/`new_str` — पूर्ण फ़ाइल तभी जब Dhruv माँगें।
2. **पुष्टि-पहले-कार्रवाई** — scope पुष्टि → फिर diff।
3. **भाषा** — देवनागरी हिंदी, चाहे प्रश्न किसी भी भाषा में।
4. **कोड-शैली** — मॉडुलर, well-commented, truncate नहीं।
5. **मार्गदर्शन पहले** — क्या बदलना है बताएँ → पुष्टि → diff।
6. **शास्त्र-संगति प्राथमिकता** — हर fix/feature शास्त्र-सिद्धांतों के अनुरूप।

---

## 8. खुले प्रश्न

1. **`jaapaNaama = "राधा"`** — नाम-जाप पर floating text, शास्त्र-संगत, अपरिवर्तित।

---

## 9. फ़ाइल त्वरित-नेविगेशन (approx. line numbers — 3835 total)

| पंक्ति | फ़ंक्शन/सेक्शन |
|---|---|
| ~765 | `UI` object |
| ~804 | Glow-Ring System |
| ~870 | Gamepad State + GAMEPAD_BUTTON |
| ~912 | audioCtx, Readiness tracking |
| ~926 | `audioBuffers` object (28 keys) |
| ~983 | `checkReadiness()`, `finalizeReadiness()` |
| ~1032 | `initAudioPreload()` |
| ~1075 | `loadAudioBuffer()` |
| ~1103 | Eager audio batch (22 files) |
| ~1150 | Deferred audio batch (6 files) |
| ~1187 | `startBgMusicMp3Layer()` |
| ~1205 | `startRunningHorsesLayer()` |
| ~1225 | `startJagritaBreathLayer()` |
| ~1252 | `startSushuptiBreathLayer()` |
| ~1303 | `playSound(name)` — SFX dispatcher |
| ~1520 | `duckBackgroundMusic()`, DUCK_STRENGTH |
| ~1558 | `startBackgroundMusic()` |
| ~1575 | `isActiveGameplay()` |
| ~1582 | `updateAmbientVolumes()` |
| ~1642 | Gamepad module |
| ~1780 | `addFloatingText()` |
| ~1801 | `updateStatWithPulse()`, `updateUIStats()` |
| ~1845 | `collectResource()`, RESOURCE_PICKUP_TABLE, MAYA_SIZE_TABLE |
| ~1884 | `drawRingTicks()` |
| ~1907 | Glow-ring helpers (update/draw/reset) |
| ~1935 | `grantKripa()` |
| ~1978 | `getMayaSprite()` — sprite cache |
| ~2023 | cyberGrid sprite |
| ~2077 | `drawPickupGlowIcon()` |
| ~2105 | `drawKarmaChain()` |
| ~2133 | `drawYantraPolygon()` |
| ~2155 | `toggleShastra()` |
| ~2392 | **`update(dt)`** — मुख्य game logic |
| ~2667 | मोक्ष-चेक |
| ~2900 | **`draw()`** — मुख्य render loop |
| ~3213 | गति/समय-वलय render |
| ~3370 | कमल-पंखुड़ी वलय (§2.8) |
| ~3481 | innerOrbit system (§2.9) |
| ~3518 | outerOrbits — sankhya-sorted |
| ~3550 | नाम-जाप वलय (सबसे ऊपर) |
| ~3570 | `scaleGame()`, `gameLoop()` |
| ~3623 | Start-screen gamepad poller |
| ~3674 | `showEndScreen()`, `punahaPrarambha()` |

---

## 10. System Requirements & High/Low Mode

### 10.0 ⚠️ High/Low Mode trigger — हार्डवेयर-जाँच नहीं
```js
gameReadinessMode = (audioLoadFailures.length === 0) ? 'high' : 'low';
// सिर्फ 28 mp3 load सफलता पर — CPU/RAM/GPU से कोई संबंध नहीं
```

| कारक | High Mode | Low Mode |
|---|---|---|
| नेटवर्क | सभी 28 mp3 timeout में लोड | timeout पार → Low |
| Web Audio API | उपलब्ध | पुराना browser → Low |
| सर्वर/CDN | HTTP 200 | CORS/blocker → Low |

### 10.1 Browser requirements
- Chrome/Edge (recommended), Firefox, Safari — evergreen
- HTML5 Canvas 2D, RAF, fetch — अनिवार्य
- Web Audio API — High Mode हेतु

### 10.2 Hardware (60fps — मोड-निर्धारक नहीं)
- CPU: dual-core 2015+ (न्यूनतम), quad-core (अनुशंसित)
- RAM: 4GB (न्यूनतम), 8GB+ (अनुशंसित)
- GPU: integrated पर्याप्त

### 10.3 Browser settings
1. Hardware acceleration ON
2. Foreground tab (background RAF throttle से timer गड़बड़ाता है)
3. Zoom 100% (scaleGame() से conflict)
4. Extensions: aggressive blockers → CDN audio/font block → Low Mode

---

*यह दस्तावेज़ Weired Codes द्वारा `index.html` (3835 lines) के ऑडिट पर आधारित।*
*बड़ा रिफ़ैक्टर/नया feature जुड़ने पर इसे अपडेट करवाएँ।*
