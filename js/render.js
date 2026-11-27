// js/render.js //
"use strict";

const UI_I18N = {
  traits: {
    blind:      { ja: "視覚障害", jaAnchor: "視", jaDesc: "視界制限" },
    deaf:       { ja: "聴覚障害", jaAnchor: "聰", jaDesc: "反応遅延" },
    tremor:     { ja: "振戦",     jaAnchor: "震", jaDesc: "照準揺れ" },
    asthma:     { ja: "喘息",     jaAnchor: "喘", jaDesc: "息切れ硬直" },
    prosthesis: { ja: "義足",     jaAnchor: "義", jaDesc: "移動変化" }
  },
  difficulty: {
    NORMAL:   "NORMAL 普通 ノーマル",
    HARD:     "HARD 困難 ハード",
    ULTIMATE: "ULTIMATE 極限 アルティメット"
  }
};

const _hitFlashBuffer = (() => {
  const c = document.createElement("canvas");
  return { canvas: c, ctx: c.getContext("2d") };
})();

function drawRedFlashSprite(src, dx, dy, dw, dh, alpha = 0.72) {
  const sw = src.naturalWidth || src.width;
  const sh = src.naturalHeight || src.height;
  if (!sw || !sh) return;

  if (_hitFlashBuffer.canvas.width !== sw || _hitFlashBuffer.canvas.height !== sh) {
    _hitFlashBuffer.canvas.width = sw;
    _hitFlashBuffer.canvas.height = sh;
  }

  const tctx = _hitFlashBuffer.ctx;
  tctx.save();
  tctx.globalCompositeOperation = "source-over";
  tctx.clearRect(0, 0, sw, sh);
  tctx.drawImage(src, 0, 0, sw, sh);
  tctx.globalCompositeOperation = "source-atop";
  tctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
  tctx.fillRect(0, 0, sw, sh);
  tctx.restore();

  ctx.drawImage(_hitFlashBuffer.canvas, dx, dy, dw, dh);
}

// Automatically strips white background halo & the baked-in stone floor pedestal beneath the Knifer's boots
function getCleanKniferCanvas() {
  if (typeof EXTRA_SPRITES === "undefined" || !EXTRA_SPRITES.knifer || !EXTRA_SPRITES.knifer.loaded) {
    return null;
  }
  const entry = EXTRA_SPRITES.knifer;
  const rawSrc = entry.canvas || entry.img;
  if (!rawSrc) return null;

  const sw = rawSrc.naturalWidth || rawSrc.width;
  const sh = rawSrc.naturalHeight || rawSrc.height;
  if (!sw || !sh) return null;

  if (entry._cleanCanvas && entry._cleanSrc === rawSrc && entry._cleanW === sw && entry._cleanH === sh) {
    return entry._cleanCanvas;
  }

  const work = document.createElement("canvas");
  work.width = sw;
  work.height = sh;
  const wctx = work.getContext("2d");
  wctx.drawImage(rawSrc, 0, 0, sw, sh);

  let imgData;
  try {
    imgData = wctx.getImageData(0, 0, sw, sh);
  } catch (_) {
    entry._cleanCanvas = rawSrc;
    entry._cleanSrc = rawSrc;
    entry._cleanW = sw;
    entry._cleanH = sh;
    return rawSrc;
  }

  const data = imgData.data;
  const isNearWhiteBg = (idx) => {
    const a = data[idx + 3];
    if (a < 20) return true;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    return maxC >= 210 && (maxC - minC) <= 26;
  };

  // 1. Flood-fill from image edges to clear any remaining light background pixels
  const visited = new Uint8Array(sw * sh);
  const queue = new Int32Array(sw * sh);
  let head = 0;
  let tail = 0;

  const pushIfBg = (x, y) => {
    if (x < 0 || x >= sw || y < 0 || y >= sh) return;
    const p = y * sw + x;
    if (visited[p]) return;
    visited[p] = 1;
    if (isNearWhiteBg(p * 4)) {
      queue[tail++] = p;
    }
  };

  for (let x = 0; x < sw; x++) {
    pushIfBg(x, 0);
    pushIfBg(x, sh - 1);
  }
  for (let y = 0; y < sh; y++) {
    pushIfBg(0, y);
    pushIfBg(sw - 1, y);
  }

  while (head < tail) {
    const p = queue[head++];
    data[p * 4 + 3] = 0;
    const x = p % sw;
    const y = (p - x) / sw;
    pushIfBg(x - 1, y);
    pushIfBg(x + 1, y);
    pushIfBg(x, y - 1);
    pushIfBg(x, y + 1);
  }

  // 2. Defringe 1px white outline halo around the silhouette
  const alphaCopy = new Uint8ClampedArray(sw * sh);
  for (let p = 0; p < sw * sh; p++) alphaCopy[p] = data[p * 4 + 3];

  for (let y = 1; y < sh - 1; y++) {
    for (let x = 1; x < sw - 1; x++) {
      const p = y * sw + x;
      if (alphaCopy[p] === 0) continue;
      const touchesTransparent =
        alphaCopy[p - 1] === 0 ||
        alphaCopy[p + 1] === 0 ||
        alphaCopy[p - sw] === 0 ||
        alphaCopy[p + sw] === 0;
      if (touchesTransparent) {
        const idx = p * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        if (maxC >= 195 && (maxC - minC) <= 30) {
          data[idx + 3] = 0;
        }
      }
    }
  }

  // 3. Find initial non-transparent bounds
  let topY = sh;
  let botY = -1;
  let leftX = sw;
  let rightX = -1;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (data[(y * sw + x) * 4 + 3] > 24) {
        if (y < topY) topY = y;
        if (y > botY) botY = y;
        if (x < leftX) leftX = x;
        if (x > rightX) rightX = x;
      }
    }
  }

  // 4. Detect and remove the horizontal stone floor slab at the bottom of the sprite
  if (botY > topY + 12) {
    const contentH = botY - topY + 1;
    const scanStart = Math.max(topY + Math.floor(contentH * 0.70), botY - Math.ceil(contentH * 0.28));

    const rowStats = [];
    for (let y = scanStart; y <= botY; y++) {
      let rMin = sw;
      let rMax = -1;
      let count = 0;
      let segments = 0;
      let inSeg = false;
      for (let x = leftX; x <= rightX; x++) {
        const opaque = data[(y * sw + x) * 4 + 3] > 24;
        if (opaque) {
          if (x < rMin) rMin = x;
          if (x > rMax) rMax = x;
          count++;
          if (!inSeg) {
            segments++;
            inSeg = true;
          }
        } else {
          inSeg = false;
        }
      }
      const span = rMax >= rMin ? (rMax - rMin + 1) : 0;
      const fill = span > 0 ? count / span : 0;
      rowStats.push({ y, span, count, segments, fill });
    }

    // Walk upward from the very bottom row while rows form a single solid wide bar (the floor pedestal)
    let slabTopY = null;
    let maxSlabSpan = 0;
    for (let i = rowStats.length - 1; i >= 0; i--) {
      const st = rowStats[i];
      if (st.span === 0) continue;
      const isSolidBar = st.segments === 1 && st.fill >= 0.72;
      if (slabTopY === null) {
        if (isSolidBar && st.span >= (rightX - leftX + 1) * 0.58) {
          slabTopY = st.y;
          maxSlabSpan = st.span;
        } else {
          break;
        }
      } else {
        if (isSolidBar && st.span >= maxSlabSpan * 0.80) {
          slabTopY = st.y;
          if (st.span > maxSlabSpan) maxSlabSpan = st.span;
        } else {
          break;
        }
      }
    }

    // Verify rows immediately above slabTopY are narrower or split into two separate boots
    if (slabTopY !== null && slabTopY > scanStart) {
      const aboveIdx = slabTopY - 1 - scanStart;
      const above = rowStats[aboveIdx];
      const slabThickness = botY - slabTopY + 1;
      if (
        slabThickness >= 2 &&
        slabThickness <= contentH * 0.26 &&
        above &&
        (above.segments >= 2 || above.span <= maxSlabSpan * 0.78)
      ) {
        for (let y = slabTopY; y <= botY; y++) {
          for (let x = 0; x < sw; x++) {
            data[(y * sw + x) * 4 + 3] = 0;
          }
        }
      }
    }
  }

  wctx.putImageData(imgData, 0, 0);

  // 5. Recompute final tight bounding box so boots rest cleanly at y = finalH
  let fMinX = sw;
  let fMinY = sh;
  let fMaxX = -1;
  let fMaxY = -1;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (data[(y * sw + x) * 4 + 3] > 24) {
        if (x < fMinX) fMinX = x;
        if (x > fMaxX) fMaxX = x;
        if (y < fMinY) fMinY = y;
        if (y > fMaxY) fMaxY = y;
      }
    }
  }

  if (fMaxX < fMinX || fMaxY < fMinY) {
    entry._cleanCanvas = rawSrc;
    entry._cleanSrc = rawSrc;
    entry._cleanW = sw;
    entry._cleanH = sh;
    return rawSrc;
  }

  const trimW = fMaxX - fMinX + 1;
  const trimH = fMaxY - fMinY + 1;
  const trimmed = document.createElement("canvas");
  trimmed.width = trimW;
  trimmed.height = trimH;
  const tctx = trimmed.getContext("2d");
  tctx.imageSmoothingEnabled = false;
  tctx.drawImage(work, fMinX, fMinY, trimW, trimH, 0, 0, trimW, trimH);

  entry._cleanCanvas = trimmed;
  entry._cleanSrc = rawSrc;
  entry._cleanW = sw;
  entry._cleanH = sh;
  return trimmed;
}

function getHeroGunMuzzlePos() {
  const runBobY = hero.animState === "RUN" ? Math.abs(Math.sin(hero.animTimer)) * -3.5 : 0;
  const climbBobX = hero.animState === "CLIMB" ? Math.sin(hero.animTimer) * 2.5 : 0;
  const jumpSquashY = hero.animState === "JUMP" ? -2.5 : 0;

  const shoulderX = hero.x + hero.w * 0.5 + climbBobX + hero.facing * 4;
  const shoulderY = hero.y + hero.h + runBobY + jumpSquashY - 38.8;

  const rawAngle = hero.aimAngle || 0;
  const localAimAngle = hero.facing === 1
    ? rawAngle
    : Math.atan2(Math.sin(rawAngle), -Math.cos(rawAngle));
  const clampedLocal = Math.max(-1.25, Math.min(1.25, localAimAngle));
  const worldGunAngle = hero.facing === 1
    ? clampedLocal
    : Math.atan2(Math.sin(clampedLocal), -Math.cos(clampedLocal));

  const barrelLen = 19.5;
  return {
    x: shoulderX + Math.cos(worldGunAngle) * barrelLen,
    y: shoulderY + Math.sin(worldGunAngle) * barrelLen
  };
}

function spawnBulletHitSparks(hitX, hitY) {
  if (typeof game === "undefined" || !Array.isArray(game.particles)) return;
  const sparkColors = ["#ffffff", "#fef08a", "#facc15", "#fb923c"];
  for (let i = 0; i < 7; i++) {
    const angle = (Math.PI * 2 * i) / 7 + (Math.random() - 0.5) * 0.55;
    const speed = 42 + Math.random() * 82;
    const life = 0.14 + Math.random() * 0.10;
    game.particles.push({
      x: hitX + (Math.random() - 0.5) * 3,
      y: hitY + (Math.random() - 0.5) * 3,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 16,
      size: i < 2 ? 4.4 : (1.8 + Math.random() * 1.4),
      color: sparkColors[i % sparkColors.length],
      life,
      maxLife: life,
      sparkle: true
    });
  }
}

function getDeviceDateTimeStrings() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return { dateStr: `${yyyy}-${mm}-${dd}`, timeStr: `${hh}:${min}` };
}

function resolveScreenBackgroundImage(scr) {
  if (!scr) return null;
  if (typeof stageManager !== "undefined" && stageManager.bgImages) {
    const byId = stageManager.bgImages[scr.id];
    if (byId && byId.loaded) return byId;
  }
  if (typeof STAGE_001_BG_TEMPLATES !== "undefined") {
    const tplKey = scr.bgTemplate || "bg001";
    const tplImg = STAGE_001_BG_TEMPLATES[tplKey] || STAGE_001_BG_TEMPLATES.bg001;
    if (tplImg && tplImg.loaded) return tplImg;
    for (const img of Object.values(STAGE_001_BG_TEMPLATES)) {
      if (img && img.loaded) return img;
    }
  }
  if (typeof stageManager !== "undefined" && stageManager.bgImages) {
    for (const img of Object.values(stageManager.bgImages)) {
      if (img && img.loaded) return img;
    }
  }
  return null;
}

function drawNotebookHeaderOverlay(isDarkDungeon = false) {
  const { dateStr, timeStr } = getDeviceDateTimeStrings();
  const stageTitle = (typeof stageManager !== "undefined" && stageManager.data && stageManager.data.stageName)
    ? String(stageManager.data.stageName).toUpperCase()
    : "RUIN CAVE 遺跡洞窟";
  const floorLabel = game.roomType === "BOSS"
    ? "BOSS CHAMBER 首領殿堂 ボス部屋"
    : (game.roomType === "TREASURE"
      ? "TREASURE VAULT 寶物庫 宝物庫"
      : (game.transitions === 0
        ? "ENTRY 入口 入口"
        : `FLOOR ${String(game.transitions).padStart(2, "0")} 層 階`));
  const roomTag = `${stageTitle} — ${floorLabel}`;

  ctx.save();
  if (isDarkDungeon) {
    ctx.fillStyle = "rgba(15, 23, 42, 0.55)";
    ctx.fillRect(24, 30, W - 48, 22);
    ctx.strokeStyle = "rgba(250, 204, 21, 0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(24, 30, W - 48, 22);
  }

  ctx.fillStyle = isDarkDungeon ? "rgba(226, 232, 240, 0.90)" : "rgba(45, 55, 72, 0.88)";
  ctx.font = "bold 11px sans-serif";

  ctx.textAlign = "left";
  ctx.fillText(`DATE 日付: ${dateStr}`, 34, 45);

  ctx.textAlign = "center";
  ctx.fillStyle = isDarkDungeon ? "#facc15" : "#1e293b";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText(roomTag, HALF_W, 45);

  ctx.textAlign = "right";
  ctx.fillStyle = isDarkDungeon ? "rgba(226, 232, 240, 0.90)" : "rgba(45, 55, 72, 0.88)";
  ctx.font = "bold 11px sans-serif";
  ctx.fillText(`TIME 時刻: ${timeStr}`, W - 34, 45);
  ctx.restore();
}

function drawActiveScreenBackground(scr) {
  const customBg = resolveScreenBackgroundImage(scr);
  const isDarkDungeon = Boolean(customBg);

  // 1. Open cream notebook spread
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0.00, "#ede7d8");
  grad.addColorStop(0.47, "#f7f4eb");
  grad.addColorStop(0.50, "#d8d0be");
  grad.addColorStop(0.53, "#f7f4eb");
  grad.addColorStop(1.00, "#ede7d8");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 2. Dungeon background template overlay
  if (customBg) {
    ctx.save();
    ctx.globalAlpha = 0.68;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(customBg, 0, 0, game.worldW, game.worldH);
    ctx.imageSmoothingEnabled = true;

    const flicker = 0.04 + Math.sin(game.elapsedTime * 7.5) * 0.02;
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = `rgba(251, 146, 60, ${flicker})`;
    ctx.fillRect(0, 0, game.worldW, game.worldH);
    ctx.restore();
  }

  // 3. Notebook ruled lines, margin lines & spine crease
  drawRuledPage(0, 0, scr.pageLeft, true, isDarkDungeon);
  drawRuledPage(HALF_W, 0, scr.pageRight, false, isDarkDungeon);

  ctx.save();
  ctx.strokeStyle = isDarkDungeon ? "rgba(15, 23, 42, 0.48)" : "rgba(80, 75, 65, 0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(HALF_W, 0);
  ctx.lineTo(HALF_W, H);
  ctx.stroke();
  ctx.restore();

  drawNotebookHeaderOverlay(isDarkDungeon);

  // Platforms & boundary walls
  for (const s of scr.solids) {
    if (isDarkDungeon) {
      ctx.fillStyle = s.hatched ? "#1c1917" : "#44403c";
      ctx.fillRect(s.x, s.y, s.w, s.h);

      ctx.fillStyle = s.hatched ? "#57534e" : "#a8a29e";
      ctx.fillRect(s.x, s.y, s.w, 3);

      ctx.strokeStyle = "#0c0a09";
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x, s.y, s.w, s.h);

      if (!s.hatched && s.w >= 48) {
        ctx.strokeStyle = "rgba(12, 10, 9, 0.55)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let bx = s.x + 32; bx < s.x + s.w - 8; bx += 32) {
          ctx.moveTo(bx, s.y + 3);
          ctx.lineTo(bx, s.y + s.h);
        }
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = s.hatched ? "#f2ede0" : "#1e293b";
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(s.x, s.y, s.w, s.h);

      if (s.hatched) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(s.x, s.y, s.w, s.h);
        ctx.clip();
        ctx.strokeStyle = "rgba(30, 41, 59, 0.65)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let hx = s.x - s.h; hx < s.x + s.w + s.h; hx += 34) {
          ctx.moveTo(hx + 16, s.y + 4);
          ctx.lineTo(hx - 12, s.y + s.h - 4);
        }
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // Red one-way drop-through hatches
  for (const p of scr.oneWay) {
    ctx.fillStyle = isDarkDungeon ? "#f87171" : "#dc2626";
    ctx.fillRect(p.x, p.y, p.w, 4);
    ctx.fillStyle = isDarkDungeon ? "#b91c1c" : "#dc2626";
    ctx.fillRect(p.x, p.y + 7, p.w, 2.5);
  }

  // Ladders
  for (const l of scr.ladders) {
    if (isDarkDungeon) {
      ctx.strokeStyle = "#0c0a09";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(l.x + 5, l.y);
      ctx.lineTo(l.x + 5, l.y + l.h);
      ctx.moveTo(l.x + l.w - 5, l.y);
      ctx.lineTo(l.x + l.w - 5, l.y + l.h);
      for (let ry = l.y + 14; ry < l.y + l.h; ry += 22) {
        ctx.moveTo(l.x + 5, ry);
        ctx.lineTo(l.x + l.w - 5, ry);
      }
      ctx.stroke();

      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(l.x + 5, l.y);
      ctx.lineTo(l.x + 5, l.y + l.h);
      ctx.moveTo(l.x + l.w - 5, l.y);
      ctx.lineTo(l.x + l.w - 5, l.y + l.h);
      for (let ry = l.y + 14; ry < l.y + l.h; ry += 22) {
        ctx.moveTo(l.x + 5, ry);
        ctx.lineTo(l.x + l.w - 5, ry);
      }
      ctx.stroke();
    } else {
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(l.x + 5, l.y);
      ctx.lineTo(l.x + 5, l.y + l.h);
      ctx.moveTo(l.x + l.w - 5, l.y);
      ctx.lineTo(l.x + l.w - 5, l.y + l.h);
      for (let ry = l.y + 14; ry < l.y + l.h; ry += 22) {
        ctx.moveTo(l.x + 5, ry);
        ctx.lineTo(l.x + l.w - 5, ry);
      }
      ctx.stroke();
    }
  }
}

function drawRuledPage(px, py, pageNum, isLeft, isDarkDungeon = false) {
  const padX = 28;
  const headerY = py + 52;
  const footerY = py + H - 28;
  const lineGap = 24;

  ctx.save();
  ctx.strokeStyle = isDarkDungeon ? "rgba(226, 232, 240, 0.22)" : "rgba(130, 145, 165, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = headerY; y <= footerY; y += lineGap) {
    ctx.moveTo(px + padX, y + 0.5);
    ctx.lineTo(px + HALF_W - padX, y + 0.5);
  }
  ctx.stroke();

  const marginX = isLeft ? (px + padX + 26) : (px + HALF_W - padX - 26);
  ctx.strokeStyle = isDarkDungeon ? "rgba(248, 113, 113, 0.22)" : "rgba(220, 38, 38, 0.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(marginX + 0.5, headerY - 12);
  ctx.lineTo(marginX + 0.5, footerY + 6);
  ctx.stroke();

  if (pageNum !== undefined && pageNum !== null) {
    ctx.fillStyle = isDarkDungeon ? "rgba(226, 232, 240, 0.65)" : "rgba(110, 115, 125, 0.8)";
    ctx.font = "11px monospace";
    ctx.fillText(String(pageNum), isLeft ? px + padX + 6 : px + HALF_W - padX - 24, footerY + 16);
  }
  ctx.restore();
}

function drawSubtleExitMark(scr) {
  const exit = scr.exit;
  if (!exit) return;

  const isDarkDungeon = Boolean(resolveScreenBackgroundImage(scr));
  const isLocked = Boolean(exit.lockedUntilBossDead && !game.bossDefeated);
  if (isLocked) {
    ctx.save();
    ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
    ctx.fillStyle = "rgba(15, 23, 42, 0.45)";
    ctx.lineWidth = 2;
    ctx.fillRect(exit.x, exit.y, exit.w, exit.h);
    ctx.strokeRect(exit.x, exit.y, exit.w, exit.h);
    ctx.fillStyle = "#f87171";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("LOCKED 鎖定 ロック", exit.x + exit.w / 2, exit.y - 6);
    ctx.restore();
    return;
  }

  const isVault = Boolean(scr.isFinal || exit.label === "VAULT");
  const pulse = 0.65 + Math.sin(game.elapsedTime * 5) * 0.30;
  const wobble = Math.sin(game.elapsedTime * 5) * 3;
  const cx = exit.x + exit.w / 2;

  if (isVault) {
    ctx.save();
    ctx.strokeStyle = isDarkDungeon ? `rgba(250, 204, 21, ${pulse})` : `rgba(180, 83, 9, ${pulse})`;
    ctx.fillStyle = "rgba(254, 243, 199, 0.28)";
    ctx.lineWidth = 2.5;
    ctx.fillRect(exit.x, exit.y, exit.w, exit.h);
    ctx.strokeRect(exit.x, exit.y, exit.w, exit.h);

    ctx.fillStyle = "#1e293b";
    ctx.fillRect(exit.x - 28, exit.y - 20, exit.w + 56, 17);
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(exit.x - 28, exit.y - 20, exit.w + 56, 17);

    ctx.fillStyle = "#facc15";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("FINISH 終點 ゴール", cx, exit.y - 8);

    ctx.strokeStyle = isDarkDungeon ? `rgba(250, 204, 21, ${pulse})` : `rgba(217, 119, 6, ${pulse})`;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cx - 4 + wobble, exit.y + exit.h - 32);
    ctx.lineTo(cx + 3 + wobble, exit.y + exit.h - 26);
    ctx.lineTo(cx - 4 + wobble, exit.y + exit.h - 20);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const isUp = exit.dir === "up" || (exit.w >= exit.h && exit.y < H * 0.72);
  const cy = isUp ? (exit.y + exit.h * 0.5 + wobble) : (exit.y + exit.h - 26);
  const offsetX = isUp ? 0 : wobble;

  ctx.save();
  ctx.translate(cx + offsetX, cy);
  if (isUp) ctx.rotate(-Math.PI / 2);

  ctx.strokeStyle = isDarkDungeon ? `rgba(250, 204, 21, ${pulse})` : `rgba(30, 41, 59, ${pulse})`;
  ctx.fillStyle = game.bossArmed ? `rgba(239, 68, 68, ${pulse})` : `rgba(250, 204, 21, ${pulse})`;
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.arc(-6, 0, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(6, 0);
  ctx.lineTo(0, 6);
  ctx.stroke();

  ctx.restore();
}

function drawScreenEntities(scr) {
  const isDarkDungeon = Boolean(resolveScreenBackgroundImage(scr));
  if (scr.exit) {
    drawSubtleExitMark(scr);
  }

  for (const p of scr.pickups) {
    if (p.collected) continue;
    const bob = Math.sin(game.elapsedTime * 5) * 3;
    if (p.type === "crown") {
      if (EXTRA_SPRITES.crown.loaded) {
        ctx.drawImage(EXTRA_SPRITES.crown, p.x, p.y + bob, p.w, p.h);
      } else {
        ctx.strokeStyle = "#dc2626";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(p.x + 3, p.y + p.h - 3 + bob);
        ctx.lineTo(p.x + 2, p.y + 5 + bob);
        ctx.lineTo(p.x + 8, p.y + 11 + bob);
        ctx.lineTo(p.x + 13, p.y + 2 + bob);
        ctx.lineTo(p.x + 18, p.y + 11 + bob);
        ctx.lineTo(p.x + 24, p.y + 5 + bob);
        ctx.lineTo(p.x + 23, p.y + p.h - 3 + bob);
        ctx.closePath();
        ctx.stroke();
      }
    } else if (p.type === "chicken") {
      if (EXTRA_SPRITES.chicken.loaded) {
        ctx.drawImage(EXTRA_SPRITES.chicken, p.x, p.y + bob, p.w, p.h);
      } else {
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(p.x + 17, p.y + 22 + bob, 16, 5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#d97706";
        ctx.beginPath();
        ctx.ellipse(p.x + 15, p.y + 15 + bob, 11, 7, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fffbeb";
        ctx.fillRect(p.x + 24, p.y + 9 + bob, 8, 4);
        ctx.strokeRect(p.x + 24, p.y + 9 + bob, 8, 4);
      }
    } else if (p.type === "hat") {
      if (EXTRA_SPRITES.hat.loaded) {
        const src = EXTRA_SPRITES.hat.canvas || EXTRA_SPRITES.hat.img;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(src, p.x, p.y + bob, p.w, p.h);
        ctx.imageSmoothingEnabled = true;
      } else {
        ctx.fillStyle = "#eab308";
        ctx.fillRect(p.x + 4, p.y + 4 + bob, 22, 12);
        ctx.fillRect(p.x, p.y + 15 + bob, 30, 5);
        ctx.fillStyle = "#dc2626";
        ctx.fillRect(p.x + 12, p.y + bob, 6, 6);
      }
      ctx.fillStyle = isDarkDungeon ? "#facc15" : "#1e293b";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("頂帽大炮 / CANNON HAT / 大砲帽", p.x + p.w * 0.5, p.y - 3 + bob);
      ctx.textAlign = "left";
    } else if (p.type === "treasure") {
      const sheetItems = EXTRA_SPRITES.treasureSheet?.items;
      const variant = p.treasureVariant ?? 0;
      const chestCanvas = (EXTRA_SPRITES.treasureSheet?.loaded && sheetItems && sheetItems.length > 0)
        ? sheetItems[variant % sheetItems.length]
        : null;

      if (chestCanvas) {
        const aspect = chestCanvas.width / chestCanvas.height;
        const drawH = p.h;
        const drawW = Math.round(drawH * aspect);
        const drawX = Math.round(p.x + (p.w - drawW) * 0.5);
        const drawY = Math.round(p.y);

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(chestCanvas, drawX, drawY, drawW, drawH);
        ctx.imageSmoothingEnabled = true;

        const sparkle = 0.5 + 0.5 * Math.sin(game.elapsedTime * 6 + variant * 2.1);
        ctx.fillStyle = `rgba(250, 204, 21, ${0.4 + sparkle * 0.6})`;
        ctx.fillRect(drawX + drawW * 0.5 - 1, drawY - 5 - sparkle * 2, 2, 5);
        ctx.fillRect(drawX + drawW * 0.5 - 3, drawY - 3 - sparkle * 2, 6, 2);
      } else if (EXTRA_SPRITES.treasure.loaded) {
        ctx.drawImage(EXTRA_SPRITES.treasure, p.x, p.y, p.w, p.h);
      } else {
        ctx.fillStyle = "#b45309";
        ctx.fillRect(p.x, p.y + 8, p.w, p.h - 8);
        ctx.fillStyle = "#fbbf24";
        ctx.fillRect(p.x - 2, p.y + 2, p.w + 4, 9);
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y + 2, p.w, p.h - 2);
      }
    }
  }

  for (const e of scr.enemies) {
    if (!e.alive) continue;
    if (e.kind === "alien") drawAlienEnemy(e, isDarkDungeon);
    else if (e.kind === "blade") drawBladeEnemy(e);
    else if (e.kind === "knifer") drawKniferEnemy(e);
    else if (e.kind === "giant") drawAxeGiant(e);
  }
}

function drawAlienEnemy(e, isDarkDungeon = false) {
  ctx.save();
  ctx.translate(e.x + e.w / 2, e.y + e.h);
  ctx.scale(-e.facing, 1);

  if (EXTRA_SPRITES.alien.loaded) {
    const src = EXTRA_SPRITES.alien.canvas || EXTRA_SPRITES.alien.img;
    const drawW = e.w * 1.45;
    const drawH = e.h;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, -drawW * 0.5, -drawH, drawW, drawH);
    if (e.hurtTimer > 0) {
      drawRedFlashSprite(src, -drawW * 0.5, -drawH, drawW, drawH, 0.72);
    }
    ctx.imageSmoothingEnabled = true;
  } else {
    ctx.fillStyle = e.hurtTimer > 0 ? "#ef4444" : "#22c55e";
    ctx.fillRect(-12, -52, 24, 52);
    ctx.fillStyle = e.hurtTimer > 0 ? "#dc2626" : "#475569";
    ctx.fillRect(-20, -74, 40, 22);
  }
  ctx.restore();

  ctx.fillStyle = "#1e293b";
  ctx.fillRect(e.x, e.y - 10, e.w, 4);
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(e.x, e.y - 10, e.w * Math.max(0, e.hp / e.maxHp), 4);

  ctx.fillStyle = isDarkDungeon ? "#facc15" : "#0f172a";
  ctx.font = "bold 9px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("頂帽大炮 / HAT CANNON / 大砲帽", e.x + e.w / 2, e.y - 14);

  if (e.cannonWindingUp) {
    ctx.fillStyle = "#f87171";
    ctx.font = "bold 10px sans-serif";
    ctx.fillText("FIRE! 開火! 発射!", e.x + e.w / 2, e.y - 25);
  }
  ctx.textAlign = "left";
}

function drawBladeEnemy(e) {
  ctx.save();
  const step = Math.floor(e.animTimer * (e.alerted ? 16 : 10));
  const bobY = step % 2 === 0 ? -2.5 : 0;
  ctx.translate(e.x + e.w / 2, e.y + e.h + bobY);
  ctx.scale(e.facing, 1);

  if (EXTRA_SPRITES.blade.loaded) {
    const src = EXTRA_SPRITES.blade.canvas || EXTRA_SPRITES.blade.img;
    const drawW = e.w * 1.42;
    const drawH = e.h;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, -drawW * 0.38, -drawH, drawW, drawH);
    if (e.hurtTimer > 0) {
      drawRedFlashSprite(src, -drawW * 0.38, -drawH, drawW, drawH, 0.72);
    }
    ctx.imageSmoothingEnabled = true;
  } else {
    ctx.strokeStyle = e.hurtTimer > 0 ? "#dc2626" : "#1e293b";
    ctx.fillStyle = e.hurtTimer > 0 ? "#ef4444" : "#f8fafc";
    ctx.lineWidth = 2;
    ctx.fillRect(-10, -40, 20, 24);
    ctx.strokeRect(-10, -40, 20, 24);
    ctx.beginPath();
    ctx.arc(0, -47, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  if (e.slashTimer > 0) {
    ctx.strokeStyle = "rgba(220, 38, 38, 0.88)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(10, -e.h * 0.48, 28, -1.2, 0.7);
    ctx.stroke();
  }

  ctx.restore();

  ctx.fillStyle = "#1e293b";
  ctx.fillRect(e.x, e.y - 9, e.w, 4);
  ctx.fillStyle = e.alerted ? "#dc2626" : "#64748b";
  ctx.fillRect(e.x, e.y - 9, e.w * Math.max(0, e.hp / e.maxHp), 4);
}

function drawKniferEnemy(e) {
  const isDashing = e.aiState === "DASH_STAB";
  const isWindup = e.aiState === "DASH_WINDUP";
  const cleanSrc = getCleanKniferCanvas();
  const hasSprite = Boolean(cleanSrc);

  // Preserve exact natural aspect ratio of the floor-removed sprite so he never looks stretched/squished
  let drawW = e.w * 1.15;
  let drawH = Math.max(e.h, 54);
  if (hasSprite) {
    const sw = cleanSrc.naturalWidth || cleanSrc.width || 1;
    const sh = cleanSrc.naturalHeight || cleanSrc.height || 1;
    drawH = Math.max(e.h, 54);
    drawW = drawH * (sw / sh);
  }

  if (isDashing && hasSprite) {
    for (let t = 1; t <= 2; t++) {
      ctx.save();
      ctx.globalAlpha = 0.28 / t;
      ctx.translate(e.x + e.w / 2 - (e.facing || 1) * t * 11, e.y + e.h);
      ctx.scale(e.facing || 1, 1);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(cleanSrc, -drawW * 0.48, -drawH, drawW, drawH);
      ctx.restore();
    }
  }

  ctx.save();
  const step = Math.floor(e.animTimer * (isDashing ? 20 : 11));
  const bobY = isDashing || isWindup ? 0 : (step % 2 === 0 ? -2 : 0);
  const crouchScaleY = isWindup ? 0.92 : 1.0;
  const leanTilt = isDashing ? 0.16 : (isWindup ? -0.12 : 0);

  ctx.translate(e.x + e.w / 2, e.y + e.h + bobY);
  ctx.scale(e.facing || 1, crouchScaleY);
  ctx.rotate(leanTilt);

  if (hasSprite) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cleanSrc, -drawW * 0.48, -drawH, drawW, drawH);
    if (e.hurtTimer > 0) {
      drawRedFlashSprite(cleanSrc, -drawW * 0.48, -drawH, drawW, drawH, 0.72);
    }
    ctx.imageSmoothingEnabled = true;
  } else {
    ctx.fillStyle = e.hurtTimer > 0 ? "#ef4444" : "#334155";
    ctx.strokeStyle = e.hurtTimer > 0 ? "#dc2626" : "#0f172a";
    ctx.lineWidth = 2;
    ctx.fillRect(-9, -36, 18, 22);
    ctx.strokeRect(-9, -36, 18, 22);
    ctx.beginPath();
    ctx.arc(0, -42, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(8, -28);
    ctx.lineTo(22, -25);
    ctx.lineTo(8, -22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  if (isDashing || isWindup) {
    ctx.strokeStyle = isDashing ? "rgba(250, 204, 21, 0.95)" : "rgba(248, 113, 113, 0.85)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(8, -drawH * 0.46);
    ctx.lineTo(isDashing ? 28 : 18, -drawH * 0.46);
    ctx.stroke();
  }

  ctx.restore();

  const barY = e.y + e.h - drawH - 7;
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(e.x, barY, e.w, 4);
  ctx.fillStyle = isDashing ? "#facc15" : (e.alerted ? "#f97316" : "#64748b");
  ctx.fillRect(e.x, barY, e.w * Math.max(0, e.hp / e.maxHp), 4);
}

function drawAxeGiant(g) {
  ctx.save();
  const isCharging = g.aiState === "CHARGE_RUN";
  const isWinding = g.aiState === "STAND_WINDUP" || g.aiState === "CHARGE_WINDUP";
  const isSwinging = g.aiState === "STAND_STRIKE" || isCharging;
  const step = Math.floor(g.animTimer * (isCharging ? 15 : 9));

  const bobY = (g.aiState === "PATROL" || g.aiState === "WALK" || g.aiState === "CHASE" || isCharging)
    ? (step % 2 === 0 ? -4 : 0)
    : 0;
  const tilt = isCharging
    ? 0.16
    : (isWinding ? -0.16 : (g.aiState === "STAND_STRIKE" ? 0.14 : (step % 2 === 0 ? -0.04 : 0.04)));

  ctx.translate(g.x + g.w / 2, g.y + g.h + bobY);
  ctx.scale(g.facing, 1);
  ctx.rotate(tilt);

  if (EXTRA_SPRITES.giant.loaded) {
    const src = EXTRA_SPRITES.giant.canvas || EXTRA_SPRITES.giant.img;
    const drawW = g.w * 1.48;
    const drawH = g.h;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, -drawW * 0.40, -drawH, drawW, drawH);
    if (g.hurtTimer > 0) {
      drawRedFlashSprite(src, -drawW * 0.40, -drawH, drawW, drawH, 0.72);
    }
    ctx.imageSmoothingEnabled = true;

    if (g.isBoss) {
      ctx.fillStyle = "#facc15";
      ctx.fillRect(-14, -drawH - 6, 28, 6);
    }
  } else {
    const scaleMult = g.h / 92;
    ctx.save();
    ctx.scale(scaleMult, scaleMult);
    ctx.strokeStyle = g.hurtTimer > 0 ? "#dc2626" : (g.isBoss ? "#7f1d1d" : "#1e293b");
    ctx.fillStyle = g.hurtTimer > 0 ? "#ef4444" : (g.isBoss ? "#fde68a" : "#e2e8f0");
    ctx.lineWidth = 2.6;

    ctx.fillRect(-18, -32, 13, 32);
    ctx.strokeRect(-18, -32, 13, 32);
    ctx.fillRect(5, -32, 13, 32);
    ctx.strokeRect(5, -32, 13, 32);
    ctx.fillRect(-24, -76, 48, 44);
    ctx.strokeRect(-24, -76, 48, 44);

    ctx.beginPath();
    ctx.arc(0, -88, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  if (isSwinging) {
    const arcRadius = g.weaponLength || 68;
    ctx.strokeStyle = isCharging ? "rgba(245, 158, 11, 0.85)" : "rgba(220, 38, 38, 0.80)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(12, -g.h * 0.55, arcRadius * 0.82, -1.45, 0.55);
    ctx.stroke();
  }

  ctx.restore();

  ctx.fillStyle = "#1e293b";
  ctx.fillRect(g.x, g.y - 12, g.w, 6);
  ctx.fillStyle = g.isBoss ? "#f59e0b" : (g.alerted ? "#dc2626" : "#64748b");
  ctx.fillRect(g.x + 1, g.y - 11, (g.w - 2) * Math.max(0, g.hp / g.maxHp), 4);

  if (g.aiState === "CHARGE_WINDUP" || isCharging) {
    ctx.fillStyle = "#dc2626";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("CHARGE! 衝鋒! 突撃!", g.x + g.w / 2, g.y - 18);
    ctx.textAlign = "left";
  } else if (g.alertTimer > 0) {
    ctx.fillStyle = "#facc15";
    ctx.font = "bold 15px monospace";
    ctx.textAlign = "center";
    ctx.fillText("!", g.x + g.w / 2, g.y - 18);
    ctx.textAlign = "left";
  }
}

function drawSpriteLayer(layer, dx, dy, dw, dh, clipZone = null) {
  if (!layer || !layer.loaded) return false;
  const src = layer.canvas || layer.img;
  const prevSmooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  if (clipZone) {
    const [rx, ry, rw, rh] = clipZone;
    ctx.save();
    ctx.beginPath();
    ctx.rect(dx + dw * rx, dy + dh * ry, dw * rw, dh * rh);
    ctx.clip();
    ctx.drawImage(src, dx, dy, dw, dh);
    ctx.restore();
  } else {
    ctx.drawImage(src, dx, dy, dw, dh);
  }
  ctx.imageSmoothingEnabled = prevSmooth;
  return true;
}

function drawAnimatedSpriteLegs(legLayer, spriteW, spriteH, animState, animTimer) {
  const src = legLayer.canvas || legLayer.img;
  const legTopRatio = 0.66;
  const legY = -spriteH * (1 - legTopRatio);
  const legH = spriteH * (1 - legTopRatio);

  if (animState !== "RUN" && animState !== "CLIMB" && animState !== "JUMP") {
    drawSpriteLayer(legLayer, -spriteW / 2, -spriteH, spriteW, spriteH, [0, legTopRatio, 1, 1 - legTopRatio]);
    return;
  }

  const phase = animState === "JUMP" ? 0.9 : Math.sin(animTimer);
  const strideX = phase * 5.5;
  const liftLeft = animState === "JUMP" ? -2.5 : Math.max(0, -phase) * -3.5;
  const liftRight = animState === "JUMP" ? -1.0 : Math.max(0, phase) * -3.5;

  const prevSmooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;

  ctx.save();
  ctx.beginPath();
  ctx.rect(-spriteW / 2 + strideX, legY + liftLeft, spriteW * 0.52, legH + 4);
  ctx.clip();
  ctx.drawImage(src, -spriteW / 2 + strideX, -spriteH + liftLeft, spriteW, spriteH);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(-strideX, legY + liftRight, spriteW * 0.52, legH + 4);
  ctx.clip();
  ctx.drawImage(src, -spriteW / 2 - strideX, -spriteH + liftRight, spriteW, spriteH);
  ctx.restore();

  ctx.imageSmoothingEnabled = prevSmooth;
}

function drawAimingGunArm(localAimAngle, hasGunRecoil, isTremor) {
  const clampedAngle = Math.max(-1.25, Math.min(1.25, localAimAngle));
  const jitter = isTremor ? Math.sin(game.elapsedTime * 55) * 0.06 : 0;

  ctx.save();
  ctx.translate(4, -38.5);
  ctx.rotate(clampedAngle + jitter);

  const recoilX = hasGunRecoil ? -2.5 : 0;

  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = isTremor ? 2.0 : 2.8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(7 + recoilX, 0);
  ctx.stroke();

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(6 + recoilX, -2.0, 13, 3.4);
  ctx.fillRect(7 + recoilX, 1.0, 3.2, 4.2);

  if (hasGunRecoil) {
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.moveTo(20 + recoilX, -1.0);
    ctx.lineTo(26 + recoilX, -3.8);
    ctx.lineTo(24 + recoilX, -0.3);
    ctx.lineTo(27 + recoilX, 2.6);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawEquippedCannonHat(topHeadY) {
  ctx.save();
  ctx.scale(-1, 1);
  if (EXTRA_SPRITES.hat.loaded) {
    const src = EXTRA_SPRITES.hat.canvas || EXTRA_SPRITES.hat.img;
    const hatW = 36;
    const hatH = 26;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, -hatW * 0.56, topHeadY - hatH + 5, hatW, hatH);
    ctx.imageSmoothingEnabled = true;
  } else {
    const ready = hero.hatAmmo > 0;
    ctx.fillStyle = ready ? "#facc15" : "#854d0e";
    ctx.fillRect(-10, topHeadY - 4, 20, 4);
    ctx.fillRect(-6, topHeadY - 10, 12, 6);
  }
  ctx.restore();
}

function drawLayeredCharacter(footX, footY, scaleFactor, activeTraits, timeSec, opts = {}) {
  const spriteW = 54;
  const spriteH = 66;
  const facing = opts.facing ?? 1;
  const runTilt = opts.runTilt ?? 0;
  const animState = opts.animState ?? "IDLE";
  const animTimer = opts.animTimer ?? 0;
  const orderList = opts.selectedOrder && opts.selectedOrder.length > 0
    ? opts.selectedOrder
    : TRAIT_ORDER.filter(id => activeTraits[id]);

  const rawHeadAngle = opts.showAimGun ? (opts.localAimAngle ?? 0) * 0.65 : 0;
  const headAngle = Math.max(-0.75, Math.min(0.75, rawHeadAngle));

  ctx.save();
  ctx.translate(footX, footY);
  ctx.scale(facing * scaleFactor, scaleFactor);
  ctx.rotate(runTilt);

  const hasBaseSprite = CHAR_LAYERS.base.loaded;
  if (hasBaseSprite) {
    drawSpriteLayer(CHAR_LAYERS.base, -spriteW / 2, -spriteH, spriteW, spriteH, [0, 0.37, 1, 0.34]);

    const legLayer = (activeTraits.prosthesis && CHAR_LAYERS.prosthesis.loaded)
      ? CHAR_LAYERS.prosthesis
      : CHAR_LAYERS.base;
    drawAnimatedSpriteLegs(legLayer, spriteW, spriteH, animState, animTimer);

    for (const traitId of orderList) {
      if (!activeTraits[traitId] || traitId === "prosthesis" || traitId === "blind" || traitId === "deaf") continue;
      const layer = CHAR_LAYERS[traitId];
      const zone = TRAIT_BODY_ZONES[traitId] || null;
      if (layer && layer.loaded) {
        drawSpriteLayer(layer, -spriteW / 2, -spriteH, spriteW, spriteH, zone);
      }
    }

    ctx.save();
    ctx.translate(0, -40);
    ctx.rotate(headAngle);
    ctx.translate(0, 40);

    drawSpriteLayer(CHAR_LAYERS.base, -spriteW / 2, -spriteH, spriteW, spriteH, [0, 0, 1, 0.415]);
    for (const traitId of orderList) {
      if (!activeTraits[traitId] || (traitId !== "blind" && traitId !== "deaf")) continue;
      const layer = CHAR_LAYERS[traitId];
      const zone = TRAIT_BODY_ZONES[traitId] || null;
      if (layer && layer.loaded) {
        drawSpriteLayer(layer, -spriteW / 2, -spriteH, spriteW, spriteH, zone);
      }
    }
    if (opts.hasMissileHat) {
      drawEquippedCannonHat(-56);
    }
    ctx.restore();
  } else {
    const swing = animState === "RUN" ? Math.sin(animTimer) * 7 : (animState === "CLIMB" ? Math.sin(animTimer) * 5 : 0);
    const liftA = animState === "RUN" ? Math.max(0, -Math.sin(animTimer)) * -3 : 0;
    const liftB = animState === "RUN" ? Math.max(0, Math.sin(animTimer)) * -3 : 0;

    ctx.strokeStyle = activeTraits.prosthesis ? "#94a3b8" : "#1e293b";
    ctx.lineWidth = activeTraits.tremor ? 1.5 : 2.6;
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(-7 + swing, liftA);
    ctx.moveTo(0, -24);
    ctx.lineTo(7 - swing, liftB);
    ctx.stroke();

    ctx.strokeStyle = "#1e293b";
    ctx.beginPath();
    ctx.moveTo(0, -41);
    ctx.lineTo(0, -24);
    ctx.stroke();

    ctx.save();
    ctx.translate(0, -41);
    ctx.rotate(headAngle);
    ctx.translate(0, 41);

    ctx.fillStyle = "#f7f4eb";
    ctx.beginPath();
    ctx.arc(0, -48, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (activeTraits.blind) {
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(3.2, -48.5, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    if (activeTraits.deaf) {
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(-5, -47, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (opts.hasMissileHat) {
      drawEquippedCannonHat(-54);
    }
    ctx.restore();
  }

  if (opts.showAimGun) {
    drawAimingGunArm(opts.localAimAngle ?? 0, opts.gunRecoil ?? false, activeTraits.tremor);
  }

  if (activeTraits.tremor) {
    const quiver = Math.sin(timeSec * 48) * 1.4;
    ctx.strokeStyle = "rgba(100, 116, 139, 0.85)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(4, -27 + quiver);
    ctx.lineTo(13, -29 - quiver);
    ctx.moveTo(6, -24 - quiver);
    ctx.lineTo(14, -26 + quiver);
    ctx.stroke();
  }

  if (activeTraits.asthma && (opts.showPuff || hero.asthma > 35 || hero.asthmaStun > 0)) {
    const puffPhase = (timeSec * (hero.asthmaStun > 0 ? 4 : 1.8)) % 1;
    ctx.fillStyle = `rgba(255, 255, 255, ${(1 - puffPhase) * 0.85})`;
    ctx.strokeStyle = `rgba(100, 116, 139, ${(1 - puffPhase) * 0.65})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(10 + puffPhase * 16, -45 - puffPhase * 6, 2.5 + puffPhase * 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

function drawHero() {
  if (hero.invulnTimer > 0 && Math.floor(hero.invulnTimer * 20) % 2 === 0) return;

  const time = game.elapsedTime;
  const pantY = hero.asthmaStun > 0 ? Math.sin(time * 16) * 2.5 : 0;
  const runBobY = hero.animState === "RUN" ? Math.abs(Math.sin(hero.animTimer)) * -3.5 : 0;
  const runTilt = hero.animState === "RUN" ? Math.sin(hero.animTimer) * 0.045 + hero.facing * 0.04 : 0;
  const climbBobX = hero.animState === "CLIMB" ? Math.sin(hero.animTimer) * 2.5 : 0;
  const jumpSquashY = hero.animState === "JUMP" ? -2.5 : 0;

  const footX = hero.x + hero.w / 2 + climbBobX;
  const footY = hero.y + hero.h + pantY + runBobY + jumpSquashY;

  const localAimAngle = hero.facing === 1
    ? hero.aimAngle
    : Math.atan2(Math.sin(hero.aimAngle), -Math.cos(hero.aimAngle));

  drawLayeredCharacter(footX, footY, 1.0, hero.traits, time, {
    facing: hero.facing,
    runTilt,
    animState: hero.animState,
    animTimer: hero.animTimer,
    hasMissileHat: hero.hasMissileHat,
    selectedOrder: hero.stats.selectedOrder,
    showAimGun: game.state === "PLAY",
    localAimAngle,
    gunRecoil: hero.gunCooldown > GUN_SHOT_INTERVAL * 0.45
  });

  if (hero.traits.asthma && (hero.asthma > 2 || hero.asthmaStun > 0)) {
    const spriteH = 66;
    const barW = 36;
    const barX = footX - barW / 2;
    const barY = footY - spriteH - 10;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(barX, barY, barW, 5);
    ctx.fillStyle = hero.asthmaStun > 0 ? "#ef4444" : (hero.asthmaPending ? "#f59e0b" : "#38bdf8");
    ctx.fillRect(barX + 1, barY + 1, (barW - 2) * (hero.asthma / 100), 3);

    if (hero.asthmaStun > 0) {
      ctx.fillStyle = "#dc2626";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("GASP! 喘息! 息切れ!", footX, barY - 4);
      ctx.textAlign = "left";
    }
  }
}

function drawCannonBallSprite(m) {
  const r = m.r || 11;
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.rotate(m.rot || 0);

  if (EXTRA_SPRITES.cannonball && EXTRA_SPRITES.cannonball.loaded) {
    const src = EXTRA_SPRITES.cannonball.canvas || EXTRA_SPRITES.cannonball.img;
    const size = r * 2.7;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, -size * 0.46, -size * 0.54, size, size);
    ctx.imageSmoothingEnabled = true;
  } else {
    ctx.fillStyle = "#334155";
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#64748b";
    ctx.beginPath();
    ctx.arc(-r * 0.32, -r * 0.32, r * 0.32, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1e293b";
    ctx.fillRect(r * 0.55, -r * 0.85, 5, 5);
    ctx.strokeStyle = "#b45309";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(r * 0.8, -r * 0.7);
    ctx.lineTo(r * 1.35, -r * 1.15);
    ctx.stroke();

    ctx.fillStyle = Math.floor(m.timer * 24) % 2 === 0 ? "#ef4444" : "#facc15";
    ctx.beginPath();
    ctx.arc(r * 1.4, -r * 1.2, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  if (m.fromEnemy || m.timer > 0.75) {
    const pulse = m.timer > 0.75 ? (m.timer - 0.75) / 0.25 : 0.35;
    ctx.save();
    ctx.strokeStyle = `rgba(239, 68, 68, ${0.45 + pulse * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(m.x, m.y, r + 4 + pulse * 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawProjectilesAndAimMark() {
  for (const b of game.bullets) {
    ctx.save();
    ctx.fillStyle = "#1c120c";
    ctx.strokeStyle = "#09090b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#5c4033";
    ctx.beginPath();
    ctx.arc(b.x - 0.8, b.y - 0.8, 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const bone of game.bones) {
    ctx.save();
    ctx.translate(bone.x, bone.y);
    ctx.rotate(bone.rot);
    if (EXTRA_SPRITES.bone.loaded) {
      ctx.drawImage(EXTRA_SPRITES.bone, -10, -5, 20, 10);
    } else {
      ctx.fillStyle = "#fffbeb";
      ctx.strokeStyle = "#78350f";
      ctx.lineWidth = 1.5;
      ctx.fillRect(-9, -2.5, 18, 5);
      ctx.strokeRect(-9, -2.5, 18, 5);
      ctx.beginPath();
      ctx.arc(-9, -3, 3, 0, Math.PI * 2);
      ctx.arc(-9, 3, 3, 0, Math.PI * 2);
      ctx.arc(9, -3, 3, 0, Math.PI * 2);
      ctx.arc(9, 3, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  for (const m of game.missiles) {
    drawCannonBallSprite(m);
  }

  for (const sw of game.shockwaves) {
    const alpha = Math.max(0, sw.life / sw.maxLife);
    ctx.save();
    ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.85})`;
    ctx.fillStyle = `rgba(250, 204, 21, ${alpha * 0.22})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  for (const p of game.particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    if (p.sparkle) {
      const r = p.size * (0.45 + 0.55 * alpha);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(p.x - r, p.y);
      ctx.lineTo(p.x + r, p.y);
      ctx.moveTo(p.x, p.y - r);
      ctx.lineTo(p.x, p.y + r);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(p.x - 0.8, p.y - 0.8, 1.6, 1.6);
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }
  ctx.globalAlpha = 1;

  if (game.state === "PLAY") {
    const ax = game.aimWorldX;
    const ay = game.aimWorldY;
    ctx.save();
    ctx.strokeStyle = hero.gunReloadTimer > 0 ? "#94a3b8" : (hero.traits.tremor ? "#ea580c" : "#dc2626");
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ax, ay, 11, 0, Math.PI * 2);
    ctx.moveTo(ax - 16, ay); ctx.lineTo(ax - 6, ay);
    ctx.moveTo(ax + 6, ay);  ctx.lineTo(ax + 16, ay);
    ctx.moveTo(ax, ay - 16); ctx.lineTo(ax, ay - 6);
    ctx.moveTo(ax, ay + 6);  ctx.lineTo(ax, ay + 16);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBlindSightMask() {
  if (!hero.traits.blind || game.state === "VICTORY_WALK") return;

  const zoom = getActiveCamZoom();
  const sx = (hero.x + hero.w / 2 - game.camX) * zoom;
  const sy = (hero.y + hero.h * 0.45 - game.camY) * zoom;
  const sightRadius = (hero.stats?.sightRadius ?? 310) * zoom;

  blurCtx.save();
  blurCtx.clearRect(0, 0, W, H);
  blurCtx.filter = "blur(9px) brightness(0.24)";
  blurCtx.drawImage(canvas, 0, 0);
  blurCtx.restore();

  blurCtx.save();
  blurCtx.globalCompositeOperation = "destination-out";
  const holeGrad = blurCtx.createRadialGradient(sx, sy, sightRadius * 0.65, sx, sy, sightRadius);
  holeGrad.addColorStop(0, "rgba(0, 0, 0, 1)");
  holeGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  blurCtx.fillStyle = holeGrad;
  blurCtx.beginPath();
  blurCtx.arc(sx, sy, sightRadius, 0, Math.PI * 2);
  blurCtx.fill();
  blurCtx.restore();

  ctx.drawImage(blurCanvas, 0, 0);
}

function drawHUD() {
  game.hudButtons.length = 0;

  ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
  ctx.fillRect(0, 0, W, 26);

  ctx.fillStyle = "#facc15";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText(`${hero.identity.zhName} ${hero.identity.enName} (${hero.identity.anchors})`, 8, 17);

  ctx.font = "bold 11.5px sans-serif";
  ctx.fillStyle = "#ef4444";
  ctx.fillText(`HP命:`, 220, 17);
  ctx.fillStyle = "#334155";
  ctx.fillRect(256, 7, 58, 12);
  ctx.fillStyle = "#22c55e";
  ctx.fillRect(256, 7, Math.max(0, hero.hp * 0.58), 12);

  if (hero.gunReloadTimer > 0) {
    ctx.fillStyle = "#fb923c";
    ctx.fillText(`GUN銃:RLD裝填`, 322, 17);
  } else {
    ctx.fillStyle = "#38bdf8";
    const roundsLeft = hero.gunBurstRemaining > 0 ? hero.gunBurstRemaining : GUN_BURST_COUNT;
    ctx.fillText(`GUN銃:${roundsLeft}/${GUN_BURST_COUNT}`, 322, 17);
  }

  ctx.fillStyle = "#fef08a";
  ctx.fillText(`BN骨:${hero.bones}`, 414, 17);

  if (!hero.hasMissileHat) {
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`HAT帽:--`, 472, 17);
  } else if (hero.hatAmmo > 0) {
    ctx.fillStyle = "#facc15";
    ctx.fillText(`HAT帽:${hero.hatAmmo}/${CANNON_ROUNDS_PER_ROOM}`, 472, 17);
  } else {
    ctx.fillStyle = "#fb923c";
    ctx.fillText(`HAT帽:0/${CANNON_ROUNDS_PER_ROOM}`, 472, 17);
  }

  const atkMult = getCompoundAttackMultiplier(game.transitions);
  ctx.fillStyle = "#38bdf8";
  const stageBadge = game.roomType === "BOSS"
    ? "BOSS首領"
    : (game.roomType === "TREASURE" ? "VAULT寶庫" : `RM層:${game.transitions}`);
  ctx.fillText(stageBadge, 548, 17);

  ctx.fillStyle = atkMult >= 1.5 ? "#f87171" : "#fbbf24";
  ctx.fillText(`ATK攻:x${atkMult.toFixed(2)}`, 624, 17);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 12px monospace";
  ctx.fillText(`${game.score.toString().padStart(6, "0")}`, 714, 17);

  ctx.font = "bold 11px sans-serif";
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText(`[ESC]選角/選択`, 772, 17);
  game.hudButtons.push({
    x: 768, y: 0, w: 94, h: 26,
    onClick: () => returnToCharSelect()
  });

  ctx.fillText(`[M]BGM音`, 872, 17);
  game.hudButtons.push({
    x: 868, y: 0, w: 72, h: 26,
    onClick: () => { if (typeof SFX.toggleMute === "function") SFX.toggleMute(); }
  });

  if (game.roomType === "BOSS" && game.activeScreen) {
    const boss = game.activeScreen.enemies.find(e => e.isBoss && e.alive);
    if (boss) {
      const bw = 460;
      const bx = HALF_W - bw / 2;
      const by = 34;
      ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
      ctx.fillRect(bx - 6, by - 4, bw + 12, 26);
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx - 6, by - 4, bw + 12, 26);

      ctx.fillStyle = "#7f1d1d";
      ctx.fillRect(bx, by + 10, bw, 8);
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(bx, by + 10, bw * Math.max(0, boss.hp / boss.maxHp), 8);

      ctx.fillStyle = "#facc15";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`BOSS 首領 ボス: ${boss.name}  (${boss.hp}/${boss.maxHp} HP | +${boss.scoreValue} PTS/分/点)`, HALF_W, by + 7);
      ctx.textAlign = "left";
    }
  }

  if (game.state === "PLAY" && game.roomType === "RANDOM" && game.transitions >= 10) {
    const btnW = 356;
    const btnH = 32;
    const btnX = W - btnW - 14;
    const btnY = 34;

    ctx.fillStyle = game.bossArmed ? "rgba(22, 163, 74, 0.95)" : "rgba(185, 28, 28, 0.94)";
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 2;
    ctx.strokeRect(btnX, btnY, btnW, btnH);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11.5px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      game.bossArmed
        ? "[B] BOSS ARMED | 首領已鎖定 | ボス戦準備完了"
        : "[B] FACE BOSS | 挑戰首領 | ボスに挑む",
      btnX + btnW / 2,
      btnY + 20
    );
    ctx.textAlign = "left";

    game.hudButtons.push({
      x: btnX,
      y: btnY,
      w: btnW,
      h: btnH,
      onClick: () => {
        game.bossArmed = !game.bossArmed;
        SFX.beep(game.bossArmed ? 560 : 320, 0.12, "square", 0.08);
      }
    });
  }

  if (game.state === "GAMEOVER" || game.state === "VICTORY") {
    ctx.fillStyle = "rgba(15, 23, 42, 0.90)";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    ctx.fillStyle = game.state === "VICTORY" ? "#facc15" : "#f87171";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText(
      game.state === "VICTORY"
        ? "CONGRATZ! TREASURE CLAIMED!  |  恭喜成功尋獲秘寶！"
        : "YOU FELL IN THE DEPTHS!  |  勇者倒於深淵之中！",
      W / 2,
      H / 2 - 84
    );

    ctx.font = "bold 22px sans-serif";
    ctx.fillText(
      game.state === "VICTORY"
        ? "おめでとう！お宝を獲得した！"
        : "ダンジョンの深淵に倒れた…",
      W / 2,
      H / 2 - 48
    );

    const diffLabel = UI_I18N.difficulty[setup.difficulty] || setup.difficulty;
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(
      `${hero.identity.zhName} — ${hero.identity.enName} (${hero.identity.anchors})  [${diffLabel}]`,
      W / 2,
      H / 2 - 8
    );

    ctx.fillStyle = "#facc15";
    ctx.font = "bold 23px sans-serif";
    ctx.fillText(`FINAL SCORE  最終得分  最終スコア: ${game.score}`, W / 2, H / 2 + 30);

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "14px sans-serif";
    ctx.fillText(
      `ROOMS 關卡 階層: ${game.transitions}   |   ENEMY ATK 敵攻: x${atkMult.toFixed(2)}   |   SEED: ${game.runSeed}`,
      W / 2,
      H / 2 + 64
    );

    const retryX = W / 2 - 330;
    const retryY = H / 2 + 88;
    const retryW = 310;
    const retryH = 42;

    ctx.fillStyle = "#16a34a";
    ctx.fillRect(retryX, retryY, retryW, retryH);
    ctx.strokeStyle = "#86efac";
    ctx.lineWidth = 2;
    ctx.strokeRect(retryX, retryY, retryW, retryH);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("[R] NEW RUN  重新開始  もう一度", retryX + retryW / 2, retryY + 26);

    const charX = W / 2 + 20;
    const charY = H / 2 + 88;
    const charW = 310;
    const charH = 42;

    ctx.fillStyle = "#1d4ed8";
    ctx.fillRect(charX, charY, charW, charH);
    ctx.strokeStyle = "#93c5fd";
    ctx.lineWidth = 2;
    ctx.strokeRect(charX, charY, charW, charH);

    ctx.fillStyle = "#ffffff";
    ctx.fillText("[ESC] SELECT  更換角色  キャラ選択", charX + charW / 2, charY + 26);

    ctx.textAlign = "left";

    game.hudButtons.push({
      x: retryX, y: retryY, w: retryW, h: retryH,
      onClick: () => startNewRun()
    });
    game.hudButtons.push({
      x: charX, y: charY, w: charW, h: charH,
      onClick: () => returnToCharSelect()
    });
  }
}

function drawWrappedGuideLines(lines, x, startY, maxWidth, lineHeight, font, color) {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  let curY = startY;

  for (const rawLine of lines) {
    let line = "";
    for (let i = 0; i < rawLine.length; i++) {
      const ch = rawLine[i];
      const testLine = line + ch;
      if (ctx.measureText(testLine).width > maxWidth && line.length > 0) {
        const lastSpace = line.lastIndexOf(" ");
        if (lastSpace > 4 && /[A-Za-z0-9]/.test(ch)) {
          ctx.fillText(line.slice(0, lastSpace), x, curY);
          line = line.slice(lastSpace + 1) + ch;
        } else {
          ctx.fillText(line, x, curY);
          line = ch === " " ? "" : ch;
        }
        curY += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line.length > 0) {
      ctx.fillText(line, x, curY);
      curY += lineHeight;
    }
  }
  ctx.restore();
  return curY;
}

function drawHowToPlayScreen() {
  setup.uiBoxes.length = 0;
  drawActiveScreenBackground(STAGE_001_DEFAULT.screens[0]);

  const panelX = 28;
  const panelY = 16;
  const panelW = W - 56;
  const panelH = H - 32;

  ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(panelX, panelY, panelW, panelH);

  ctx.textAlign = "center";
  ctx.fillStyle = "#facc15";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText("HOW TO PLAY   |   玩法說明   |   遊び方", W / 2, panelY + 30);

  const columns = [
    {
      lang: "ENGLISH",
      accent: "#38bdf8",
      goalTitle: "OBJECTIVE",
      goalLines: [
        "Survive infinite dungeon floors. After 10+ rooms, press [B] to face the Boss, then claim the Treasure Vault!"
      ],
      ctrlTitle: "CONTROLS",
      ctrlLines: [
        "• A / D : Move Left / Right",
        "• W / S : Climb Ladder (S+SPACE: Drop)",
        "• SPACE : Jump",
        `• Mouse + L-Click : ${GUN_BURST_COUNT}-Burst Gun`,
        "• R-Click : Throw Bone (15% Enemy HP)",
        "• F : Super Cannon (2/Room, 200 AoE)",
        "• M : Mute BGM  |  ESC : Char Select"
      ],
      tipTitle: "TRAITS & RELICS",
      tipLines: [
        "• Pick 1 / 3 / 5 traits by difficulty; each alters speed, sight, hearing, or stamina.",
        "• Defeat Room 0's Hat Alien to loot the Super Cannon Hat! Eat Chicken (+50 HP, +2 Bones)."
      ]
    },
    {
      lang: "繁體中文",
      accent: "#facc15",
      goalTitle: "遊戲目標",
      goalLines: [
        "闖過無盡地牢關卡！通過 10 房後按 [B] 召喚首領 (BOSS)，擊敗首領即可進入寶庫奪取珍寶！"
      ],
      ctrlTitle: "操作方式",
      ctrlLines: [
        "• A / D ：左右移動",
        "• W / S ：攀爬梯子 (S+空白鍵 下跳)",
        "• 空白鍵 ：跳躍",
        `• 滑鼠瞄準 + 左鍵 ：${GUN_BURST_COUNT}連發機槍`,
        "• 滑鼠右鍵 ：投擲骨頭 (扣敵15%HP)",
        "• F 鍵 ：頂帽大炮 (每房2發，200範圍傷)",
        "• M 鍵 ：靜音切換  |  ESC ：返回選角"
      ],
      tipTitle: "特質與道具",
      tipLines: [
        "• 依難度選擇 1 / 3 / 5 項身體特質，每項皆會改變速度、視野、聽覺或哮喘體力。",
        "• 擊敗起始房「頂帽外星人」可奪取頂帽大炮！吃烤雞回復 50 HP 並加 2 骨頭。"
      ]
    },
    {
      lang: "日本語",
      accent: "#4ade80",
      goalTitle: "ゲーム目的",
      goalLines: [
        "無限ダンジョンを突破しよう！10部屋クリア後に [B] でボス戦へ挑み、撃破して宝物庫の財宝を獲得！"
      ],
      ctrlTitle: "操作方法",
      ctrlLines: [
        "• A / D ：左右移動",
        "• W / S ：はしご昇降 (S+SPACE 降下)",
        "• SPACE ：ジャンプ",
        `• マウス照準 + 左クリック ：${GUN_BURST_COUNT}連射銃`,
        "• 右クリック ：骨投げ (敵現在HPの15%傷)",
        "• F キー ：シルクハット大砲 (各部屋2発)",
        "• M キー ：消音切替  |  ESC ：キャラ選択"
      ],
      tipTitle: "特性とアイテム",
      tipLines: [
        "• 難易度別に 1 / 3 / 5 個の特性を選択。移動速度・視界・聴覚・スタミナが変化！",
        "• 最初の部屋のハット星人を倒すとシルクハット大砲を入手！チキンでHP50回復＆骨+2。"
      ]
    }
  ];

  const colGap = 12;
  const innerX = panelX + 14;
  const innerW = panelW - 28;
  const colW = Math.floor((innerW - colGap * 2) / 3);
  const colY = panelY + 46;
  const colH = panelH - 114;

  columns.forEach((col, idx) => {
    const cx = innerX + idx * (colW + colGap);
    ctx.fillStyle = "rgba(30, 41, 59, 0.92)";
    ctx.fillRect(cx, colY, colW, colH);
    ctx.strokeStyle = col.accent;
    ctx.lineWidth = 1.8;
    ctx.strokeRect(cx, colY, colW, colH);

    ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
    ctx.fillRect(cx, colY, colW, 28);
    ctx.fillStyle = col.accent;
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(col.lang, cx + colW / 2, colY + 19);

    const padX = 10;
    const textMaxW = colW - padX * 2;
    let yCursor = colY + 46;

    ctx.textAlign = "left";
    ctx.fillStyle = col.accent;
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(`▸ ${col.goalTitle}`, cx + padX, yCursor);
    yCursor = drawWrappedGuideLines(col.goalLines, cx + padX, yCursor + 16, textMaxW, 15, "11.5px sans-serif", "#f8fafc");

    yCursor += 8;
    ctx.fillStyle = col.accent;
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(`▸ ${col.ctrlTitle}`, cx + padX, yCursor);
    yCursor = drawWrappedGuideLines(col.ctrlLines, cx + padX, yCursor + 16, textMaxW, 16, "11.5px sans-serif", "#e2e8f0");

    yCursor += 8;
    ctx.fillStyle = col.accent;
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(`▸ ${col.tipTitle}`, cx + padX, yCursor);
    drawWrappedGuideLines(col.tipLines, cx + padX, yCursor + 16, textMaxW, 15, "11.5px sans-serif", "#cbd5e1");
  });

  const backBtnX = panelX + 14;
  const backBtnY = panelY + panelH - 56;
  const backBtnW = panelW - 28;
  const backBtnH = 44;

  ctx.fillStyle = "#16a34a";
  ctx.fillRect(backBtnX, backBtnY, backBtnW, backBtnH);
  ctx.strokeStyle = "#86efac";
  ctx.lineWidth = 2;
  ctx.strokeRect(backBtnX, backBtnY, backBtnW, backBtnH);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 15px sans-serif";
  ctx.fillText(
    "BACK TO CHARACTER SELECT   |   返回角色選擇   |   キャラクター選択へ戻る   [ESC / CLICK]",
    W / 2,
    backBtnY + 27
  );
  ctx.textAlign = "left";

  setup.uiBoxes.push({
    x: backBtnX,
    y: backBtnY,
    w: backBtnW,
    h: backBtnH,
    onClick: () => {
      setup.showHowToPlay = false;
      SFX.beep(420, 0.08, "square", 0.07);
    }
  });
}

function drawSelectScreen() {
  if (typeof drawIntroCrawlScreen === "function" && setup.showIntroScreen !== false) {
    drawIntroCrawlScreen();
    return;
  }

  if (setup.showHowToPlay) {
    drawHowToPlayScreen();
    return;
  }

  setup.uiBoxes.length = 0;
  drawActiveScreenBackground(STAGE_001_DEFAULT.screens[0]);

  ctx.fillStyle = "rgba(15, 23, 42, 0.90)";
  ctx.fillRect(28, 16, W - 56, H - 32);
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 16, W - 56, H - 32);

  ctx.textAlign = "center";
  ctx.fillStyle = "#facc15";
  ctx.font = "bold 21px sans-serif";
  const titleText = "UNBOUND SEEKERS  無界尋寶錄  アンバウンド・シーカーズ";
  ctx.fillText(titleText, W / 2, 47);

  if (typeof drawGameBadge === "function") {
    const titleHalfW = ctx.measureText(titleText).width * 0.5;
    const miniBadgeSize = 42;
    const badgeOffsetX = titleHalfW + miniBadgeSize * 0.5 + 12;
    drawGameBadge(HALF_W - badgeOffsetX, 44, miniBadgeSize, 0.96);
    drawGameBadge(HALF_W + badgeOffsetX, 44, miniBadgeSize, 0.96);
  }

  ctx.fillStyle = "#cbd5e1";
  ctx.font = "11px sans-serif";
  ctx.fillText(
    `ASDW: Move/移動/移動  |  L-Click: ${GUN_BURST_COUNT}-Burst Gun/連發槍/連射銃  |  R-Click: Bone/骨頭/骨  |  F: Cannon/大炮/大砲  |  [?]: Guide/說明/遊び方`,
    W / 2,
    68
  );

  const diffBtns = [
    { id: "NORMAL",   label: "NORMAL  普通  ノーマル (1) [N]",         x: 46,  y: 82, w: 286, h: 34 },
    { id: "HARD",     label: "HARD  困難  ハード (3) [H]",             x: 346, y: 82, w: 286, h: 34 },
    { id: "ULTIMATE", label: "ULTIMATE  極限  アルティメット (5) [U]", x: 646, y: 82, w: 292, h: 34 }
  ];

  for (const b of diffBtns) {
    const active = setup.difficulty === b.id;
    ctx.fillStyle = active ? (b.id === "ULTIMATE" ? "#c026d3" : "#eab308") : "#1e293b";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = active ? "#fef08a" : "#64748b";
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);

    ctx.fillStyle = active ? (b.id === "ULTIMATE" ? "#ffffff" : "#0f172a") : "#f8fafc";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(b.label, b.x + b.w / 2, b.y + 21);

    setup.uiBoxes.push({ x: b.x, y: b.y, w: b.w, h: b.h, onClick: () => setDifficulty(b.id) });
  }

  const cardW = 630;
  const cardH = 62;
  const startX = 46;
  const startY = 130;
  const gapY = 9;

  TRAIT_ORDER.forEach((traitId, idx) => {
    const t = traitsConfig.traits[traitId];
    if (!t) return;
    const cx = startX;
    const cy = startY + idx * (cardH + gapY);
    const isSelected = setup.selected.includes(traitId);
    const i18n = UI_I18N.traits[traitId] || { ja: "", jaAnchor: t.anchor, jaDesc: "" };

    ctx.fillStyle = isSelected ? "rgba(30, 58, 138, 0.94)" : "rgba(30, 41, 59, 0.9)";
    ctx.fillRect(cx, cy, cardW, cardH);
    ctx.strokeStyle = isSelected ? "#facc15" : "#475569";
    ctx.lineWidth = isSelected ? 2.5 : 1.5;
    ctx.strokeRect(cx, cy, cardW, cardH);

    ctx.textAlign = "left";
    ctx.fillStyle = isSelected ? "#facc15" : "#f8fafc";
    ctx.font = "bold 16px sans-serif";
    const jaTag = i18n.ja ? ` / ${i18n.ja}` : "";
    ctx.fillText(`${t.num}. ${t.zhName} / ${t.en}${jaTag} (${t.anchor})`, cx + 14, cy + 25);

    ctx.textAlign = "right";
    ctx.fillStyle = isSelected ? "#38bdf8" : "#64748b";
    ctx.font = "bold 11.5px sans-serif";
    ctx.fillText(
      isSelected ? "SELECTED 已選 選択中" : `[KEY 鍵 ${t.num}]`,
      cx + cardW - 14,
      cy + 24
    );

    ctx.textAlign = "left";
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "11.5px sans-serif";
    const descLine = i18n.jaDesc ? `${t.desc || ""}  |  ${i18n.jaDesc}` : (t.desc || "");
    ctx.fillText(descLine, cx + 14, cy + 48);

    setup.uiBoxes.push({ x: cx, y: cy, w: cardW, h: cardH, onClick: () => toggleTraitSelection(traitId) });
  });

  const prevX = 694;
  const prevY = 130;
  const prevW = 244;
  const prevH = 346;

  ctx.fillStyle = "#f5f1e6";
  ctx.fillRect(prevX, prevY, prevW, prevH);
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(prevX, prevY, prevW, prevH);

  ctx.strokeStyle = "rgba(130, 145, 165, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let ly = prevY + 36; ly < prevY + 260; ly += 22) {
    ctx.moveTo(prevX + 12, ly);
    ctx.lineTo(prevX + prevW - 12, ly);
  }
  ctx.stroke();

  const previewFloorY = prevY + 252;
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(prevX + 16, previewFloorY, prevW - 32, 6);

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(prevX, prevY, prevW, 26);
  ctx.fillStyle = "#facc15";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PREVIEW 預覽 プレビュー (2.8x)", prevX + prevW / 2, prevY + 17);

  const nowSec = performance.now() / 1000;
  const previewStats = computeHunterStats(setup.selected);
  const previewBob = Math.sin(nowSec * 3.2) * 1.5;

  drawLayeredCharacter(
    prevX + prevW / 2,
    previewFloorY + previewBob,
    2.8,
    previewStats.active,
    nowSec,
    {
      facing: 1,
      showPuff: previewStats.active.asthma,
      selectedOrder: previewStats.selectedOrder,
      showAimGun: true,
      localAimAngle: 0
    }
  );

  const needed = requiredTraitCount();
  const ready = setup.selected.length === needed;
  const preview = buildHunterIdentity(setup.selected);
  const remain = needed - setup.selected.length;

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(prevX + 8, prevY + 266, prevW - 16, 72);
  ctx.fillStyle = ready ? "#facc15" : "#94a3b8";
  ctx.font = "bold 16.5px sans-serif";
  ctx.fillText(
    ready ? `${preview.zhName} (${preview.anchors})` : `${preview.zhName} / 探索者`,
    prevX + prevW / 2,
    prevY + 290
  );

  ctx.fillStyle = ready ? "#38bdf8" : "#94a3b8";
  ctx.font = "bold 11.5px sans-serif";
  ctx.fillText(
    ready ? `${preview.enName} [${preview.code}]` : `PICK 選 選択: ${remain} MORE`,
    prevX + prevW / 2,
    prevY + 311
  );

  ctx.fillStyle = "#cbd5e1";
  ctx.font = "11px sans-serif";
  ctx.fillText(`SPD 速度:${Math.round(previewStats.walkSpeed)}   HP 生命:${previewStats.maxHp}`, prevX + prevW / 2, prevY + 330);

  const btnX = startX;
  const btnY = 496;
  const btnW = cardW;
  const btnH = 52;
  ctx.fillStyle = ready ? "#16a34a" : "#334155";
  ctx.fillRect(btnX, btnY, btnW, btnH);
  ctx.strokeStyle = ready ? "#86efac" : "#475569";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(btnX, btnY, btnW, btnH);

  ctx.fillStyle = ready ? "#ffffff" : "#94a3b8";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText(
    ready
      ? "START RUN  |  開始尋寶  |  冒険開始   [ENTER]"
      : `SELECT ${needed} TRAIT(S)  |  請選 ${needed} 項特質  |  特性を ${needed} つ選択`,
    btnX + btnW / 2,
    btnY + 32
  );

  if (ready) {
    setup.uiBoxes.push({ x: btnX, y: btnY, w: btnW, h: btnH, onClick: () => startStageWithSelectedTraits() });
  }

  const howX = prevX;
  const howY = 496;
  const howW = prevW;
  const howH = 52;

  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(howX, howY, howW, howH);
  ctx.strokeStyle = "#93c5fd";
  ctx.lineWidth = 2.2;
  ctx.strokeRect(howX, howY, howW, howH);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 14px monospace";
  ctx.fillText("HOW TO PLAY [?]", howX + howW / 2, howY + 22);

  ctx.fillStyle = "#fef08a";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("玩法說明 ・ 遊び方", howX + howW / 2, howY + 41);

  setup.uiBoxes.push({
    x: howX,
    y: howY,
    w: howW,
    h: howH,
    onClick: () => {
      setup.showHowToPlay = true;
      SFX.beep(540, 0.08, "square", 0.07);
    }
  });

  ctx.textAlign = "left";
}

window.addEventListener("keydown", (e) => {
  if (typeof game === "undefined" || game.state !== "SELECT" || typeof setup === "undefined") return;
  if (setup.showIntroScreen !== false) return;

  if (setup.showHowToPlay) {
    if (["Escape", "Enter", " ", "?", "/", "F1", "t", "T"].includes(e.key)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      setup.showHowToPlay = false;
      SFX.beep(420, 0.08, "square", 0.07);
    }
  } else if (["?", "F1", "t", "T"].includes(e.key)) {
    e.preventDefault();
    e.stopImmediatePropagation();
    setup.showHowToPlay = true;
    SFX.beep(540, 0.08, "square", 0.07);
  }
}, true);
