// js/render.js //
"use strict";

function getDeviceDateTimeStrings() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return { dateStr: `${yyyy}-${mm}-${dd}`, timeStr: `${hh}:${min}` };
}

function drawNotebookHeaderOverlay() {
  const { dateStr, timeStr } = getDeviceDateTimeStrings();
  const stageTitle = stageManager.data.stageName || stageManager.data.title || "STAGE 001";

  ctx.save();
  ctx.fillStyle = "rgba(45, 55, 72, 0.88)";
  ctx.font = "bold 12px monospace";

  ctx.textAlign = "left";
  ctx.fillText(`DATE: ${dateStr}`, 34, 46);

  ctx.textAlign = "center";
  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 13px monospace";
  ctx.fillText(stageTitle, HALF_W, 46);

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(45, 55, 72, 0.88)";
  ctx.font = "bold 12px monospace";
  ctx.fillText(`TIME: ${timeStr}`, W - 34, 46);
  ctx.restore();
}

function drawActiveScreenBackground(scr) {
  const customBg = stageManager.bgImages[scr.id];
  if (customBg && customBg.loaded) {
    ctx.drawImage(customBg, 0, 0, game.worldW, game.worldH);
    drawNotebookHeaderOverlay();
    return;
  }

  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0.00, "#ede7d8");
  grad.addColorStop(0.47, "#f7f4eb");
  grad.addColorStop(0.50, "#d8d0be");
  grad.addColorStop(0.53, "#f7f4eb");
  grad.addColorStop(1.00, "#ede7d8");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  drawRuledPage(0, 0, scr.pageLeft, true);
  drawRuledPage(HALF_W, 0, scr.pageRight, false);
  drawNotebookHeaderOverlay();

  ctx.strokeStyle = "rgba(80, 75, 65, 0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(HALF_W, 0);
  ctx.lineTo(HALF_W, H);
  ctx.stroke();

  for (const s of scr.solids) {
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

  for (const p of scr.oneWay) {
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(p.x, p.y, p.w, 4);
    ctx.fillRect(p.x, p.y + 7, p.w, 2.5);
  }

  for (const l of scr.ladders) {
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

function drawRuledPage(px, py, pageNum, isLeft) {
  const padX = 28;
  const headerY = py + 52;
  const footerY = py + H - 28;
  const lineGap = 24;

  ctx.strokeStyle = "rgba(130, 145, 165, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = headerY; y <= footerY; y += lineGap) {
    ctx.moveTo(px + padX, y);
    ctx.lineTo(px + HALF_W - padX, y);
  }
  ctx.stroke();

  ctx.fillStyle = "rgba(110, 115, 125, 0.8)";
  ctx.font = "11px monospace";
  ctx.fillText(String(pageNum), isLeft ? px + padX + 6 : px + HALF_W - padX - 18, footerY + 16);
}

function drawSubtleExitMark(scr) {
  const exit = scr.exit;
  if (!exit) return;

  const isVault = Boolean(scr.isFinal || exit.label === "VAULT");
  const pulse = 0.65 + Math.sin(game.elapsedTime * 5) * 0.30;
  const wobble = Math.sin(game.elapsedTime * 5) * 3;
  const cx = exit.x + exit.w / 2;

  if (isVault) {
    ctx.save();
    ctx.strokeStyle = `rgba(180, 83, 9, ${pulse})`;
    ctx.fillStyle = "rgba(254, 243, 199, 0.22)";
    ctx.lineWidth = 2.5;
    ctx.fillRect(exit.x, exit.y, exit.w, exit.h);
    ctx.strokeRect(exit.x, exit.y, exit.w, exit.h);

    ctx.fillStyle = "#1e293b";
    ctx.fillRect(exit.x - 4, exit.y - 20, exit.w + 8, 17);
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(exit.x - 4, exit.y - 20, exit.w + 8, 17);

    ctx.fillStyle = "#facc15";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("VAULT", cx, exit.y - 8);

    ctx.strokeStyle = `rgba(217, 119, 6, ${pulse})`;
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

  ctx.strokeStyle = `rgba(30, 41, 59, ${pulse})`;
  ctx.fillStyle = `rgba(217, 119, 6, ${pulse})`;
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
        ctx.drawImage(EXTRA_SPRITES.hat, p.x, p.y + bob, p.w, p.h);
      } else {
        ctx.fillStyle = "#eab308";
        ctx.fillRect(p.x + 4, p.y + 4 + bob, 22, 12);
        ctx.fillRect(p.x, p.y + 15 + bob, 30, 5);
        ctx.fillStyle = "#dc2626";
        ctx.fillRect(p.x + 12, p.y + bob, 6, 6);
      }
    } else if (p.type === "treasure") {
      if (EXTRA_SPRITES.treasure.loaded) {
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
    if (e.kind === "blade") drawBladeEnemy(e);
    else if (e.kind === "giant") drawAxeGiant(e);
  }
}

function drawBladeEnemy(e) {
  const cx = e.x + e.w / 2;
  const step = Math.sin(e.animTimer * 12) * 5;
  ctx.save();
  if (EXTRA_SPRITES.blade.loaded) {
    ctx.translate(cx, e.y + e.h);
    ctx.scale(e.facing, 1);
    ctx.drawImage(EXTRA_SPRITES.blade, -e.w / 2, -e.h, e.w, e.h);
    ctx.restore();
    return;
  }
  ctx.strokeStyle = e.hurtTimer > 0 ? "#dc2626" : "#1e293b";
  ctx.lineWidth = 2.4;

  ctx.beginPath();
  ctx.arc(cx, e.y + 9, 7, 0, Math.PI * 2);
  ctx.moveTo(cx, e.y + 16);
  ctx.lineTo(cx, e.y + 34);
  ctx.moveTo(cx, e.y + 34);
  ctx.lineTo(cx - 7 + step, e.y + e.h);
  ctx.moveTo(cx, e.y + 34);
  ctx.lineTo(cx + 7 - step, e.y + e.h);
  const handX = cx + e.facing * 10;
  const handY = e.y + 22;
  ctx.moveTo(cx, e.y + 21);
  ctx.lineTo(handX, handY);
  ctx.stroke();

  const slashTilt = e.slashTimer > 0 ? e.facing * 0.9 : 0;
  ctx.save();
  ctx.translate(handX, handY);
  ctx.rotate(slashTilt);
  ctx.fillStyle = "#cbd5e1";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(e.facing * 10, -12, e.facing * 3, -22);
  ctx.lineTo(-e.facing * 2, -2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function drawAxeGiant(g) {
  ctx.save();
  const step = Math.floor(g.animTimer * 9);
  const bobY = g.aiState === "WALK" ? (step % 2 === 0 ? -4 : 0) : 0;
  const tilt = g.aiState === "WALK" ? (step % 2 === 0 ? -0.05 : 0.05) : (g.aiState === "WINDUP" ? -0.14 : 0.08);

  ctx.translate(g.x + g.w / 2, g.y + g.h + bobY);
  ctx.scale(g.facing, 1);
  ctx.rotate(tilt);

  if (EXTRA_SPRITES.giant.loaded) {
    ctx.drawImage(EXTRA_SPRITES.giant, -g.w / 2, -g.h, g.w, g.h);
  } else {
    ctx.strokeStyle = g.hurtTimer > 0 ? "#dc2626" : "#1e293b";
    ctx.fillStyle = g.hurtTimer > 0 ? "#fecaca" : "#e2e8f0";
    ctx.lineWidth = 2.6;

    ctx.fillRect(-18, -32, 13, 32);
    ctx.strokeRect(-18, -32, 13, 32);
    ctx.fillRect(5, -32, 13, 32);
    ctx.strokeRect(5, -32, 13, 32);
    ctx.fillRect(-24, -76, 48, 44);
    ctx.strokeRect(-24, -76, 48, 44);
    ctx.strokeRect(-33, -72, 9, 32);

    ctx.beginPath();
    ctx.arc(0, -88, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-6, -91); ctx.lineTo(-2, -91);
    ctx.moveTo(2, -91);  ctx.lineTo(6, -91);
    ctx.moveTo(-5, -82); ctx.lineTo(5, -83);
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(18, -62);
  ctx.rotate(g.weaponAngle);
  if (EXTRA_SPRITES.giantAxe.loaded) {
    ctx.drawImage(EXTRA_SPRITES.giantAxe, -6, -g.weaponLength, 26, g.weaponLength);
  } else {
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(0, -g.weaponLength);
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(0, -g.weaponLength + 4);
    ctx.lineTo(22, -g.weaponLength - 8);
    ctx.quadraticCurveTo(26, -g.weaponLength + 10, 20, -g.weaponLength + 24);
    ctx.lineTo(0, -g.weaponLength + 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  if (g.aiState === "STRIKE") {
    ctx.strokeStyle = "rgba(220, 38, 38, 0.7)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, g.weaponLength, -1.7, 0.3);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();

  ctx.fillStyle = "#1e293b";
  ctx.fillRect(g.x, g.y - 12, g.w, 6);
  ctx.fillStyle = "#dc2626";
  ctx.fillRect(g.x + 1, g.y - 11, (g.w - 2) * Math.max(0, g.hp / g.maxHp), 4);
}

function drawSpriteLayer(layer, dx, dy, dw, dh, clipZone = null) {
  if (!layer || !layer.loaded) return false;
  const src = layer.canvas || layer.img;
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
  return true;
}

function drawAnimatedSpriteLegs(legLayer, spriteW, spriteH, animState, animTimer) {
  const src = legLayer.canvas || legLayer.img;
  const legTopRatio = 0.68;
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
}

function drawAimingGunArm(localAimAngle, hasGunRecoil, isTremor) {
  const clampedAngle = Math.max(-1.25, Math.min(1.25, localAimAngle));
  const jitter = isTremor ? Math.sin(game.elapsedTime * 55) * 0.06 : 0;

  ctx.save();
  ctx.translate(3, -34);
  ctx.rotate(clampedAngle + jitter);

  const recoilX = hasGunRecoil ? -2.5 : 0;

  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = isTremor ? 2.0 : 3.0;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(10 + recoilX, 0);
  ctx.stroke();

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(9 + recoilX, -2.5, 11, 3.6);
  ctx.fillRect(8 + recoilX, 0, 3.5, 5.5);

  if (hasGunRecoil) {
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.moveTo(21 + recoilX, -1);
    ctx.lineTo(27 + recoilX, -4);
    ctx.lineTo(25 + recoilX, 0);
    ctx.lineTo(28 + recoilX, 3);
    ctx.closePath();
    ctx.fill();
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

  // Head tilt toward cursor (-43 deg to +43 deg)
  const rawHeadAngle = opts.showAimGun ? (opts.localAimAngle ?? 0) * 0.65 : 0;
  const headAngle = Math.max(-0.75, Math.min(0.75, rawHeadAngle));

  ctx.save();
  ctx.translate(footX, footY);
  ctx.scale(facing * scaleFactor, scaleFactor);
  ctx.rotate(runTilt);

  const hasBaseSprite = CHAR_LAYERS.base.loaded;
  if (hasBaseSprite) {
    // 1. Torso / middle body (40% to 68% height)
    drawSpriteLayer(CHAR_LAYERS.base, -spriteW / 2, -spriteH, spriteW, spriteH, [0, 0.40, 1, 0.28]);

    // 2. Animated lower legs (68% to 100% height)
    const legLayer = (activeTraits.prosthesis && CHAR_LAYERS.prosthesis.loaded)
      ? CHAR_LAYERS.prosthesis
      : CHAR_LAYERS.base;
    drawAnimatedSpriteLegs(legLayer, spriteW, spriteH, animState, animTimer);

    // 3. Torso/arm trait overlays (asthma, tremor)
    for (const traitId of orderList) {
      if (!activeTraits[traitId] || traitId === "prosthesis" || traitId === "blind" || traitId === "deaf") continue;
      const layer = CHAR_LAYERS[traitId];
      const zone = TRAIT_BODY_ZONES[traitId] || null;
      if (layer && layer.loaded) {
        drawSpriteLayer(layer, -spriteW / 2, -spriteH, spriteW, spriteH, zone);
      }
    }

    // 4. Pivoting head (0% to 40% height) + head traits (blind, deaf) + missile hat
    ctx.save();
    ctx.translate(0, -40); // neck pivot
    ctx.rotate(headAngle);
    ctx.translate(0, 40);

    drawSpriteLayer(CHAR_LAYERS.base, -spriteW / 2, -spriteH, spriteW, spriteH, [0, 0, 1, 0.40]);
    for (const traitId of orderList) {
      if (!activeTraits[traitId] || (traitId !== "blind" && traitId !== "deaf")) continue;
      const layer = CHAR_LAYERS[traitId];
      const zone = TRAIT_BODY_ZONES[traitId] || null;
      if (layer && layer.loaded) {
        drawSpriteLayer(layer, -spriteW / 2, -spriteH, spriteW, spriteH, zone);
      }
    }
    if (opts.hasMissileHat) {
      const ready = hero.hatCooldown <= 0;
      ctx.fillStyle = ready ? "#facc15" : "#854d0e";
      ctx.fillRect(-10, -56, 20, 4);
      ctx.fillRect(-6, -62, 12, 6);
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
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(-1, -50, 8, 4);
    }
    if (activeTraits.deaf) {
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(-5, -47, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (opts.hasMissileHat) {
      const ready = hero.hatCooldown <= 0;
      ctx.fillStyle = ready ? "#facc15" : "#854d0e";
      ctx.fillRect(-10, -56, 20, 4);
      ctx.fillRect(-6, -62, 12, 6);
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
    gunRecoil: hero.gunCooldown > 0.02
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
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillText("GASP!", footX, barY - 4);
      ctx.textAlign = "left";
    }
  }
}

function drawProjectilesAndAimMark() {
  ctx.fillStyle = "#1d4ed8";
  for (const b of game.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
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
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(Math.atan2(m.vy, m.vx));
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(-10, -4, 20, 8);
    ctx.fillStyle = "#facc15";
    ctx.fillRect(6, -3, 6, 6);
    ctx.restore();
  }

  for (const p of game.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
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
  if (!hero.traits.blind || game.debug || game.state === "VICTORY_WALK") return;

  const sx = hero.x + hero.w / 2 - game.camX;
  const sy = hero.y + hero.h * 0.45 - game.camY;
  const sightRadius = hero.stats?.sightRadius ?? 310;

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
  ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
  ctx.fillRect(0, 0, W, 26);

  ctx.fillStyle = "#facc15";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText(`${hero.identity.zhName} ${hero.identity.enName} (${hero.identity.anchors})`, 10, 17);

  ctx.font = "bold 13px monospace";
  ctx.fillStyle = "#ef4444";
  ctx.fillText(`HP:`, 245, 17);
  ctx.fillStyle = "#334155";
  ctx.fillRect(270, 7, 76, 12);
  ctx.fillStyle = "#22c55e";
  ctx.fillRect(270, 7, Math.max(0, hero.hp * 0.76), 12);

  if (hero.gunReloadTimer > 0) {
    ctx.fillStyle = "#fb923c";
    ctx.fillText(`GUN:RLD`, 354, 17);
  } else {
    ctx.fillStyle = "#38bdf8";
    const roundsLeft = hero.gunBurstRemaining > 0 ? hero.gunBurstRemaining : 7;
    ctx.fillText(`GUN:${roundsLeft}/7`, 354, 17);
  }

  ctx.fillStyle = "#fef08a";
  ctx.fillText(`BN:${hero.bones}`, 424, 17);

  if (!hero.hasMissileHat) {
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`HAT:--`, 472, 17);
  } else if (hero.hatCooldown <= 0) {
    ctx.fillStyle = "#facc15";
    ctx.fillText(`HAT:RDY`, 472, 17);
  } else {
    ctx.fillStyle = "#fb923c";
    ctx.fillText(`HAT:${hero.hatCooldown.toFixed(1)}`, 472, 17);
  }

  const totalScreens = stageManager.data.screens.length;
  ctx.fillStyle = "#38bdf8";
  ctx.fillText(`BG:${game.screenIdx + 1}/${totalScreens}`, 544, 17);

  const mins = Math.floor(game.stageTimer / 60);
  const secs = Math.floor(game.stageTimer % 60).toString().padStart(2, "0");
  ctx.fillStyle = game.stageTimer < 60 ? "#f87171" : "#f8fafc";
  ctx.fillText(`${mins}:${secs}`, 616, 17);

  ctx.fillStyle = "#f8fafc";
  ctx.fillText(`${game.score.toString().padStart(6, "0")}`, 666, 17);

  ctx.fillStyle = "#cbd5e1";
  ctx.fillText(`[ESC]CHAR [M]BGM [F2]DBG`, 736, 17);

  if (game.debug && game.activeScreen) {
    const scr = game.activeScreen;
    ctx.save();
    ctx.translate(-Math.round(game.camX), -Math.round(game.camY));

    ctx.strokeStyle = "rgba(37, 99, 235, 0.45)";
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hero.x + hero.w / 2, hero.y + hero.h * 0.45, HALF_W * hero.stats.bulletDropRatio, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = "#22c55e";
    for (const s of scr.solids) ctx.strokeRect(s.x, s.y, s.w, s.h);
    ctx.strokeStyle = "#eab308";
    for (const l of scr.ladders) ctx.strokeRect(l.x, l.y, l.w, l.h);
    ctx.strokeStyle = "#f97316";
    for (const p of scr.oneWay) ctx.strokeRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = "#10b981";
    if (scr.exit) ctx.strokeRect(scr.exit.x, scr.exit.y, scr.exit.w, scr.exit.h);
    ctx.strokeStyle = "#ef4444";
    ctx.strokeRect(hero.x, hero.y, hero.w, hero.h);

    if (debugDrag.active) {
      const rx = Math.min(debugDrag.startX, debugDrag.curX);
      const ry = Math.min(debugDrag.startY, debugDrag.curY);
      const rw = Math.abs(debugDrag.curX - debugDrag.startX);
      const rh = Math.abs(debugDrag.curY - debugDrag.startY);
      ctx.strokeStyle = "#c026d3";
      ctx.lineWidth = 2;
      ctx.strokeRect(rx, ry, rw, rh);
    } else if (debugDrag.draftBox) {
      const db = debugDrag.draftBox;
      ctx.strokeStyle = "#e879f9";
      ctx.setLineDash([5, 3]);
      ctx.lineWidth = 2;
      ctx.strokeRect(db.x, db.y, db.w, db.h);
      ctx.setLineDash([]);
    }
    ctx.restore();

    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.fillRect(10, H - 34, W - 20, 26);
    ctx.fillStyle = "#4ade80";
    ctx.font = "12px monospace";
    const statusText = debugDrag.lastJson || "DRAG BOX -> [B]Solid [L]Ladder [O]OneWay [Z]Undo";
    ctx.fillText(statusText, 18, H - 16);
  }

  if (game.state === "GAMEOVER" || game.state === "VICTORY") {
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = game.state === "VICTORY" ? "#facc15" : "#f87171";
    ctx.font = "bold 36px monospace";
    ctx.textAlign = "center";
    ctx.fillText(game.state === "VICTORY" ? "VAULT REACHED — STAGE CLEAR!" : "TIME / HP EXHAUSTED", W / 2, H / 2 - 40);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(`${hero.identity.zhName} — ${hero.identity.enName} (${hero.identity.anchors}) [${setup.difficulty}]`, W / 2, H / 2 + 4);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "17px monospace";
    ctx.fillText(`FINAL SCORE: ${game.score}  |  [R] RETRY  |  [ESC] CHANGE HUNTER`, W / 2, H / 2 + 46);
    ctx.textAlign = "left";
  }
}

function drawSelectScreen() {
  setup.uiBoxes.length = 0;
  drawActiveScreenBackground(STAGE_001_DEFAULT.screens[0]);

  ctx.fillStyle = "rgba(15, 23, 42, 0.90)";
  ctx.fillRect(28, 16, W - 56, H - 32);
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 16, W - 56, H - 32);

  ctx.textAlign = "center";
  ctx.fillStyle = "#facc15";
  ctx.font = "bold 24px monospace";
  ctx.fillText("UNBOUND RELICS  無界尋寶錄", W / 2, 48);

  ctx.fillStyle = "#cbd5e1";
  ctx.font = "12px monospace";
  ctx.fillText("ASDW MOVE/JUMP/LADDER  |  MOUSE AIM + L-CLICK 7-BURST GUN  |  R-CLICK BONE  |  F HAT MISSILE  |  ESC CHAR SELECT", W / 2, 68);

  const diffBtns = [
    { id: "NORMAL",   label: "NORMAL (1) [N]",   x: W / 2 - 345, y: 82, w: 216, h: 34 },
    { id: "HARD",     label: "HARD (3) [H]",     x: W / 2 - 108, y: 82, w: 216, h: 34 },
    { id: "ULTIMATE", label: "ULTIMATE (5) [U]", x: W / 2 + 129, y: 82, w: 216, h: 34 }
  ];

  for (const b of diffBtns) {
    const active = setup.difficulty === b.id;
    ctx.fillStyle = active ? (b.id === "ULTIMATE" ? "#c026d3" : "#eab308") : "#1e293b";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = active ? "#fef08a" : "#64748b";
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);

    ctx.fillStyle = active ? (b.id === "ULTIMATE" ? "#ffffff" : "#0f172a") : "#f8fafc";
    ctx.font = "bold 14px monospace";
    ctx.fillText(b.label, b.x + b.w / 2, b.y + 22);

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

    ctx.fillStyle = isSelected ? "rgba(30, 58, 138, 0.94)" : "rgba(30, 41, 59, 0.9)";
    ctx.fillRect(cx, cy, cardW, cardH);
    ctx.strokeStyle = isSelected ? "#facc15" : "#475569";
    ctx.lineWidth = isSelected ? 2.5 : 1.5;
    ctx.strokeRect(cx, cy, cardW, cardH);

    ctx.textAlign = "left";
    ctx.fillStyle = isSelected ? "#facc15" : "#f8fafc";
    ctx.font = "bold 17px sans-serif";
    ctx.fillText(`${t.num}. ${t.en}  ${t.zhName} (${t.anchor})`, cx + 14, cy + 25);

    ctx.textAlign = "right";
    ctx.fillStyle = isSelected ? "#38bdf8" : "#64748b";
    ctx.font = "bold 13px monospace";
    ctx.fillText(isSelected ? "SELECTED" : `[KEY ${t.num}]`, cx + cardW - 14, cy + 24);

    ctx.textAlign = "left";
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.fillText(t.desc || "", cx + 14, cy + 48);

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
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "center";
  ctx.fillText("HUNTER PREVIEW (2.8x)", prevX + prevW / 2, prevY + 17);

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
      localAimAngle: -0.15
    }
  );

  const needed = requiredTraitCount();
  const ready = setup.selected.length === needed;
  const preview = buildHunterIdentity(setup.selected);

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(prevX + 8, prevY + 266, prevW - 16, 72);
  ctx.fillStyle = ready ? "#facc15" : "#94a3b8";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText(ready ? `${preview.zhName} (${preview.anchors})` : preview.zhName, prevX + prevW / 2, prevY + 291);

  ctx.fillStyle = ready ? "#38bdf8" : "#64748b";
  ctx.font = "bold 13px monospace";
  ctx.fillText(ready ? `${preview.enName} [${preview.code}]` : `PICK ${needed - setup.selected.length} MORE`, prevX + prevW / 2, prevY + 312);

  ctx.fillStyle = "#cbd5e1";
  ctx.font = "11px monospace";
  ctx.fillText(`SPD:${Math.round(previewStats.walkSpeed)}  HP:${previewStats.maxHp}`, prevX + prevW / 2, prevY + 330);

  const btnX = W / 2 - 210;
  const btnY = 496;
  const btnW = 420;
  const btnH = 52;
  ctx.fillStyle = ready ? "#16a34a" : "#334155";
  ctx.fillRect(btnX, btnY, btnW, btnH);
  ctx.strokeStyle = ready ? "#86efac" : "#475569";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(btnX, btnY, btnW, btnH);

  ctx.fillStyle = ready ? "#ffffff" : "#94a3b8";
  ctx.font = "bold 18px monospace";
  ctx.fillText(ready ? "START STAGE 001 [ENTER]" : `SELECT ${needed} TRAIT(S) TO START`, W / 2, btnY + 32);

  if (ready) {
    setup.uiBoxes.push({ x: btnX, y: btnY, w: btnW, h: btnH, onClick: () => startStageWithSelectedTraits() });
  }

  ctx.textAlign = "left";
}
