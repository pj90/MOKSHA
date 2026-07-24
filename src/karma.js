/**
 * ============================================================
 * src/karma.js — मोक्ष KarmaMixin
 * ============================================================
 *
 * engine.js से निकाले गए Vedic karma logic methods।
 * Mixin pattern: KarmaEngine.prototype पर assign होता है।
 * इससे `this` engine instance को refer करता है — zero breaking changes।
 *
 * ── इसमें हैं ──────────────────────────────────────────────
 *  • _syncOrbitCounts()
 *  • _checkMokhsha()
 *  • _spawnMaya()
 *  • _handlePlayerMayaCollision()
 *  • _grantKripa()
 *  • _collectResource()
 *
 *  Keyboard Actions:
 *  • actionNaamaJaapa()
 *  • actionShankha()
 *  • actionJyoti()
 *  • actionNaamaSamarpan()
 *  • actionVairaagya()
 *  • actionPralaya()
 *  • actionPause()
 *  • actionResume()
 *
 * ── engine.js में उपयोग ──────────────────────────────────
 *  import { KarmaMixin } from './karma.js';
 *  Object.assign(KarmaEngine.prototype, KarmaMixin);
 * ============================================================
 */

import { SAMAYA_PRAARAMBHIKA, MAYA_SIZE_TABLE, RESOURCE_PICKUP_TABLE } from './engine.js';

export const KarmaMixin = {

    // ====================== ORBIT SYNC ======================

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
    },

    // ====================== मोक्ष-चेक ======================

    /**
     * ब्रह्मांडीय क्षितिज पर मोक्ष-शर्त जाँचे।
     * swaansaSamapta === true होने पर हर frame चलता है।
     */
    _checkMokhsha() {
        // ── मोक्ष-शर्त (§1.2) ──
        if (
            this.shuvhaKarma    === 0 &&
            this.ashuvhaKarma   === 0 &&
            !this._pendingGoodKarma   &&
            this.prarabdha      === 0 &&
            this.chetanaaJagrita      &&
            this.purnaSamarpana
        ) {
            if (this._UI?.samayaVal)  this._UI.samayaVal.innerText  = `मोक्ष 🌿`;
            if (this._UI?.swaansaVal) this._UI.swaansaVal.innerText = `0`;
            if (!this.gameOver) {
                this.gameOver = true;
                this.won      = true;
                this.showEndScreen();
            }
            return;
        }

        // ── पुनर्जन्म (अपवित्र/पवित्र) ──
        const isApavitra = (this.shuvhaKarma > 0 || this.ashuvhaKarma > 0 || this.prarabdha > 0);
        const earnsKripaOnRebirth = (
            this.activeNaam >= 20 || this.samarpita >= 30 || this.chetanaaJagrita
        );
        const gainedPrarabdha = (this.shuvhaKarma + this.ashuvhaKarma) +
                                 (this._pendingGoodKarma ? this._pendingGoodKarmaCount : 0);

        if (this._pendingGoodKarma) {
            this.prarabdha           += this._pendingGoodKarmaCount;
            this._pendingGoodKarma    = false;
            this._punyaTimer          = 0;
            this._pendingGoodKarmaCount = 0;
        }
        this.prarabdha += (this.shuvhaKarma + this.ashuvhaKarma);
        if (gainedPrarabdha > 0) this._addFloatingText(`+${gainedPrarabdha} 📜`, "#a78bfa");

        this.ashuvhaKarma = 0; this.shuvhaKarma = 0;
        this.punaraJanmaCount++;
        this._triggerBlast("#f87171");
        this.samaya          = SAMAYA_PRAARAMBHIKA;
        this.swaansa         = 10;
        this.swaansaSamapta  = false;
        this._timerTickAccumulator = 0;
        this._timerSoundPlayed     = false;

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
            this._createGainedGlow(
                this.player.x + this.player.width  / 2,
                this.player.y + this.player.height / 2,
                "#ffe9a8"
            );
            this._addFloatingText("✋", "#ffe9a8", { alpha:1.3, vy:-1.6, isBigName:true });
            if (this.activeNaam  >= 20) this._addFloatingText("ॐ", "#ffffff", { alpha:1.5, vy:-2.2, isBigName:true });
            if (this.samarpita   >= 30) this._addFloatingText("🙏", "#fb923c", { alpha:1.5, vy:-2.2, isBigName:true });
            this._updateAlert("🙏 अतिरिक्त कृपा लेकर नए जीवन में प्रवेश!", "#ffe9a8");
            this._triggerGlow("#ffe9a8");
            this._cb.playSound?.('kripa');
        }
        this._cb.playSound?.('punaha');
    },

    // ====================== माया SPAWN ======================

    /**
     * Maya spawn logic — spawnTimer overflow पर एक entity spawn।
     */
    _spawnMaya() {
        const rand = Math.random();
        let type = "rikta"; let xPos;

        // कृपा-factor: प्रति-कृपा 5% माया-अनुपात बदलाव
        const kripaFactor     = this.kripa * 0.05;
        const shuvhaThreshold = Math.max(0.10, 0.425 - (kripaFactor * 1.5));
        const freedFromPaapa  = 0.425 - shuvhaThreshold;
        const punyaProb       = 0.425 + freedFromPaapa * 0.4;
        const naamaThreshold  = shuvhaThreshold + punyaProb;

        if      (rand > 0.985)           { type = "kripa";   xPos = Math.random() * (this.WIDTH - 110) + 40; }
        else if (rand > 0.97)            { type = "cyclone"; xPos = Math.random() * (this.WIDTH - 110) + 40; }
        else if (rand > 0.945)           { type = "shankha"; xPos = Math.random() * (this.WIDTH - 110) + 40; }
        else if (rand > 0.92)            { type = "jyoti";   xPos = Math.random() * (this.WIDTH - 110) + 40; }
        else if (rand > naamaThreshold)  { type = "naama";   xPos = this.TUNNEL_X + Math.random() * (this.TUNNEL_WIDTH - 20); }
        else if (rand > shuvhaThreshold) { type = "shuvha";  xPos = Math.random() * (this.WIDTH - 110) + 40; }
        else                             { type = "rikta";   xPos = Math.random() * (this.WIDTH - 110) + 40; }

        for (let i = 0; i < this.mayaPool.length; i++) {
            if (!this.mayaPool[i].active) {
                const sizeInfo = MAYA_SIZE_TABLE[type] || MAYA_SIZE_TABLE.default;
                this.mayaPool[i].active   = true;
                this.mayaPool[i].x        = xPos;
                this.mayaPool[i].y        = -30;
                this.mayaPool[i].width    = sizeInfo.width;
                this.mayaPool[i].height   = sizeInfo.height;
                this.mayaPool[i].type     = type;
                this.mayaPool[i].isPulling = false;
                break;
            }
        }
    },

    // ====================== COLLISION ======================

    /**
     * Player-Maya direct collision handler।
     * उपयुक्त Vedic logic apply करता है।
     */
    _handlePlayerMayaCollision(m, cx) {
        if (m.type === "naama") {
            this.activeNaam++;
            this._addFloatingText("ॐ", "#ffffff");
            this.naamaGlowTimer = 40;
            this._triggerGlow("#ffffff");
            this._cb.playSound?.('naama');
            this._updateAlert("🌿 नाम सुमिरन: शुद्धिकरण...", "#ffff00");

            if (this.playerInTunnel) {
                // शास्त्र-संगत क्रम: पुण्य → पाप → प्रारब्ध
                if (this.shuvhaKarma > 0 && this.activeNaam >= 1) {
                    this.activeNaam--; this.shuvhaKarma--; this.samarpita++;
                    this._addFloatingText("🌸", "#32ff32");
                    this._triggerGlow("#32ff32");
                    this._cb.playSound?.('samarpita');
                } else if (this.ashuvhaKarma > 0 && this.activeNaam >= 5) {
                    this.activeNaam -= 5; this.ashuvhaKarma--; this.samarpita++;
                    this._addFloatingText("💧", "#ff3232");
                    this._triggerGlow("#ff3232");
                    this._cb.playSound?.('samarpita');
                } else if (this.prarabdha > 0 && this.activeNaam >= 10) {
                    this.activeNaam -= 10; this.prarabdha--; this.samarpita++;
                    this._addFloatingText("⚖️", "#a78bfa");
                    this._triggerGlow("#a78bfa");
                    this._cb.playSound?.('samarpita');
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
            const pushDir   = (cx < cycloneCx) ? -1 : 1;
            this.player.x   = Math.max(0, Math.min(
                this.WIDTH - this.player.width,
                this.player.x + pushDir * 200
            ));
            this._addFloatingText("🌪️", "#aaaaaa", { x: m.x + m.width / 2, y: m.y });
            this._cb.vibrateGamepad?.(0.4, 0.6, 180);
            this._updateAlert("🌪️ विक्षेप: चक्रवात ने रथ को झकझोरा!", "#aaaaaa");
            return; // m.active = false नहीं — cyclone यथावत
        } else if (m.type === "shuvha") {
            if (!this._pendingGoodKarma) {
                this._pendingGoodKarma = true;
                this._punyaTimer       = 180;
            }
            this._pendingGoodKarmaCount++;
            this._cb.playSound?.('shuvha');
        } else {
            // rikta (पाप)
            this.ashuvhaKarma++;
            this._addFloatingText("🥀", "#ff3232");
            this._triggerBlast("#ff3232");
            this._cb.playSound?.('ashuvha');
            this._updateAlert("🚨 पाप हमला!", "#ff3232");
        }
        m.active = false;
    },

    // ====================== वैदिक HELPERS ======================

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
            this.shuvhaKarma  = 0;
            this.ashuvhaKarma = 0;
            // ⚠️ प्रारब्ध जानबूझकर अप्रभावित — पूर्व-जन्मों का भार
        } else {
            this.kripa++;
        }

        const px = x ?? (this.player.x + this.player.width  / 2);
        const py = y ?? (this.player.y + this.player.height / 2);
        this._createGainedGlow(px, py, "#ffe9a8");

        if (reason === 'naam')
            this._addFloatingText("✋ॐ",  "#ffffff", { x:px, y:py, alpha:1.5, vy:-2.2, isBigName:true });
        else if (reason === 'samarpita')
            this._addFloatingText("✋🙏", "#fb923c", { x:px, y:py, alpha:1.5, vy:-2.2, isBigName:true });
        else
            this._addFloatingText("✋",   "#ffe9a8", { x:px, y:py, alpha:1.3, vy:-1.6, isBigName:true });

        if (hadKarma) {
            const bandhanX = this.player.x + this.player.width  / 2;
            const bandhanY = this.player.y + this.player.height / 2 + 50;
            this._createExplosion(bandhanX, bandhanY, "#ffe9a8");
            this._addFloatingText(`+${freedKarma} 🙏`, "#ffe9a8", { x:bandhanX, y:bandhanY - 20 });
        }

        this._triggerGlow("#ffe9a8");
        this._cb.playSound?.('kripa');
        this._updateAlert(
            hadKarma
                ? "✋ कृपा: सारथी के सभी सांसारिक पुण्य-पाप समर्पित हुए।"
                : "✋ कृपा प्राप्त हुई।",
            "#ffe9a8"
        );
        this.glowRings.kripa.active = true;
        this.glowRings.kripa.radius = 0;
    },

    /**
     * Resource-collect helper (DRY: शंख/ज्योति दोनों के लिए)।
     * @param {string} type — 'shankha' | 'jyoti'
     * @param {number} x, y — world position
     * @param {Object} opts — { withGainedGlow, alert }
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
    },

    // ====================== KEYBOARD ACTIONS ======================

    /**
     * SPACE / RT — नाम-जाप शुरू करें
     */
    actionNaamaJaapa() {
        if (this.gameOver || this.isPaused) return;
        if (this.activeNaam >= 1 && !this.isNaamaJaapa) {
            this.naamaJaapaPower = this.activeNaam;
            this.activeNaam--;
            this.isNaamaJaapa = true;
            this.naamaGhera   = this.smoothSize / 2;
            this._cb.playSound?.('jaapa');
            this._updateAlert("🌿 नाम जपते मंगल दिसि दसहूँ 🌿", "#ffff00");
            this._addFloatingText(this.jaapaNaama, "#ffff00", { yOffset:-10, alpha:1.5, vy:-2, isBigName:true });
        } else if (this.activeNaam === 0 && !this.isNaamaJaapa) {
            this._updateAlert("❌ नाम जाप के लिए नाम की आवश्यकता है!", "#ff3232");
            this._cb.playSound?.('rikta');
        }
    },

    /**
     * Y / Gamepad-Y — शंख-वलय शुरू करें
     */
    actionShankha() {
        if (this.gameOver || this.isPaused) return;
        if (this.shankha > 0) {
            this.shankha--;
            this.glowRings.shankha.active = true;
            this.glowRings.shankha.radius = 0;
            this._cb.playSound?.('shankhaDhwani');
            this._updateAlert("🐚 शंख-ध्वनि: श्वेत प्रकाश फैल रहा है...", "#ffffff");
        } else {
            this._updateAlert("❌ शंख-शक्ति समाप्त — पहले शंख संग्रह करें।", "#ff3232");
            this._cb.playSound?.('rikta');
        }
    },

    /**
     * B / Gamepad-B — ज्योति-वलय शुरू करें
     */
    actionJyoti() {
        if (this.gameOver || this.isPaused) return;
        if (this.jyoti > 0) {
            this.jyoti--;
            this.glowRings.jyoti.active = true;
            this.glowRings.jyoti.radius = 0;
            this._cb.playSound?.('jyotiDhwani');
            this._updateAlert("🪔 ज्योति जली: पाप-अंधकार में प्रकाश फैल रहा है...", "#ffe932");
        } else {
            this._updateAlert("❌ ज्योति-शक्ति समाप्त — पहले ज्योति संग्रह करें।", "#ff3232");
            this._cb.playSound?.('rikta');
        }
    },

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
        this.samarpita      += gained;
        this.activeNaam      = 0;
        this.kripa           = 0;
        this.shankha         = 0;
        this.jyoti           = 0;
        this.purnaSamarpana  = true;
        this.isKarmaImmune   = true;
        this._addFloatingText(`+${gained} ॐ🙏`, "#ffff00", { alpha:1.5, vy:-2, isBigName:true, yOffset:-10 });
        this._updateAlert("🌿 नाम समर्पित: +" + gained + " मिले।", "#ffff00");
        this._cb.playSound?.('naamaSamarpita');
    },

    /**
     * S / ↓ / X — वैराग्य (पुण्य-प्रलोभन त्यागें)
     */
    actionVairaagya() {
        if (this.gameOver || this.isPaused) return;
        if (this._pendingGoodKarma) {
            let gained = this._pendingGoodKarmaCount;
            this.samarpita           += gained;
            this._pendingGoodKarma    = false;
            this._punyaTimer          = 0;
            this._pendingGoodKarmaCount = 0;
            this._addFloatingText(`+${gained} 🙏`, "#fb923c");
            this._triggerBlast("#32ff32");
            this._cb.playSound?.('samarpita');
            this._updateAlert("🛑 वैराग्य: सारथी ने पुण्य का प्रलोभन ठुकराया।", "#ff3232");
        } else {
            this._cb.playSound?.('rikta');
        }
    },

    /**
     * Q / LB — प्रलय (FORCE STOP)
     */
    actionPralaya() {
        if (this.gameOver) return;
        this.gameOver = true;
        this.won      = false;
        this.showEndScreen("FORCE STOPPED");
        this._cb.playSound?.('takraava');
    },

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
        this._cb.playSound?.(this.isPaused ? 'viraama' : 'resume');
        this._cb.updateAmbientVolumes?.();
        return this.isPaused;
    },

    /**
     * Resume (resume-btn click)
     */
    actionResume() {
        this.isPaused = false;
        if (this._UI?.viraamaOverlay) this._UI.viraamaOverlay.style.display = 'none';
        this._cb.playSound?.('resume');
    },
};
