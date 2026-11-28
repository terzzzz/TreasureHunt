// js/main.js //
"use strict";

function loadScreenObject(scr) {
  game.activeScreen = scr;
  game.roomType = scr.roomType || "START";
  game.worldW = scr.worldW || W;
  game.worldH = scr.worldH || H;

  hero.x = scr.spawn?.x ?? 64;
  hero.y = scr.spawn?.y ?? (H - 34 - hero.h);
  hero.vx = 0;
  hero.vy = 0;
  hero.onLadder = false;
  hero.grounded = false;

  game.bullets.length = 0;
  game.bones.length = 0;
  game.missiles.length = 0;
  game.particles.length = 0;

  const zoom = getActiveCamZoom();
  const viewW = W / zoom;
  const viewH = H / zoom;
  game.camX = Math.max(0, Math.min(game.worldW - viewW, hero.x + hero.w / 2 - viewW / 2));
  game.camY = Math.max(0, Math.min(game.worldH - viewH, hero.y + hero.h / 2 - viewH / 2));
}

function buildStartingScreen() {
  const tpl = (stageManager.data.screens && stageManager.data.screens[0]) || STAGE_001_DEFAULT.screens[0];
  const scrKey = tpl.id || tpl.file || "start.jpg";
  const atkMult = getCompoundAttackMultiplier(0);

  return {
    id: scrKey,
    roomType: "START",
    worldW: tpl.width || W,
    worldH: tpl.height || H,
    pageLeft: tpl.pageLeft || "1",
    pageRight: tpl.pageRight || "2",
    isFinal: false,
    spawn: { ...(tpl.spawn || { x: 80, y: 492 }) },
    exit: tpl.exit ? { ...tpl.exit } : { x: W - 64, y: 480, w: 36, h: 68, dir: "right" },
    solids: (tpl.solids || [
      { x: 0, y: 548, w: W, h: 34, hatched: true },
      { x: 0, y: 0, w: 24, h: H },
      { x: W - 24, y: 0, w: 24, h: H }
    ]).map(s => ({ ...s })),
    oneWay: (tpl.oneWay || []).map(p => ({ ...p })),
    ladders: (tpl.ladders || []).map(l => ({ ...l })),
    pickups: (tpl.pickups || []).map(p => ({ w: 28, h: 26, ...p, collected: false })),
    enemies: (tpl.enemies || []).map(e => {
      if (typeof createEnemyInstance === "function") {
        const floorY = (e.y || 452) + (e.h || (e.kind === "giant" ? 96 : 46));
        return createEnemyInstance(e.kind || "blade", e.x + (e.w || 30) * 0.5, floorY, e.minX ?? 80, e.maxX ?? (W - 80), 0);
      }
      return {
        kind: e.kind || "blade",
        x: e.x, y: e.y, w: e.w || 30, h: e.h || 46,
        vx: e.vx || -80, minX: e.minX ?? 80, maxX: e.maxX ?? (W - 80), facing: -1,
        hp: e.hp || 35, maxHp: e.hp || 35,
        atk: Math.round(16 * atkMult),
        scoreValue: e.kind === "giant" ? 800 : 250,
        animTimer: 0, hurtTimer: 0, alive: true, slashTimer: 0
      };
    })
  };
}

function getCurrentContextBoardKey() {
  if (typeof resolveBoardKeyFromTraits !== "function") return "E_BLIND";
  if (game.state === "SELECT" && typeof setup !== "undefined" && Array.isArray(setup.selected)) {
    const tempTraits = {};
    for (const t of setup.selected) tempTraits[t] = true;
    return resolveBoardKeyFromTraits(tempTraits) || "E_BLIND";
  }
  return resolveBoardKeyFromTraits(hero.traits) || "E_BLIND";
}

function openGlobalScoreboardBrowser() {
  if (typeof ScoreboardUI === "undefined") return;
  if (typeof SFX !== "undefined" && typeof SFX.beep === "function") {
    SFX.beep(580, 0.08, "triangle", 0.07);
  }
  ScoreboardUI.openBrowser(getCurrentContextBoardKey());
}

function drawScoreboardShortcutButton(targetList, x, y, w, h) {
  if (typeof ScoreboardUI === "undefined") return;

  ctx.save();
  ctx.fillStyle = "#0f172a";
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, 4);
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#facc15";
  ctx.font = 'bold 12px "Courier New", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("RANKING [L]", x + w * 0.5, y + h * 0.5 + 0.5);
  ctx.restore();

  if (Array.isArray(targetList)) {
    targetList.push({
      x,
      y,
      w,
      h,
      onClick: () => openGlobalScoreboardBrowser()
    });
  }
}

function startNewRun() {
  game.runSeed = (Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
  game.transitions = 0;
  game.screenIdx = 0;
  game.score = 0;
  game.stageTimer = stageManager.data.timeLimit || 600;
  game.elapsedTime = 0;
  game.shakeTimer = 0;
  game.fadeTimer = 0;
  game.victoryWalkTimer = 0;
  game.bossArmed = false;
  game.bossDefeated = false;
  game.scoreboardOpenedThisRun = false;

  inputDelayBuffer.length = 0;
  prevEffectiveInput = {
    aHeld: false, dHeld: false, wHeld: false, sHeld: false,
    jumpHeld: false, gunHeld: false, boneHeld: false, hatHeld: false
  };

  Object.assign(hero, {
    hp: hero.maxHp,
    invulnTimer: 0,
    gunCooldown: 0,
    gunBurstRemaining: 0,
    gunReloadTimer: 0,
    bones: 0,
    hasMissileHat: false,
    hatCooldown: 0,
    asthma: 0,
    asthmaStun: 0,
    asthmaPending: false,
    animState: "IDLE",
    animTimer: 0
  });

  loadScreenObject(buildStartingScreen());
  game.state = "PLAY";
  SFX.syncBgm();
}

function startStageWithSelectedTraits() {
  const chosen = setup.selected.slice(0, requiredTraitCount());
  if (chosen.length !== requiredTraitCount()) return;

  const computed = computeHunterStats(chosen);
  hero.traits = computed.active;
  hero.stats = computed;
  hero.identity = buildHunterIdentity(chosen);
  hero.maxHp = computed.maxHp;

  startNewRun();
}

function advanceToNextScreen() {
  // 1. Exiting Treasure Room completes the game ("CONGRATZ!")
  if (game.roomType === "TREASURE") {
    const diffBonus = setup.difficulty === "ULTIMATE" ? 6000 : (setup.difficulty === "HARD" ? 3000 : 1000);
    game.score += diffBonus;
    game.state = "VICTORY_WALK";
    game.victoryWalkTimer = 1.4;
    hero.facing = 1;
    hero.onLadder = false;
    hero.asthmaStun = 0;
    hero.animState = "RUN";
    SFX.syncBgm();
    SFX.playVictoryFanfare();
    return;
  }

  // 2. Exiting Boss Chamber after defeating the Boss leads to the Treasure Room
  if (game.roomType === "BOSS" && game.bossDefeated) {
    game.state = "SCREEN_FADE";
    game.fadeTimer = 0.28;
    SFX.beep(587, 0.2, "triangle", 0.1, 880);
    loadScreenObject(generateTreasureScreen(game.transitions));
    return;
  }

  // 3. Increment transition count (+2% compound monster attack per transition)
  game.transitions++;
  game.screenIdx = game.transitions;
  game.state = "SCREEN_FADE";
  game.fadeTimer = 0.24;
  SFX.beep(520, 0.14, "triangle", 0.08, 780);

  // 4. Enter Boss Arena if player armed the Boss button after >= 10 transitions; otherwise next infinite room
  if (game.transitions >= 10 && game.bossArmed) {
    game.bossArmed = false;
    game.bossDefeated = false;
    loadScreenObject(generateBossScreen(game.transitions));
  } else {
    loadScreenObject(generateProceduralScreen(game.runSeed, game.transitions));
  }
}

function returnToCharSelect() {
  game.state = "SELECT";
  game.screenIdx = 0;
  game.transitions = 0;
  game.roomType = "START";
  game.score = 0;
  game.elapsedTime = 0;
  game.shakeTimer = 0;
  game.fadeTimer = 0;
  game.victoryWalkTimer = 0;
  game.bossArmed = false;
  game.bossDefeated = false;
  game.scoreboardOpenedThisRun = false;

  game.bullets.length = 0;
  game.bones.length = 0;
  game.missiles.length = 0;
  game.particles.length = 0;
  inputDelayBuffer.length = 0;

  mouse.leftDown = false;
  mouse.rightDown = false;
  mouse.middleDown = false;
  for (const k in keys) keys[k] = false;

  SFX.syncBgm();
}

// Desktop HUD button clicks ([B] Boss toggle, [ESC] Char, [M] BGM, End-screen buttons)
canvas.addEventListener("mousedown", (e) => {
  if (typeof ScoreboardUI !== "undefined" && ScoreboardUI.isOpen()) return;
  if (e.button !== 0 || game.state === "SELECT") return;
  const rect = canvas.getBoundingClientRect();
  const cx = ((e.clientX - rect.left) / rect.width) * W;
  const cy = ((e.clientY - rect.top) / rect.height) * H;

  for (const btn of game.hudButtons) {
    if (cx >= btn.x && cx <= btn.x + btn.w && cy >= btn.y && cy <= btn.y + btn.h) {
      btn.onClick();
      mouse.leftDown = false;
      e.stopImmediatePropagation();
      return;
    }
  }
}, true);

// Keyboard shortcuts for Boss toggle ([B]), Quick Retry ([R]), and Global Ranking ([L])
window.addEventListener("keydown", (e) => {
  if (typeof ScoreboardUI !== "undefined" && ScoreboardUI.isOpen()) return;

  if (e.code === "KeyB" && game.state === "PLAY" && game.roomType === "RANDOM" && game.transitions >= 10) {
    game.bossArmed = !game.bossArmed;
    SFX.beep(game.bossArmed ? 560 : 320, 0.12, "square", 0.08);
  } else if (e.code === "KeyR" && (game.state === "GAMEOVER" || game.state === "VICTORY")) {
    startNewRun();
  } else if (e.code === "KeyL" && (game.state === "SELECT" || game.state === "GAMEOVER" || game.state === "VICTORY")) {
    if (game.state === "SELECT" && setup.showIntroScreen !== false) return;
    openGlobalScoreboardBrowser();
  }
});

if (typeof initTouchListeners === "function") {
  initTouchListeners();
}

let lastTime = performance.now();
let accumulator = 0;

function updateTick() {
  if (game.state === "SELECT") return;
  if (game.shakeTimer > 0) game.shakeTimer = Math.max(0, game.shakeTimer - DT);

  if (game.state === "SCREEN_FADE") {
    game.fadeTimer -= DT;
    if (game.fadeTimer <= 0) game.state = "PLAY";
    return;
  }

  if (game.state === "VICTORY_WALK") {
    game.elapsedTime += DT;
    game.victoryWalkTimer -= DT;
    hero.facing = 1;
    hero.animState = "RUN";
    hero.animTimer += DT * 11;
    hero.x += Math.max(130, hero.stats.walkSpeed) * DT;
    stepParticles();

    if (game.victoryWalkTimer <= 0 || hero.x > game.worldW + 40) {
      game.state = "VICTORY";
      if (typeof ScoreboardUI !== "undefined" && !game.scoreboardOpenedThisRun) {
        game.scoreboardOpenedThisRun = true;
        ScoreboardUI.openVictorySubmit(game, hero);
      }
    }
    return;
  }

  if (game.state !== "PLAY" || !game.activeScreen) return;

  game.elapsedTime += DT;

  const input = getEffectiveInput();
  if (typeof syncTouchControlsToInput === "function") {
    syncTouchControlsToInput(input);
  }

  stepHero(input, game.activeScreen);
  stepProjectilesAndPickups(game.activeScreen);
  stepEnemies(game.activeScreen);
  stepParticles();
  updateCamera();
}

function renderFrame() {
  if (game.state === "SELECT") {
    drawSelectScreen();
    if (typeof setup !== "undefined" && setup.showIntroScreen === false) {
      drawScoreboardShortcutButton(setup.uiBoxes, W - 128, 12, 110, 26);
    }
    return;
  }

  const scr = game.activeScreen;
  if (!scr) return;

  const zoom = getActiveCamZoom();

  ctx.save();
  if (game.shakeTimer > 0) {
    ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
  }

  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(-Math.round(game.camX), -Math.round(game.camY));

  drawActiveScreenBackground(scr);
  drawScreenEntities(scr);
  drawHero();
  drawProjectilesAndAimMark();

  ctx.restore();
  drawBlindSightMask();
  ctx.restore();

  if (game.state === "SCREEN_FADE") {
    ctx.fillStyle = `rgba(15, 23, 42, ${Math.min(1, game.fadeTimer / 0.24)})`;
    ctx.fillRect(0, 0, W, H);
  }

  drawHUD();
  if (game.state === "VICTORY" || game.state === "GAMEOVER") {
    drawScoreboardShortcutButton(game.hudButtons, W - 128, 44, 110, 26);
  }
  if (typeof drawTouchControls === "function") {
    drawTouchControls();
  }
}

function loop(now) {
  const elapsed = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  accumulator += elapsed;

  while (accumulator >= DT) {
    updateTick();
    accumulator -= DT;
  }

  renderFrame();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
