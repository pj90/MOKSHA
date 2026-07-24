/**
 * ============================================================
 * src/physics.js — मोक्ष PhysicsMixin
 * ============================================================
 *
 * engine.js से निकाले गए physics/visual helper methods।
 * Mixin pattern: KarmaEngine.prototype पर assign होता है।
 * इससे `this` engine instance को refer करता है — zero breaking changes।
 *
 * ── इसमें हैं ──────────────────────────────────────────────
 *  • _isPlayerInsideTunnel()
 *  • _updateGlowRing()
 *  • _resetAllGlowRings()
 *  • _createExplosion()
 *  • _createGainedGlow()
 *  • _addFloatingText()
 *  • _triggerGlow()
 *  • _triggerBlast()
 *
 * ── engine.js में उपयोग ──────────────────────────────────
 *  import { PhysicsMixin } from './physics.js';
 *  Object.assign(KarmaEngine.prototype, PhysicsMixin);
 * ============================================================
 */

export const PhysicsMixin = {

    /**
     * क्या player अभी tunnel के अंदर है?
     * @returns {boolean}
     */
    _isPlayerInsideTunnel() {
        const buffer = 4;
        return (
            this.player.x >= (this.TUNNEL_X - buffer) &&
            (this.player.x + this.player.width) <= (this.TUNNEL_X + this.TUNNEL_WIDTH + buffer)
        );
    },

    /**
     * Glow-ring विस्तार (DRY — §2.4)।
     * @param {Object}   ring   — glowRings.jyoti / .shankha / .kripa
     * @param {number}   dt
     * @param {Function} onTick — optional (शंख-वलय के cyclone-check हेतु)
     */
    _updateGlowRing(ring, dt, onTick) {
        if (!ring.active) return;
        ring.radius += ring.speed * dt;
        if (onTick) onTick(ring);
        if (ring.radius > ring.maxRadius) {
            ring.active = false;
            ring.radius = 0;
        }
    },

    /**
     * सभी glow-rings निष्क्रिय/reset करें।
     * punahaPrarambha (reset) में प्रयुक्त।
     */
    _resetAllGlowRings() {
        for (let key in this.glowRings) {
            this.glowRings[key].active = false;
            this.glowRings[key].radius = 0;
        }
    },

    /**
     * Explosion particles spawn — pool pattern (§2.3)।
     * @param {number} x, y   — world position
     * @param {string} color  — particle color
     */
    _createExplosion(x, y, color) {
        let spawned = 0;
        for (let i = 0; i < this.particlePool.length && spawned < 10; i++) {
            let p = this.particlePool[i];
            if (!p.active) {
                p.active = true;
                p.x      = x; p.y = y;
                p.vx     = (Math.random() - 0.5) * 5;
                p.vy     = (Math.random() - 0.5) * 5;
                p.radius = Math.random() * 1.8 + 0.5;
                p.color  = color;
                p.alpha  = 1;
                spawned++;
            }
        }
    },

    /**
     * Gained-glow ring spawn — pool pattern (§2.3)।
     * @param {number} x, y   — world position
     * @param {string} color  — glow color
     */
    _createGainedGlow(x, y, color) {
        for (let i = 0; i < this.glowEffectPool.length; i++) {
            let g = this.glowEffectPool[i];
            if (!g.active) {
                g.active    = true;
                g.x         = x; g.y = y;
                g.radius    = 4;
                g.maxRadius = 26;
                g.color     = color;
                g.alpha     = 1;
                break;
            }
        }
    },

    /**
     * FloatingText activate करें — pool pattern (§2.3)।
     * कोई push नहीं — पहला inactive slot reuse।
     *
     * @param {string} text
     * @param {string} color
     * @param {Object} opts — { x, y, yOffset, alpha, vy, isBigName }
     */
    _addFloatingText(text, color, opts = {}) {
        const baseX = opts.x ?? (this.player.x + this.player.width / 2);
        const baseY = opts.y ?? this.player.y;
        for (let i = 0; i < this.floatingTextPool.length; i++) {
            let ft = this.floatingTextPool[i];
            if (ft.active) continue;
            ft.active    = true;
            ft.x         = baseX + (Math.random() * 20 - 10);
            ft.y         = baseY + (opts.yOffset ?? 10);
            ft.text      = text;
            ft.color     = color;
            ft.alpha     = opts.alpha ?? 1.0;
            ft.vy        = opts.vy ?? (-1 - Math.random() * 0.5);
            ft.isBigName = opts.isBigName || false;
            // text cache invalidate — नया text होने पर width recalculate होगा
            if (ft._cachedText !== text) {
                ft._cachedTextWidth = undefined;
                ft._cachedText      = text;
            }
            return;
        }
        // सभी slots व्यस्त — silently skip (pool-integrity बनाए रखें)
    },

    /**
     * Body-glow timer set करें।
     * @param {string} color
     */
    _triggerGlow(color) {
        this.bodyGlowTimer = 40;
        this.bodyGlowColor = color;
    },

    /**
     * Explosion + glow एक साथ trigger करें।
     * @param {string} color
     */
    _triggerBlast(color) {
        this._createExplosion(
            this.player.x + this.player.width  / 2,
            this.player.y + this.player.height / 2,
            color
        );
        this._triggerGlow("#fb923c");
    },
};
