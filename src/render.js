// src/render.js

let ctx = null;

// ====================== ⚡ कैशिंग (Caching) ======================
const mayaSpriteCache = {};
const emojiSpriteCache = {};
let cachedBuddhiSprite = null;
let cachedBuddhiSRadiusKey = -1;
let cachedAtmanSprite = null;
let cachedAtmanGlowKey = -1;
let cachedBreathGrad = null;
let cachedBreathGradBucket = -1;
let cachedTunnelGrad = null;
let cachedTunnelGradBucket = -1;
let sciFiGridSprite = null;

// ====================== 🎨 स्प्राइट और हेल्पर फंक्शन्स ======================

function buildSciFiGridSprite(WIDTH, HEIGHT) {
    const off = document.createElement('canvas');
    off.width = WIDTH; off.height = HEIGHT;
    const octx = off.getContext('2d');
    const gx = WIDTH / 2, gy = HEIGHT / 2;
    const maxR = Math.hypot(WIDTH, HEIGHT) / 2;

    octx.strokeStyle = "rgba(255, 215, 0, 0.05)";
    octx.lineWidth = 1;
    for (let r = 70; r < maxR; r += 70) {
        octx.beginPath(); octx.arc(gx, gy, r, 0, Math.PI * 2); octx.stroke();
    }

    octx.strokeStyle = "rgba(255, 215, 0, 0.04)";
    for (let i = 0; i < 12; i++) {
        let angle = (Math.PI * 2 / 12) * i;
        octx.beginPath(); octx.moveTo(gx, gy);
        octx.lineTo(gx + Math.cos(angle) * maxR, gy + Math.sin(angle) * maxR);
        octx.stroke();
    }

    octx.strokeStyle = "rgba(255, 215, 0, 0.18)";
    octx.lineWidth = 1.5;
    const bl = 22, m = 12;
    const corners = [[m, m, 1, 1], [WIDTH - m, m, -1, 1], [m, HEIGHT - m, 1, -1], [WIDTH - m, HEIGHT - m, -1, -1]];
    corners.forEach(([x, y, dx, dy]) => {
        octx.beginPath(); octx.moveTo(x, y + bl * dy); octx.lineTo(x, y); octx.lineTo(x + bl * dx, y); octx.stroke();
    });
    return off;
}

function getMayaSprite(type, bScale) {
    const key = type + '_' + bScale;
    if (mayaSpriteCache[key]) return mayaSpriteCache[key];

    const baseSize = 20;
    const w = baseSize * bScale;
    const r = (w / 2) * 1.2;
    const pad = 4;
    const canvasSize = Math.ceil((r * 2) + pad * 2);

    const off = document.createElement('canvas');
    off.width = canvasSize; off.height = canvasSize;
    const octx = off.getContext('2d');
    const cx = canvasSize / 2, cy = canvasSize / 2;

    const isShuvha = type === 'shuvha';
    const midColor = isShuvha ? '#32ff32' : '#ff3232';
    const darkColor = isShuvha ? '#004400' : '#440000';
    const strokeColor = isShuvha ? 'rgba(50, 255, 50, 0.8)' : 'rgba(255, 50, 50, 0.8)';
    const symbol = isShuvha ? '🌿' : '🥀';

    const grad = octx.createRadialGradient(cx, cy - r * 0.3, 0, cx, cy, r);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.4, midColor); grad.addColorStop(1, darkColor);
    octx.fillStyle = grad;
    octx.beginPath(); octx.arc(cx, cy, r, 0, Math.PI * 2); octx.fill();
    octx.strokeStyle = strokeColor; octx.lineWidth = 1.5; octx.stroke();

    octx.fillStyle = '#ffffff';
    octx.font = Math.max(14, 18 * bScale) + "px 'Orbitron', sans-serif";
    octx.textAlign = 'center'; octx.textBaseline = 'middle';
    octx.fillText(symbol, cx, cy);

    mayaSpriteCache[key] = { canvas: off, size: canvasSize };
    return mayaSpriteCache[key];
}

function getEmojiSprite(emoji, fontSize) {
    const roundedSize = Math.round(fontSize / 2) * 2;
    const key = emoji + '_' + roundedSize;
    if (emojiSpriteCache[key]) return emojiSpriteCache[key];
    const pad = 6;
    const sz = roundedSize + pad * 2;
    const off = document.createElement('canvas');
    off.width = sz; off.height = sz;
    const octx = off.getContext('2d');
    octx.fillStyle = "#ffffff"; 
    octx.font = roundedSize + "px 'Noto Sans Devanagari',sans-serif";
    octx.textAlign = "center"; octx.textBaseline = "middle";
    octx.fillText(emoji, sz / 2, sz / 2);
    emojiSpriteCache[key] = { canvas: off, sz };
    return emojiSpriteCache[key];
}

function drawRingTicks(cxr, cyr, radius, count, color) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.globalAlpha = 0.35;
    const tickLen = 4;
    for (let i = 0; i < count; i++) {
        let angle = (Math.PI * 2 / count) * i;
        let x1 = cxr + Math.cos(angle) * (radius - tickLen / 2);
        let y1 = cyr + Math.sin(angle) * (radius - tickLen / 2);
        let x2 = cxr + Math.cos(angle) * (radius + tickLen / 2);
        let y2 = cyr + Math.sin(angle) * (radius + tickLen / 2);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    ctx.restore();
}

function drawGlowRing(cx, cy, ring) {
    if (!ring.active) return;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2);
    ctx.lineWidth = 3 + (ring.radius * ring.lineWidthMul);
    ctx.strokeStyle = ring.strokeColor;
    ctx.shadowBlur = ring.shadowBlur; ctx.shadowColor = ring.glowColor;
    ctx.stroke();
    ctx.fillStyle = ring.fillColor; ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowColor = "transparent";
    ctx.restore();
}

function drawPickupGlowIcon(cx, cy, bScale, icon, midColorRGB, midAlpha, shadowColor, frameNow, pulseSpeed = 130, pulseAmp = 4) {
    let r = 16 * bScale;
    let pulse = (Math.sin(frameNow / pulseSpeed) + 1) / 2;
    ctx.save();
    let grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r + 8 + pulse * pulseAmp);
    grad.addColorStop(0, "rgba(255,255,255,0.95)");
    grad.addColorStop(0.5, `rgba(${midColorRGB},${midAlpha})`);
    grad.addColorStop(1, `rgba(${midColorRGB},0)`);
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(cx, cy, r + 10, 0, Math.PI * 2); ctx.fill();
    ctx.font = (16 * bScale) + "px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowBlur = 10; ctx.shadowColor = shadowColor; ctx.fillStyle = "#ffffff";
    ctx.fillText(icon, cx, cy);
    ctx.shadowBlur = 0; ctx.shadowColor = "transparent";
    ctx.restore();
}

function drawCenteredRow(cx, y, count, gap, drawFn) {
    const totalWidth = (count - 1) * gap;
    const startCx = cx - totalWidth / 2;
    for (let i = 0; i < count; i++) {
        drawFn(startCx + i * gap, y, i);
    }
}

function drawKarmaChain(cx, baseY, color, strength = 1, isHeavy = false, frameNow) {
    ctx.save();
    let swayPeriod = isHeavy ? 480 : 200;
    let pulse = Math.sin(frameNow / swayPeriod) * (isHeavy ? 7 : 5);
    let weightDropOffset = isHeavy ? (strength * 12) : 0;
    let y = baseY + pulse + weightDropOffset;
    let fontSize = isHeavy ? (32 + strength * 16) : (22 + strength * 14);
    
    ctx.font = `${fontSize}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = color; ctx.shadowBlur = isHeavy ? (35 + strength * 30) : (25 + strength * 20);
    ctx.fillText(isHeavy ? "📜" : "⛓️", cx, y);
    ctx.shadowBlur = isHeavy ? 18 : 12;
    ctx.fillText(isHeavy ? "📜" : "⛓️", cx, y);
    ctx.restore();
}

function drawYantraPolygon(cx, cy, radius, sides, rotation, strokeStyle, lineWidth, shadowColor, shadowBlur) {
    ctx.save();
    ctx.shadowColor = shadowColor; ctx.shadowBlur = shadowBlur;
    ctx.strokeStyle = strokeStyle; ctx.lineWidth = lineWidth;
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
        let angle = rotation + i * (2 * Math.PI / sides);
        let px = cx + radius * Math.cos(angle);
        let py = cy + radius * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.stroke();
    ctx.shadowBlur = 0; ctx.shadowColor = "transparent";
    ctx.restore();
}

// ====================== 🎬 मुख्य रेंडरर मॉड्यूल (Main Renderer Module) ======================

export const Renderer = {
    init(context, WIDTH, HEIGHT) {
        ctx = context;
        sciFiGridSprite = buildSciFiGridSprite(WIDTH, HEIGHT);
    },

    drawScene(state) {
        // स्टेट से सभी आवश्यक वेरिएबल्स को एक्सट्रेक्ट करें (Zero Garbage Collection)
        const {
            WIDTH, HEIGHT, TUNNEL_X, TUNNEL_WIDTH, SAMAYA_PRAARAMBHIKA,
            frameNow, shakeTimer, samaya, swaansaSamapta, stars, tunnelSparkles,
            particlePool, glowEffectPool, player, smoothSize, glowRings,
            shuvhaKarma, ashuvhaKarma, prarabdha, activeNaam, kripa, shankha, jyoti,
            samarpita, punaraJanmaCount, chetanaaJagrita, purnaSamarpana, chainSlots,
            finalHorsePositions, pulledHorseIndex, pulledHorseX, pulledHorseY,
            isPaused, gameOver, mayaPool, pendingGoodKarma, punyaTimer,
            pendingGoodKarmaCount, floatingTextPool, isNaamaJaapa, naamaGhera,
            outerOrbits, notifyTimer, notifyText, swaansaTimer, swaansa,
            naamaGlowTimer, bodyGlowTimer, bodyGlowColor
        } = state;

        let totalKarma = shuvhaKarma + ashuvhaKarma;

        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        ctx.shadowBlur = 0; ctx.shadowColor = "transparent"; ctx.save();
        if (shakeTimer > 0) { const sv = (Math.random() - 0.5) * 5; ctx.translate(sv, -sv); }

        ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
        if (samaya < 100 && !swaansaSamapta) { ctx.fillStyle = "rgba(255, 0, 0, " + (1 - samaya / 100) * 0.35 + ")"; ctx.fillRect(0, 0, WIDTH, HEIGHT); }

        ctx.save();
        let worldBreathPhase = swaansaTimer / 360;
        let worldBreathPulse = (Math.sin(worldBreathPhase * Math.PI * 2 - Math.PI / 2) + 1) / 2;
        
        // Audio Manager calls (window पर उपलब्ध)
        if (window.AudioManager) {
            window.AudioManager.breathPulseGlobal = worldBreathPulse;
            window.AudioManager.updateDuckDecay();
            window.AudioManager.updateAmbientVolumes();
        }

        ctx.globalCompositeOperation = 'screen';
        let breathGradBucket = Math.round(worldBreathPulse * 24);
        if (breathGradBucket !== cachedBreathGradBucket || !cachedBreathGrad) {
            cachedBreathGradBucket = breathGradBucket;
            cachedBreathGrad = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 120 + worldBreathPulse * 180, WIDTH / 2, HEIGHT / 2, WIDTH * 0.8);
            cachedBreathGrad.addColorStop(0, "rgba(147, 197, 253, 0)"); cachedBreathGrad.addColorStop(1, "rgba(147, 197, 253, " + (0.1 + worldBreathPulse * 0.4) + ")");
        }
        ctx.fillStyle = cachedBreathGrad; ctx.fillRect(0, 0, WIDTH, HEIGHT); ctx.restore();

        ctx.save(); let edgeIntensity = (samaya < 100) ? (1 - samaya / 100) : 0;
        let tunnelGradBucket = Math.round(edgeIntensity * 24);
        if (tunnelGradBucket !== cachedTunnelGradBucket || !cachedTunnelGrad) {
            cachedTunnelGradBucket = tunnelGradBucket;
            cachedTunnelGrad = ctx.createLinearGradient(TUNNEL_X, 0, TUNNEL_X + TUNNEL_WIDTH, 0);
            cachedTunnelGrad.addColorStop(0, "rgba(255, 0, 200, " + (0.02 + edgeIntensity * 0.15) + ")");
            cachedTunnelGrad.addColorStop(0.5, "rgba(0, 240, 255, " + (0.1 + edgeIntensity * 0.45) + ")");
            cachedTunnelGrad.addColorStop(1, "rgba(255, 0, 200, " + (0.02 + edgeIntensity * 0.15) + ")");
        }
        ctx.fillStyle = cachedTunnelGrad; ctx.fillRect(TUNNEL_X, 0, TUNNEL_WIDTH, HEIGHT);

        ctx.save(); ctx.shadowBlur = 8; ctx.shadowColor = "#00f0ff";
        ctx.fillStyle = "rgba(120, 245, 255, 0.65)";
        ctx.beginPath();
        tunnelSparkles.forEach(sparkle => {
            if (Math.floor(sparkle.x + sparkle.y) % 2 === 0) {
                ctx.moveTo(sparkle.x + sparkle.size, sparkle.y);
                ctx.arc(sparkle.x, sparkle.y, sparkle.size, 0, Math.PI * 2);
            }
        });
        ctx.fill();
        ctx.beginPath();
        tunnelSparkles.forEach(sparkle => {
            if (Math.floor(sparkle.x + sparkle.y) % 2 !== 0) {
                ctx.rect(sparkle.x, sparkle.y, sparkle.size * 1.5, sparkle.size * 1.5);
            }
        });
        ctx.fill();
        ctx.restore();

        ctx.shadowBlur = 22 + (edgeIntensity * 25); ctx.shadowColor = "#ff00c8";
        ctx.strokeStyle = "rgba(255, 0, 200, " + (0.35 + edgeIntensity * 0.35) + ")"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(TUNNEL_X, 0); ctx.lineTo(TUNNEL_X, HEIGHT); ctx.moveTo(TUNNEL_X + TUNNEL_WIDTH, 0); ctx.lineTo(TUNNEL_X + TUNNEL_WIDTH, HEIGHT); ctx.stroke();

        ctx.shadowBlur = 12 + (edgeIntensity * 20); ctx.shadowColor = "#00f0ff";
        ctx.strokeStyle = "rgba(0, 240, 255, " + (0.7 + edgeIntensity * 0.3) + ")"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(TUNNEL_X, 0); ctx.lineTo(TUNNEL_X, HEIGHT); ctx.moveTo(TUNNEL_X + TUNNEL_WIDTH, 0); ctx.lineTo(TUNNEL_X + TUNNEL_WIDTH, HEIGHT); ctx.stroke();

        let scanY = (frameNow * 0.15) % HEIGHT; ctx.fillStyle = "rgba(0, 240, 255, " + (0.2 + edgeIntensity * 0.35) + ")"; ctx.shadowBlur = 14; ctx.shadowColor = "#ff00c8"; ctx.fillRect(TUNNEL_X, scanY, TUNNEL_WIDTH, 3);
        ctx.shadowBlur = 0;
        ctx.restore();

        ctx.fillStyle = "rgba(255, 255, 255, 0.25)"; ctx.beginPath(); stars.forEach(star => { ctx.moveTo(star.x + star.size, star.y); ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2); }); ctx.fill();
        particlePool.forEach(p => { if (!p.active) return; ctx.fillStyle = p.color; ctx.globalAlpha = p.alpha; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill(); }); ctx.globalAlpha = 1.0;
        
        glowEffectPool.forEach(g => {
            if (!g.active) return;
            ctx.save(); ctx.globalAlpha = Math.max(0, g.alpha);
            ctx.beginPath(); ctx.arc(g.x, g.y, g.radius, 0, Math.PI * 2);
            ctx.strokeStyle = g.color; ctx.lineWidth = 2; ctx.shadowBlur = 10; ctx.shadowColor = g.color;
            ctx.stroke(); ctx.restore();
        });
        ctx.globalAlpha = 1.0;
        if (swaansaSamapta) { ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, player.y - 10); ctx.lineTo(WIDTH, player.y - 10); ctx.stroke(); }

        let scale = smoothSize / 60; let cx = player.x + smoothSize / 2; let cy = player.y + smoothSize / 2;

        drawGlowRing(cx, cy, glowRings.jyoti);
        drawGlowRing(cx, cy, glowRings.shankha);
        drawGlowRing(cx, cy, glowRings.kripa);

        let sharirPulseScale = 1 + (worldBreathPulse * 0.28);
        const CHAIN_GAP = 44; 
        let activeChainCount = 0;
        if (shuvhaKarma > 0) { let s = chainSlots[activeChainCount++]; s.active = true; s.color = "#32ff32"; s.strength = Math.min(1, shuvhaKarma / 5); s.isHeavy = false; }
        if (ashuvhaKarma > 0) { let s = chainSlots[activeChainCount++]; s.active = true; s.color = "#ff3232"; s.strength = Math.min(1, ashuvhaKarma / 5); s.isHeavy = false; }
        if (prarabdha > 0) { let s = chainSlots[activeChainCount++]; s.active = true; s.color = "#8b0000"; s.strength = Math.min(1, prarabdha / 10); s.isHeavy = true; }
        for (let i = activeChainCount; i < chainSlots.length; i++) chainSlots[i].active = false; 

        drawCenteredRow(cx, cy + 50, activeChainCount, CHAIN_GAP, (chainCx, chainCy, i) => {
            const c = chainSlots[i];
            drawKarmaChain(chainCx, chainCy, c.color, c.strength, c.isHeavy, frameNow);
        });

        let breathingSmoothSize = smoothSize * sharirPulseScale; let sharirGlow = 8 + worldBreathPulse * 28; let sharirAlpha = 0.4 + worldBreathPulse * 0.6;
        
        if (naamaGlowTimer > 0 || bodyGlowTimer > 0) {
            ctx.save();
            if (naamaGlowTimer > 0) {
                let a = naamaGlowTimer / 40;
                ctx.shadowBlur = 18; ctx.shadowColor = "rgba(255, 255, 255, " + a + ")";
                ctx.fillStyle = "rgba(255, 255, 255, " + a + ")";
                ctx.beginPath(); ctx.arc(cx, cy, (breathingSmoothSize / 2) + 12, 0, Math.PI * 2); ctx.fill();
            }
            if (bodyGlowTimer > 0) {
                ctx.globalAlpha = bodyGlowTimer / 40;
                ctx.shadowBlur = 18; ctx.shadowColor = bodyGlowColor; ctx.fillStyle = bodyGlowColor;
                ctx.beginPath(); ctx.arc(cx, cy, (breathingSmoothSize / 2) + 12, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        }

        ctx.save(); ctx.shadowBlur = sharirGlow; ctx.shadowColor = `rgba(255,255,255,${sharirAlpha})`; ctx.strokeStyle = `rgba(255,255,255,${sharirAlpha})`; ctx.lineWidth = (0.5 + worldBreathPulse * 1.2) * (smoothSize / 60); ctx.beginPath(); ctx.arc(cx, cy, breathingSmoothSize / 2, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        
        let sRadius = (breathingSmoothSize / 2) - 7; 
        let sCy = cy; 
        
        let buddhiSRadiusKey = Math.round(sRadius);
        if (buddhiSRadiusKey !== cachedBuddhiSRadiusKey || !cachedBuddhiSprite) {
            cachedBuddhiSRadiusKey = buddhiSRadiusKey;
            const bOff = document.createElement('canvas');
            const bSz = Math.ceil(sRadius * 2) + 4;
            bOff.width = bSz; bOff.height = bSz;
            const bCtx = bOff.getContext('2d');
            const bCx = bSz / 2, bCy = bSz / 2;
            const bGrad = bCtx.createRadialGradient(bCx, bCy, 0, bCx, bCy, sRadius);
            bGrad.addColorStop(0, "rgba(255, 225, 150, 0.22)");
            bGrad.addColorStop(0.6, "rgba(255, 210, 110, 0.14)");
            bGrad.addColorStop(1, "rgba(255, 190, 80, 0.05)");
            bCtx.fillStyle = bGrad;
            bCtx.beginPath(); bCtx.arc(bCx, bCy, sRadius, 0, Math.PI * 2); bCtx.fill();
            cachedBuddhiSprite = { canvas: bOff, sz: bSz };
        }
        ctx.save();
        ctx.shadowBlur = 6;
        ctx.shadowColor = "rgba(255, 210, 120, 0.4)";
        ctx.drawImage(cachedBuddhiSprite.canvas, cx - cachedBuddhiSprite.sz / 2, sCy - cachedBuddhiSprite.sz / 2);
        ctx.shadowBlur = 14;
        ctx.shadowColor = "rgba(255, 190, 80, 0.7)";
        ctx.strokeStyle = "rgba(255, 200, 60, 0.45)"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(cx, sCy, sRadius, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();

        let triRadius = sRadius; 
        drawYantraPolygon(cx, sCy, triRadius, 3, -Math.PI / 2, "rgba(255, 200, 60, 0.85)", 2.2, "rgba(255, 180, 40, 0.9)", 14); 
        drawYantraPolygon(cx, sCy, triRadius, 3, Math.PI / 2, "rgba(255, 200, 60, 0.85)", 2.2, "rgba(255, 180, 40, 0.9)", 14);  

        let atmanY = cy; 
        let glowR = 6 * scale;
        let atmanGlowKey = Math.round(glowR * 10);
        if (atmanGlowKey !== cachedAtmanGlowKey || !cachedAtmanSprite) {
            cachedAtmanGlowKey = atmanGlowKey;
            const aOff = document.createElement('canvas');
            const aSz = Math.ceil(glowR * 2) + 4;
            aOff.width = aSz; aOff.height = aSz;
            const aCtx = aOff.getContext('2d');
            const aCx = aSz / 2, aCy = aSz / 2;
            const aGrad = aCtx.createRadialGradient(aCx, aCy, 0, aCx, aCy, glowR);
            aGrad.addColorStop(0, "rgba(255, 255, 255, 1)");
            aGrad.addColorStop(0.1, "rgba(255, 255, 255, 0.9)");
            aGrad.addColorStop(0.3, "rgba(200, 230, 255, 0.35)");
            aGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
            aCtx.fillStyle = aGrad;
            aCtx.beginPath(); aCtx.arc(aCx, aCy, glowR, 0, Math.PI * 2); aCtx.fill();
            cachedAtmanSprite = { canvas: aOff, sz: aSz };
        }
        ctx.save();
        ctx.drawImage(cachedAtmanSprite.canvas, cx - cachedAtmanSprite.sz / 2, atmanY - cachedAtmanSprite.sz / 2);
        ctx.fillStyle = "#ffffff"; ctx.shadowColor = "#ffffff"; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(cx, atmanY, 0.7, 0, Math.PI * 2); ctx.fill(); 
        ctx.restore();

        ctx.save(); ctx.fillStyle = "#ffffff"; ctx.shadowColor = "#ffffff"; ctx.shadowBlur = 3;
        let horseCount = 6; let horseSpacing = 10; let startX = cx - ((horseCount - 1) * horseSpacing) / 2;
        for (let i = 0; i < horseCount; i++) { 
            let hx, hy; 
            if (i === pulledHorseIndex) { hx = pulledHorseX; hy = pulledHorseY; } 
            else { hx = startX + i * horseSpacing; hy = cy - breathingSmoothSize / 2 - 45 + (isPaused || gameOver ? 0 : Math.sin((frameNow / 70) + i) * 3); } 
            finalHorsePositions[i].x = hx; finalHorsePositions[i].y = hy; 
            ctx.beginPath(); ctx.arc(hx, hy, 2.2, 0, Math.PI * 2); ctx.fill(); 
        }
        for (let i = 0; i < horseCount; i++) {
            let hx = finalHorsePositions[i].x; let hy = finalHorsePositions[i].y;
            if (totalKarma > 0) {
                let riktaRatio = ashuvhaKarma / totalKarma; let reinGrad = ctx.createLinearGradient(hx, hy, cx, sCy);
                if (riktaRatio === 0) { ctx.strokeStyle = "rgba(50, 255, 50, 0.65)"; } 
                else if (riktaRatio === 1) { ctx.strokeStyle = "rgba(255, 50, 50, 0.65)"; } 
                else { let splitPoint = 1 - riktaRatio; reinGrad.addColorStop(0, "rgba(50, 255, 50, 0.65)"); reinGrad.addColorStop(splitPoint, "rgba(50, 255, 50, 0.65)"); reinGrad.addColorStop(splitPoint, "rgba(255, 50, 50, 0.65)"); reinGrad.addColorStop(1, "rgba(255, 50, 50, 0.65)"); ctx.strokeStyle = reinGrad; }
            } else { ctx.strokeStyle = (i === pulledHorseIndex) ? "rgba(255, 255, 255, 0.85)" : "rgba(255, 255, 255, 0.4)"; }
            ctx.lineWidth = (i === pulledHorseIndex) ? 1.6 : 1.1; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(cx, sCy - sRadius); ctx.stroke();
        }
        ctx.restore();

        mayaPool.forEach(m => {
            if (!m.active) return;
            let boxInside = (m.x >= TUNNEL_X && (m.x + m.width) <= (TUNNEL_X + TUNNEL_WIDTH)); let bScale = boxInside ? 0.5 : 1; let bw = m.width * bScale; let bh = m.height * bScale; let bx = m.x + (m.width - bw) / 2; let by = m.y + (m.height - bh) / 2;
            if (m.isPulling && pulledHorseIndex !== -1) { ctx.save(); ctx.beginPath(); ctx.moveTo(bx + bw / 2, by + bh); ctx.lineTo(pulledHorseX, pulledHorseY); ctx.strokeStyle = m.type === "shuvha" ? "rgba(50, 255, 50, 0.3)" : "rgba(255, 50, 50, 0.3)"; ctx.stroke(); ctx.restore(); }
            if (m.type === "shuvha" || m.type === "rikta") {
                if (m.type === "rikta" && ashuvhaKarma >= 3) {
                    let aCx = m.x + m.width / 2; let aCy = m.y + m.height / 2;
                    let aDist = Math.hypot(aCx - cx, aCy - cy);
                    let inGlow = (glowRings.jyoti.active && aDist <= glowRings.jyoti.radius);
                    if (!inGlow) { ctx.textAlign = "left"; return; }
                }
                let gcx = bx + bw / 2; let gcy = by + bh / 2;
                let sprite = getMayaSprite(m.type, bScale);
                ctx.drawImage(sprite.canvas, gcx - sprite.size / 2, gcy - sprite.size / 2);
                let pIsShuvha = m.type === "shuvha";
                let pPulse = (Math.sin(frameNow / 140) + 1) / 2; 
                let pBaseR = (sprite.size / 2) * 0.92;           
                ctx.save();
                ctx.beginPath();
                ctx.arc(gcx, gcy, pBaseR + pPulse * 2, 0, Math.PI * 2);
                ctx.strokeStyle = pIsShuvha ? "rgba(50,255,50,0.45)" : "rgba(255,50,50,0.45)";
                ctx.lineWidth = 1.2;
                ctx.shadowBlur = 4;
                ctx.shadowColor = pIsShuvha ? "#32ff32" : "#ff3232";
                ctx.stroke();
                ctx.restore();
            } else if (m.type === "naama") {
                let r = 18 * bScale; let ncx = m.x + m.width / 2; let ncy = m.y + m.height / 2; let pulse = (Math.sin(frameNow / 150) + 1) / 2; ctx.save();
                let nGrad = ctx.createRadialGradient(ncx, ncy, 0, ncx, ncy, r + pulse * 4); nGrad.addColorStop(0, "#ffffff"); nGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.9)"); nGrad.addColorStop(1, "rgba(255, 255, 255, 0)"); ctx.fillStyle = nGrad; ctx.beginPath(); ctx.arc(ncx, ncy, r + 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(ncx, ncy, r * 0.6, 0, Math.PI * 2);
                ctx.fill(); ctx.restore();
                ctx.save();
                ctx.font = (16 * bScale) + "px 'Noto Sans Devanagari', sans-serif";
                ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.shadowBlur = 10; ctx.shadowColor = "#ffffff";
                ctx.fillStyle = "#1a1a2e"; 
                ctx.fillText("ॐ", ncx, ncy);
                ctx.restore();
            } else if (m.type === "kripa") {
                drawPickupGlowIcon(m.x + m.width / 2, m.y + m.height / 2, bScale, "✋", "255,215,0", 0.55, "#ffd700", frameNow, 130, 5);
            } else if (m.type === "cyclone") {
                let ccx = m.x + m.width / 2; let ccy = m.y + m.height / 2; ctx.save();
                ctx.translate(ccx, ccy); ctx.rotate((frameNow / 120) % (Math.PI * 2));
                let cGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 22 * bScale);
                cGrad.addColorStop(0, "rgba(200,200,210,0.9)"); cGrad.addColorStop(0.6, "rgba(120,120,140,0.5)"); cGrad.addColorStop(1, "rgba(120,120,140,0)");
                ctx.fillStyle = cGrad; ctx.beginPath(); ctx.arc(0, 0, 20 * bScale, 0, Math.PI * 2); ctx.fill();
                ctx.rotate(-(frameNow / 120) % (Math.PI * 2));
                ctx.font = (18 * bScale) + "px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.shadowBlur = 10; ctx.shadowColor = "#aaaaaa"; ctx.fillStyle = "#ffffff";
                ctx.fillText("🌪️", 0, 0); ctx.restore();
            } else if (m.type === "shankha") {
                drawPickupGlowIcon(m.x + m.width / 2, m.y + m.height / 2, bScale, "🐚", "125,211,252", 0.55, "#7dd3fc", frameNow, 140, 3);
            } else if (m.type === "jyoti") {
                drawPickupGlowIcon(m.x + m.width / 2, m.y + m.height / 2, bScale, "🪔", "255,165,0", 0.6, "#ffa500", frameNow, 120, 3);
            }
            ctx.textAlign = "left";
        });

        if (pendingGoodKarma && !gameOver) {
            ctx.save(); let secondsLeft = Math.ceil(punyaTimer / 60); let karmaPulse = (Math.sin(frameNow / 150) + 1) / 2; ctx.textAlign = "center"; ctx.textBaseline = "middle"; let py = player.y + smoothSize + 30; ctx.font = "800 13px 'Orbitron', sans-serif"; ctx.shadowBlur = 10; ctx.shadowColor = "#32ff32"; ctx.fillStyle = "rgba(200, 255, 200, 0.9)"; ctx.fillText("पुण्य त्यागो (+" + pendingGoodKarmaCount + ")", cx, py - 14); ctx.font = "900 " + (26 + karmaPulse * 4) + "px 'Orbitron', sans-serif"; ctx.fillStyle = "#ffffff"; ctx.shadowBlur = 20 + karmaPulse * 15; ctx.shadowColor = "#00ff00"; ctx.fillText(secondsLeft + "s", cx, py); ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(50, 255, 50, " + (0.8 + karmaPulse * 0.2) + ")"; ctx.strokeText(secondsLeft + "s", cx, py); ctx.restore();
        }

        if (samaya < 100 && samaya > 0 && !swaansaSamapta && !gameOver) {
            ctx.save(); let currentSamay = Math.ceil(samaya); let pulse = (Math.sin(frameNow / 150) + 1) / 2; ctx.textAlign = "center"; ctx.textBaseline = "middle"; let textY = cy - smoothSize / 2 - 55; ctx.font = "800 13px 'Orbitron', sans-serif"; ctx.shadowBlur = 10; ctx.shadowColor = "#ff3232"; ctx.fillStyle = "rgba(255, 200, 200, 0.9)"; ctx.fillText("अंतिम चरण", cx, textY - 24); ctx.font = "900 " + (26 + pulse * 3) + "px 'Orbitron', sans-serif"; ctx.fillStyle = "#ffffff"; ctx.shadowBlur = 20 + pulse * 35; ctx.shadowColor = "#ff0000"; ctx.fillText(currentSamay + "s", cx, textY); ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(255, 50, 50, " + (0.8 + pulse * 0.2) + ")"; ctx.strokeText(currentSamay + "s", cx, textY); ctx.restore();
        }

        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const FT_SAFE_MARGIN = 8;             
        const FT_MAX_WIDTH = WIDTH - (FT_SAFE_MARGIN * 2); 

        floatingTextPool.forEach(ft => {
            if (!ft.active) return;
            ctx.fillStyle = ft.color;
            ctx.globalAlpha = ft.alpha;

            let baseFontSize = ft.isBigName ? 100 : 16;
            ctx.font = `900 ${baseFontSize}px 'Orbitron', sans-serif`;
            let currentFontSize = baseFontSize; 

            if (ft._cachedTextWidth === undefined) {
                ft._cachedTextWidth = ctx.measureText(ft.text).width;
            }
            
            let textWidth = ft._cachedTextWidth;

            if (textWidth > FT_MAX_WIDTH) {
                let scaledFontSize = baseFontSize * (FT_MAX_WIDTH / textWidth);
                ctx.font = `900 ${scaledFontSize.toFixed(1)}px 'Orbitron', sans-serif`;
                textWidth = FT_MAX_WIDTH; 
                currentFontSize = scaledFontSize; 
            }

            let circlePadding = Math.max(12, currentFontSize * 0.25);
            let circleRadius = (Math.max(textWidth, currentFontSize * 0.85) / 2) + circlePadding;

            let minX = circleRadius + FT_SAFE_MARGIN;
            let maxX = WIDTH - circleRadius - FT_SAFE_MARGIN;
            let safeX = (minX > maxX) ? WIDTH / 2 : Math.min(maxX, Math.max(minX, ft.x));

            ctx.save();
            ctx.globalAlpha = ft.alpha;
            ctx.beginPath();
            ctx.arc(safeX, ft.y, circleRadius, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(8, 8, 14, 0.40)";
            ctx.fill();
            ctx.lineWidth = 1.4;
            ctx.strokeStyle = ft.color;
            ctx.shadowBlur = 6;
            ctx.shadowColor = ft.color;
            ctx.stroke();
            ctx.restore();

            ctx.lineWidth = Math.max(2, currentFontSize * 0.07);
            ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
            ctx.shadowBlur = 0;
            ctx.globalAlpha = ft.alpha;
            ctx.strokeText(ft.text, safeX, ft.y);

            ctx.shadowBlur = 10;
            ctx.shadowColor = ft.color;
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, safeX, ft.y);
        });
        ctx.restore();

        if (notifyTimer > 0) {
            ctx.save(); let alpha = 1.0; if (notifyTimer < 50) { alpha = notifyTimer / 50; } ctx.globalAlpha = alpha; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "rgba(0, 0, 0, " + (alpha * 0.7) + ")"; ctx.fillRect(0, HEIGHT / 2 - 50, WIDTH, 100); ctx.fillStyle = "#ff6b6b"; ctx.font = "900 32px 'Orbitron', sans-serif"; ctx.shadowBlur = 25; ctx.shadowColor = "#ff3232"; ctx.fillText(notifyText, WIDTH / 2, HEIGHT / 2); ctx.restore();
        }

        let gatiRadius = (breathingSmoothSize / 2) + 5;   
        let samayRadius = gatiRadius + 12;                 
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, gatiRadius, 0, Math.PI * 2);
        ctx.lineWidth = 4; ctx.strokeStyle = "rgba(200, 20, 20, 0.15)";
        ctx.shadowBlur = 28; ctx.shadowColor = "rgba(220, 30, 30, 0.9)";
        ctx.globalAlpha = 0.55; ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(cx, cy, samayRadius, 0, Math.PI * 2);
        ctx.lineWidth = 7; ctx.strokeStyle = "rgba(200, 20, 20, 0.18)";
        ctx.shadowBlur = 45; ctx.shadowColor = "rgba(220, 30, 30, 1)";
        ctx.globalAlpha = 0.75; ctx.stroke();
        ctx.restore();    

        let riktaMod = Math.pow(0.7, ashuvhaKarma);
        let shuvhaMod = Math.pow(0.8, shuvhaKarma);
        let gatiRatio = riktaMod * shuvhaMod; 

        ctx.save();
        ctx.lineWidth = 1; 
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(cx, cy, gatiRadius, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 200, 60, 0.22)"; 
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, gatiRadius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * gatiRatio));
        ctx.lineWidth = 1; ctx.strokeStyle = "rgba(255, 200, 60, 0.5)"; 
        ctx.shadowBlur = 18; ctx.shadowColor = "#ffc83c";
        ctx.globalAlpha = 0.7 + Math.sin(frameNow / 200) * 0.2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, gatiRadius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * gatiRatio));
        ctx.lineWidth = 1; ctx.strokeStyle = "rgba(255, 245, 210, 1)"; 
        ctx.shadowBlur = 10; ctx.shadowColor = "#ffffff";
        ctx.globalAlpha = 0.9 + Math.sin(frameNow / 200) * 0.1;
        ctx.stroke();
        
        if (gatiRatio > 0) {
            let gatiHeadAngle = -Math.PI / 2 + (Math.PI * 2 * gatiRatio);
            let ghx = cx + Math.cos(gatiHeadAngle) * gatiRadius;
            let ghy = cy + Math.sin(gatiHeadAngle) * gatiRadius;
            ctx.save();
            ctx.shadowBlur = 14; ctx.shadowColor = "#ffc83c"; 
            ctx.font = "10px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText("⚡", ghx, ghy);
            ctx.restore();
        }
        ctx.restore();

        let samayRatio = Math.max(0, samaya / SAMAYA_PRAARAMBHIKA);

        ctx.save();
        ctx.lineWidth = 3; 
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(cx, cy, samayRadius, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 200, 60, 0.22)"; 
        ctx.stroke();
        
        let arcLengthMultiplier = Math.pow(samayRatio, 0.5); 
        let samayNeonColor = (samaya < 100) ? "255, 0, 90" : "255, 200, 60";   
        let samayNeonShadow = (samaya < 100) ? "#ff005a" : "#ffc83c";

        ctx.beginPath();
        ctx.arc(cx, cy, samayRadius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * arcLengthMultiplier));
        ctx.lineWidth = (samaya < 100) ? 6 : 5; 
        ctx.strokeStyle = "rgba(" + samayNeonColor + ", 0.5)";
        ctx.shadowBlur = (samaya < 100) ? 28 : 18; ctx.shadowColor = samayNeonShadow;
        ctx.globalAlpha = 0.7 + Math.sin(frameNow / 150) * 0.2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, samayRadius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * arcLengthMultiplier));
        ctx.lineWidth = 2.5; ctx.strokeStyle = "rgba(255, 255, 255, 1)";
        ctx.shadowBlur = (samaya < 100) ? 16 : 10; ctx.shadowColor = samayNeonShadow;
        ctx.globalAlpha = 0.9 + Math.sin(frameNow / 150) * 0.1;
        ctx.stroke();
        
        if (arcLengthMultiplier > 0) {
            let samayHeadAngle = -Math.PI / 2 + (Math.PI * 2 * arcLengthMultiplier);
            let shx = cx + Math.cos(samayHeadAngle) * samayRadius;
            let shy = cy + Math.sin(samayHeadAngle) * samayRadius;
            ctx.save();
            ctx.shadowBlur = (samaya < 100) ? 20 : 14; ctx.shadowColor = samayNeonShadow;
            ctx.font = "10px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText("⏳", shx, shy);
            ctx.restore();
        }
        ctx.restore();

        let PANKHUDI_COUNT = 10;                    
        let pankhudiRadius = samayRadius + 3;        
        let pankhudiLength = 22;                     
        let pankhudiWidth = 45;                       
        let pankhudiBaseHalfWidth = 8;                
        let pankhudiRotation = frameNow / 4500;      
        
        let breathProgress = swaansaTimer / 360;
        let breathBoost = Math.sin(breathProgress * Math.PI); 

        let p_consumed = 10 - swaansa; 

        for (let p = 0; p < PANKHUDI_COUNT; p++) {
            let pAngle = pankhudiRotation + (p * (Math.PI * 2 / PANKHUDI_COUNT));
            let isConsumed = p < p_consumed;          
            let isActive   = p === p_consumed && swaansa > 0; 
            
            let curLength = isActive ? pankhudiLength * (1 + breathBoost * 0.5) : pankhudiLength;
            let curWidth = isActive ? pankhudiWidth * (1 + breathBoost * 0.4) : isConsumed ? pankhudiWidth * 0.7 : pankhudiWidth;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(pAngle);

            let grad;
            if (isConsumed) {
                grad = ctx.createLinearGradient(pankhudiRadius, 0, pankhudiRadius + curLength, 0);
                grad.addColorStop(0,    "rgba(255, 236, 139, 0.95)");
                grad.addColorStop(0.55, "rgba(255, 170,  40, 0.9)");
                grad.addColorStop(1,    "rgba(184,  96,  20, 0.75)");
            } else if (isActive) {
                grad = ctx.createLinearGradient(pankhudiRadius, 0, pankhudiRadius + curLength, 0);
                grad.addColorStop(0,    "rgba(255, 255, 200, 1.0)");  
                grad.addColorStop(0.4,  "rgba(255, 210,  60, 1.0)");  
                grad.addColorStop(1,    "rgba(255, 140,  20, 0.9)");  
            } else {
                grad = ctx.createLinearGradient(pankhudiRadius, 0, pankhudiRadius + curLength, 0);
                grad.addColorStop(0,    "rgba(255, 236, 139, 0.95)");
                grad.addColorStop(0.55, "rgba(255, 170,  40, 0.9)");
                grad.addColorStop(1,    "rgba(184,  96,  20, 0.75)");
            }

            ctx.beginPath();
            ctx.moveTo(pankhudiRadius, -pankhudiBaseHalfWidth);
            ctx.quadraticCurveTo(pankhudiRadius + curLength * 0.4, -curWidth / 2, pankhudiRadius + curLength, 0);
            ctx.quadraticCurveTo(pankhudiRadius + curLength * 0.4,  curWidth / 2, pankhudiRadius, pankhudiBaseHalfWidth);
            ctx.closePath();

            ctx.shadowBlur  = isActive ? 22 : isConsumed ? 0 : 12;
            ctx.shadowColor = isActive ? "rgba(255, 220, 80, 1.0)" : "rgba(255, 180, 50, 0.85)";
            ctx.globalAlpha = isConsumed ? 0.7 : 1.0;
            ctx.fillStyle = grad;
            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.strokeStyle = isConsumed ? "rgba(100, 100, 100, 0.3)" : "rgba(255, 223, 120, 0.55)";
            ctx.lineWidth = 1; ctx.stroke();

            if (!isConsumed) {
                ctx.strokeStyle = "rgba(200, 110, 15, 0.5)";
                ctx.lineWidth = 0.6;
                ctx.beginPath(); ctx.moveTo(pankhudiRadius + pankhudiBaseHalfWidth, 0); ctx.lineTo(pankhudiRadius + curLength * 0.92, 0); ctx.stroke();
            }
            ctx.shadowBlur = 0; ctx.shadowColor = "transparent"; 
            ctx.globalAlpha = 1.0; 
            ctx.restore();
        }

        let outerRadius = gatiRadius + ((samayRadius - gatiRadius) / 2);
        let emojiRenderTime = frameNow / 1800;

        let innerOrbit = [
            chetanaaJagrita ? "👁️" : "😴",
            ashuvhaKarma >= 3 ? "⚫" : "☀️",
            purnaSamarpana ? "🙌" : "🤲"
        ];
        if (punaraJanmaCount > 0) innerOrbit.push("♻️");
        if (shuvhaKarma > 0) innerOrbit.push("🌿");
        if (ashuvhaKarma > 0) innerOrbit.push("🥀");
        if (prarabdha > 0) innerOrbit.push("📜");
        if (activeNaam > 0) innerOrbit.push("ॐ");
        if (kripa > 0) innerOrbit.push("✋");
        if (shankha > 0) innerOrbit.push("🐚");
        if (jyoti > 0) innerOrbit.push("🪔");
        if (samarpita > 0) innerOrbit.push("🙏");

        ctx.save();
        ctx.globalAlpha = 1.0; 
        const innerEmojiFontSize = 10; 
        for (let i = 0; i < innerOrbit.length; i++) {
            let angle = emojiRenderTime + (i * (Math.PI * 2 / innerOrbit.length));
            let ex = cx + Math.cos(angle) * outerRadius;
            let ey = cy + Math.sin(angle) * outerRadius;
            const sp = getEmojiSprite(innerOrbit[i], innerEmojiFontSize);
            ctx.drawImage(sp.canvas, ex - sp.sz / 2, ey - sp.sz / 2, sp.sz, sp.sz);
        }
        ctx.restore();

        let maxPankhudiExtended = pankhudiLength * 1.5; 
        let baseDist = pankhudiRadius + maxPankhudiExtended + 8; let orbitGap = 7;
        
        let sortedOrbitIndices = outerOrbits.map((o, idx) => idx).filter(idx => idx !== 7 && outerOrbits[idx].count > 0).sort((a, b) => outerOrbits[a].count - outerOrbits[b].count);

        for (let si = 0; si < sortedOrbitIndices.length; si++) {
            let o = sortedOrbitIndices[si];
            let orbit = outerOrbits[o]; if (orbit.count > 0) {
                ctx.save();
                let extraGlow = (orbit.glowTimer && orbit.glowTimer > 0) ? (orbit.glowTimer / 60) * 22 : 0; 
                ctx.shadowBlur = (orbit.glow || 6) + extraGlow;
                ctx.shadowColor = orbit.color; let renderTime = frameNow / 1000;
                let pulse = Math.sin(renderTime * 1.2 + o) * 2; let actualDist = baseDist + pulse; let visibleCount = Math.min(orbit.count, 36); let step = Math.max(1, Math.ceil(orbit.count / visibleCount)); let drawCount = Math.ceil(orbit.count / step);
                let extraRadius = (orbit.glowTimer && orbit.glowTimer > 0) ? (orbit.glowTimer / 60) * 1.6 : 0; 
                let dotRadius = Math.max(1.0, Math.min(1.8, 15 / Math.sqrt(drawCount))) * (orbit.sizeMult || 1.0) + extraRadius;
                
                const orbitFontSize = dotRadius * 4.2;
                const sp = getEmojiSprite(orbit.emoji, orbitFontSize);
                for (let i = 0; i < orbit.count; i += step) {
                    let angle = (renderTime * orbit.speed) + (i * (Math.PI * 2 / orbit.count));
                    let dx = cx + Math.cos(angle) * actualDist;
                    let dy = cy + Math.sin(angle) * actualDist;
                    ctx.drawImage(sp.canvas, dx - sp.sz / 2, dy - sp.sz / 2, sp.sz, sp.sz);
                }
                ctx.restore(); baseDist += orbitGap;
            }
        }
        
        if (isNaamaJaapa) {
            ctx.save();
            ctx.beginPath(); ctx.arc(cx, cy, naamaGhera, 0, Math.PI * 2);
            ctx.lineWidth = 3 + (naamaGhera * 0.005); ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
            ctx.shadowBlur = 20; ctx.shadowColor = "#ffffff"; ctx.stroke();
            ctx.fillStyle = "rgba(255, 255, 255, 0.06)"; ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    }
};