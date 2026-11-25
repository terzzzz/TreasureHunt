//js/main.js//

"use strict";

function loadScreenByIndex(idx) {
  const screens = stageManager.data.screens;
  const tpl = screens[idx];
  const scrKey = tpl.id || tpl.file || String(idx);
  game.screenIdx = idx;
  debugDrag.draftBox = null;
  debugDrag.undoStack.length = 0;

  game.activeScreen = {
    id: scrKey,
    image: tpl.image || tpl.file || null,
    pageLeft: tpl.pageLeft || String(26 + idx * 2),
    pageRight: tpl.pageRight || String(27 + idx * 2),
    isFinal: Boolean(tpl.isFinal || idx === screens.length - 1),
    spawn: { ...(tpl.spawn || { x: 80, y: 492 }) },
    exit: tpl.exit ? { ...tpl.exit } : null,
    solids: (tpl.solids || [
      { x: 0, y: 548, w: 984, h: 73, hatched: true },
      { x: 0, y: 0, w: 24, h: 548 },
      { x: 960, y: 0, w: 24, h: 548 }
    ]).map(s => ({ ...s })),
    oneWay: (tpl.oneWay || []).map(p => ({ ...p })),
    ladders: (tpl.ladders || []).map(l => ({ ...l })),
    pickups: (tpl.pickups || []).map(p => ({ w: 28, h: 24, ...p, collected: false })),
    enemies: (tpl.enemies || []).map(e => {
      if (e.kind === "giant") {
        return {
          kind: "giant",
          x: e.x, y: e.y, w: e.w || 62, h: e.h || 100,
          vx: e.vx || -55, minX: e.minX, maxX: e.maxX, facing: -1,
          hp: e.hp || 150, maxHp: e.hp || 150,
          animTimer: 0, hurtTimer: 0, alive: true,
          aiState: "WALK", aiTimer: 0, weaponAngle: -0.35, weaponLength: 76, struckThisSwing: false
        };
      }
      return {
        kind: "blade",
        x: e.x, y: e.y, w: e.w || 30, h: e.h || 52,
        vx: e.vx || -80, minX: e.minX, maxX: e.maxX, facing: -1,
        hp: e.hp || 40, maxHp: e.hp || 40,
        animTimer: 0, hurtTimer: 0, alive: true, slashTimer: 0
      };
    })
  };

  const bgImg = stageManager.bgImages[scrKey];
  game.worldW = (bgImg && bgImg.loaded && bgImg.naturalWidth > W) ? bgImg.naturalWidth : (tpl.width || W);
  game.worldH = (bgImg && bgImg.loaded && bgImg.naturalHeight > H) ? bgImg.naturalHeight : (tpl.height || H);

  hero.x = game.activeScreen.spawn.x;
  hero.y = game.activeScreen.spawn.y;
  hero.vx = 0;
  hero.vy = 0;
  hero.onLadder = false;
  hero.grounded = false;

  game.bullets.length = 0;
  game.bones.length = 0;
  game.missiles.length = 0;
  game.particles.length = 0;

  game.camX = Math.max(0, Math.min(game.worldW - W, hero.x + hero.w / 2 - W / 2));
  game.camY = Math.max(0, Math.min(game.worldH - H, hero.y + hero.h / 2 - H / 2));
}

function advanceToNextScreen() {
  const nextIdx = game.screenIdx + 1;
  if (nextIdx >= stageManager.data.screens.length) {
    game.state = "VICTORY";
    SFX.syncBgm();
    return;
  }
  game.state = "SCREEN_FADE";
  game.fadeTimer = 0.28;
  SFX.beep(580, 0.16, "triangle", 0.09, 880);
  loadScreenByIndex(nextIdx);
}

function startStageWithSelectedTraits() {
  const chosen = setup.selected.slice(0, requiredTraitCount());
  if (chosen.length !== requiredTraitCount()) return;

  const computed = computeHunterStats(chosen);
  hero.traits = computed.active;
  hero.stats = computed;
  hero.identity = buildHunterIdentity(chosen);

  game.state = "PLAY";
  game.elapsedTime = 0;
  game.stageTimer = stageManager.data.timeLimit || 600;
  game.score = 0;
  inputDelayBuffer.length = 0;
  prevEffectiveInput = {
    left: false, right: false, up: false, down: false,
    jumpHeld: false, gunHeld: false, boneHeld: false, hatHeld: false
  };

  Object.assign(hero, {
    hp: computed.maxHp, maxHp: computed.maxHp,
    invulnTimer: 0, gunCooldown: 0, bones: 0,
    hasMissileHat: false, hatCooldown: 0,
    asthma: 0, asthmaStun: 0, asthmaPending: false,
    animState: "IDLE", animTimer: 0
  });

  loadScreenByIndex(0);
  SFX.syncBgm();
}

function returnToCharSelect() {
  game.state = "SELECT";
  game.screenIdx = 0;
  game.score = 0;
  game.stageTimer = stageManager.data.timeLimit || 600;
  game.elapsedTime = 0;
  game.shakeTimer = 0;
  game.fadeTimer = 0;

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

  if (game.state !== "PLAY" || !game.activeScreen) return;

  game.elapsedTime += DT;
  game.stageTimer = Math.max(0, game.stageTimer - DT);
  if (game.stageTimer <= 0) {
    game.state = "GAMEOVER";
    SFX.syncBgm();
    return;
  }

  const input = getEffectiveInput();
  stepHero(input, game.activeScreen);
  stepProjectilesAndPickups(game.activeScreen);
  stepEnemies(game.activeScreen);
  stepParticles();
  updateCamera();
}

function renderFrame() {
  if (game.state === "SELECT") {
    drawSelectScreen();
    return;
  }

  const scr = game.activeScreen;
  if (!scr) return;

  ctx.save();
  if (game.shakeTimer > 0) {
    ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
  }

  ctx.save();
  ctx.translate(-Math.round(game.camX), -Math.round(game.camY));

  drawActiveScreenBackground(scr);
  drawScreenEntities(scr);
  drawHero();
  drawProjectilesAndAimMark();

  ctx.restore();
  drawBlindSightMask();
  ctx.restore();

  if (game.state === "SCREEN_FADE") {
    ctx.fillStyle = `rgba(15, 23, 42, ${Math.min(1, game.fadeTimer / 0.28)})`;
    ctx.fillRect(0, 0, W, H);
  }

  drawHUD();
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
