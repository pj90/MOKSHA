# 🕉️ Contributing to मोक्ष

> पहले खेलें, समझें, फिर योगदान करें।
> *First play, understand, then contribute.*

---

## 🚀 Local Setup

```bash
# 1. Clone करें
git clone https://github.com/weirdcodesofficial/MOKSHA.git
cd MOKSHA

# 2. Local server चलाएँ (file:// काम नहीं करता — ES6 modules + audio दोनों block होते हैं)
npx serve .
# OR
python -m http.server 8080

# 3. Browser में खोलें
http://localhost:8080
```

---

## 📁 File Structure — कौन सी file में क्या है

```
MOKSHA/
├── index.html        — HTML shell, start screen, HUD, overlays
├── style.css         — सम्पूर्ण UI styling
├── assets/           — Screenshots और images
├── audio/            — 28 .mp3 files (ambient + SFX)
└── src/
    ├── engine.js     — KarmaEngine: सारा Vedic game logic यहाँ
    ├── audio.js      — AudioManager: Web Audio API, ducking, ambient layers
    ├── render.js     — Renderer: Canvas draw functions, sprite caches
    └── main.js       — Orchestrator: सब modules को जोड़ता है, gameLoop, input
```

### किसमें क्या बदलें?

| बदलाव | File |
|---|---|
| कर्म/मोक्ष logic, physics | `src/engine.js` |
| नई SFX, audio layer | `src/audio.js` |
| Visual, Canvas drawing | `src/render.js` |
| Input, gamepad, HUD wiring | `src/main.js` |
| UI layout, overlays, CSS | `index.html` / `style.css` |

---

## 📜 Code Style Rules

### 1. Pool Pattern — अनिवार्य
```js
// ✅ सही — pool से reuse
for (let i = 0; i < this.mayaPool.length; i++) {
    if (!this.mayaPool[i].active) {
        this.mayaPool[i].active = true;
        // ... set properties
        break;
    }
}

// ❌ गलत — array grow करना
this.mayaPool.push({ ... });   // कभी नहीं
this.mayaPool.splice(i, 1);   // कभी नहीं
```

### 2. DRY Pattern
- नया resource type जोड़ना हो → `MAYA_SIZE_TABLE` और `RESOURCE_PICKUP_TABLE` में entry जोड़ें
- नया glow-ring → `glowRings` object में key जोड़ें, `_updateGlowRing()` reuse करें

### 3. Sprite Cache
- नया emoji orbit में जोड़ना हो → `getEmojiSprite()` automatically cache करेगा
- नया Maya type → `getMayaSprite()` pattern follow करें

### 4. Comments
- हिंदी में comment करें जहाँ Vedic concept explain हो
- English में comment करें जहाँ technical logic हो

---

## 🕉️ शास्त्र-संगति — ज़रूरी पढ़ें

किसी भी mechanic को बदलने से पहले ये rules याद रखें:

| नियम | विवरण |
|---|---|
| मोक्ष-गेट | `chetanaaJagrita` boolean use करें — `samarpita >= 50` नहीं |
| प्रारब्ध | सिर्फ 10-नाम से भस्म होता है — `grantKripa()` इसे नहीं छूती |
| cyclone | player को नहीं खींचता — सिर्फ shuvha/rikta माया को |
| naam-jaap वलय | cyclone को affect नहीं करती — सिर्फ शंख-वलय (Y) करती है |
| पुण्य | बंधन है — पाप जितना ही हानिकारक, सिर्फ अलग तरह से |

---

## 🔧 PR Guidelines

1. **पहले issue बनाएँ** — bug हो या feature, पहले discuss करें
2. **Diff-only** — पूरी file मत बदलें, सिर्फ जो ज़रूरी हो
3. **Test करके भेजें** — locally `npx serve .` पर खेलकर confirm करें
4. **Commit message format:**
```
fix: description of bug fixed
feat: description of new feature
docs: documentation update
refactor: code restructure
```
5. **शास्त्र-संगति** — कोई भी mechanic change Vedic philosophy के विरुद्ध नहीं होना चाहिए

---

## ❓ सवाल हो तो

GitHub Issues खोलें → label `question` लगाएँ।

*Developed by [Weired Codes](https://github.com/weirdcodesofficial)*
