// js/physics.js //
"use strict";

// Machine Gun & Bullet Pace Tuning
const GUN_BURST_COUNT = 5;        // Rounds per burst
const GUN_SHOT_INTERVAL = 0.095;  // Seconds between shots inside a burst
const GUN_RELOAD_TIME = 0.68;     // Seconds pause between bursts
const BULLET_SPEED_MULT = 0.80;   // -20% bullet speed

// Super Cannon (頂帽大炮) Tuning
const CANNON_COOLDOWN = 60.0;                        // 60 seconds cooldown
const CANNON_DAMAGE = 200;                           // 200 AoE damage
const CANNON_FUSE_SEC = 1.0;                         // Explodes 1.0 sec after shot
const CANNON_AOE_RADIUS = 115;                       // Area of effect radius
const CANNON_SPIN_RAD_PER_SEC = (3 * Math.PI * 2) / 0.8; // 3 full rotations per 0.8 sec

const game = {
  state: "SELECT",
  debug: false,
  runSeed: 0,
  transitions: 0,
  roomType: "START",
  camZoom: 2.0,
  bossArmed: false,
  bossDefeated: false,
  hudButtons: [],
  elapsedTime: 0,
  screenIdx: 0,
  activeScreen: null,
  worldW: W,
  worldH: H,
  stageTimer: 600,
  score: 0,
  shakeTimer: 0,
  fadeTimer: 0,
  victoryWalkTimer: 0,
  camX: 0,
  camY: 0,
  aimWorldX: 300,
  aimWorldY: 480,
  bullets: [],
  bones: [],
  missiles: [],
  particles: [],
  shockwaves: []
};

const hero = {
  x: 112, y: 492, w: 34, h: 56,
  vx: 0, vy: 0, facing: 1, aimAngle: 0,
  grounded: false, onLadder: false, activeLadder: null, dropThroughTimer: 0, downHoldTimer: 0,
  hp: 100, maxHp: 100, invulnTimer: 0,
  gunCooldown: 0, gunBurstRemaining: 0, gunReloadTimer: 0,
  bones: 0,
  hasMissileHat: false, hatCooldown: 0, hatMaxCooldown: CANNON_COOLDOWN,
  asthma: 0, asthmaStun: 0, asthmaPending: false,
  animState: "IDLE", animTimer: 0,
  traits: { blind: true, prosthesis: false, deaf: false, tremor: false, asthma: false },
  stats: computeHunterStats(["blind"]),
  identity: { code: "1", ...FALLBACK_TRAITS_DATA.roster["1"] }
};

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function spawnParticles(x, y, color, count = 8, speed = 160) {
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = (0.3 + Math.random() * 0.7) * speed;
    game.particles.push({
      x, y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 40,
      life: 0.25 + Math.random() * 0.25,
      maxLife: 0.5,
      color,
      size: 3 + Math.random() * 3
    });
  }
}

function damageHero(amount, knockDir) {
  if (hero.invulnTimer > 0 || game.state !== "PLAY") return;
  hero.hp = Math.max(0, hero.hp - amount);
  hero.invulnTimer = 1.0;
  hero.onLadder = false;
  hero.activeLadder = null;
  hero.vx = knockDir * 210;
  hero.vy = -250;
  game.shakeTimer = 0.2;
  spawnParticles(hero.x + hero.w / 2, hero.y + hero.h / 2, "#dc2626", 12, 180);
  SFX.beep(140, 0.25, "sawtooth", 0.12, 60);

  if (hero.hp <= 0) {
    game.state = "GAMEOVER";
    SFX.syncBgm();
  }
}

function getActiveCamZoom() {
  if (game.state !== "PLAY" && game.state !== "VICTORY_WALK") return 1.0;
  return game.debug ? 1.0 : (game.camZoom || 2.0);
}

function updateCamera() {
  const zoom = getActiveCamZoom();
  const viewW = W / zoom;
  const viewH = H / zoom;
  const targetX = Math.max(0, Math.min(game.worldW - viewW, hero.x + hero.w / 2 - viewW / 2));
  const targetY = Math.max(0, Math.min(game.worldH - viewH, hero.y + hero.h / 2 - viewH / 2));
  game.camX += (targetX - game.camX) * 0.16;
  game.camY += (targetY - game.camY) * 0.16;
}

function stepHero(input, scr) {
  const GRAVITY = 1380;
  const WALK_SPEED = hero.stats.walkSpeed;
  const CLIMB_SPEED = hero.stats.climbSpeed;
  const JUMP_VEL = hero.stats.jumpVel;

  hero.hatMaxCooldown = CANNON_COOLDOWN;

  if (hero.invulnTimer > 0) hero.invulnTimer = Math.max(0, hero.invulnTimer - DT);
  if (hero.gunCooldown > 0) hero.gunCooldown = Math.max(0, hero.gunCooldown - DT);
  if (hero.gunReloadTimer > 0) hero.gunReloadTimer = Math.max(0, hero.gunReloadTimer - DT);
  if (hero.hatCooldown > 0) hero.hatCooldown = Math.max(0, hero.hatCooldown - DT);
  if (hero.dropThroughTimer > 0) hero.dropThroughTimer = Math.max(0, hero.dropThroughTimer - DT);

  const zoom = getActiveCamZoom();
  const jitterAmp = hero.traits.tremor ? hero.stats.aimJitterPx : 0;
  const jitterX = jitterAmp > 0 ? Math.sin(game.elapsedTime * 37) * jitterAmp + (Math.random() - 0.5) * 8 : 0;
  const jitterY = jitterAmp > 0 ? Math.cos(game.elapsedTime * 43) * jitterAmp + (Math.random() - 0.5) * 8 : 0;
  game.aimWorldX = mouse.screenX / zoom + game.camX + jitterX;
  game.aimWorldY = mouse.screenY / zoom + game.camY + jitterY;

  const shoulderX = hero.x + hero.w / 2;
  const shoulderY = hero.y + hero.h * 0.45;
  hero.aimAngle = Math.atan2(game.aimWorldY - shoulderY, game.aimWorldX - shoulderX);
  hero.facing = Math.cos(hero.aimAngle) >= 0 ? 1 : -1;

  if (hero.traits.asthma) {
    if (hero.asthmaStun > 0) {
      hero.asthmaStun = Math.max(0, hero.asthmaStun - DT);
      hero.animTimer += DT * 10;
      if (hero.asthmaStun === 0) {
        hero.asthma = 0;
        hero.asthmaPending = false;
      }
      hero.vx = 0;
      hero.vy = Math.min(hero.vy + GRAVITY * DT, 760);
      resolveCollisions(scr, true);
      return;
    }

    if (input.aHeld || input.wHeld) {
      hero.asthma = Math.min(100, hero.asthma + hero.stats.fatigueGainPerSec * DT);
      if (hero.asthma >= 100) {
        if (hero.grounded || hero.onLadder) {
          hero.asthmaStun = hero.stats.stunDurationSec;
          hero.onLadder = false;
          hero.activeLadder = null;
          SFX.beep(180, 0.3, "sine", 0.09, 110);
          return;
        } else {
          hero.asthmaPending = true;
        }
      }
    } else if (!hero.asthmaPending) {
      hero.asthma = Math.max(0, hero.asthma - hero.stats.fatigueDecayPerSec * DT);
    }
  }

  const ladderGrabBox = { x: hero.x - 4, y: hero.y - 4, w: hero.w + 8, h: hero.h + 14 };
  const ladder = scr.ladders.find(l => rectsOverlap(ladderGrabBox, l));

  if (ladder && (input.wHeld || input.sHeld)) {
    hero.onLadder = true;
    hero.activeLadder = ladder;
    hero.grounded = false;
    hero.vx = 0;
    hero.vy = input.wHeld ? -CLIMB_SPEED : CLIMB_SPEED;
    const targetX = ladder.x + (ladder.w - hero.w) / 2;
    hero.x += (targetX - hero.x) * 0.45;
  } else if (!ladder) {
    hero.onLadder = false;
    hero.activeLadder = null;
  }

  if (!hero.onLadder) {
    const moveDir = (input.dHeld ? 1 : 0) - (input.aHeld ? 1 : 0);
    if (hero.invulnTimer < 0.75) {
      hero.vx = moveDir * WALK_SPEED;
    }
    hero.vy = Math.min(hero.vy + GRAVITY * DT, 760);
  } else if (!input.wHeld && !input.sHeld) {
    hero.vy = 0;
    const moveDir = (input.dHeld ? 1 : 0) - (input.aHeld ? 1 : 0);
    hero.vx = moveDir * WALK_SPEED * 0.75;
  }

  if (input.sHeld && hero.grounded && !hero.onLadder) {
    hero.downHoldTimer += DT;
  } else {
    hero.downHoldTimer = 0;
  }

  if (((input.jumpPressed && input.sHeld) || hero.downHoldTimer >= 0.14) && hero.grounded && !hero.onLadder) {
    hero.dropThroughTimer = 0.22;
    hero.downHoldTimer = 0;
    hero.grounded = false;
    hero.y += 5;
  } else if (input.jumpPressed && hero.grounded && !hero.onLadder) {
    hero.grounded = false;
    hero.vy = JUMP_VEL;
    SFX.beep(320, 0.11, "square", 0.06, 540);
  }

  resolveCollisions(scr, false);
  hero.x = Math.max(0, Math.min(game.worldW - hero.w, hero.x));

  if (hero.traits.asthma && hero.asthmaPending && hero.grounded) {
    hero.asthmaPending = false;
    hero.asthmaStun = hero.stats.stunDurationSec;
    hero.vx = 0;
    SFX.beep(180, 0.3, "sine", 0.09, 110);
    return;
  }

  const exitLocked = Boolean(scr.exit?.lockedUntilBossDead && !game.bossDefeated);
  if (scr.exit && !exitLocked && rectsOverlap(hero, scr.exit)) {
    advanceToNextScreen();
    return;
  }

  if (hero.onLadder) {
    hero.animState = "CLIMB";
    if (Math.abs(hero.vy) > 1) hero.animTimer += DT * 9;
  } else if (!hero.grounded) {
    hero.animState = "JUMP";
  } else if (Math.abs(hero.vx) > 5) {
    hero.animState = "RUN";
    hero.animTimer += DT * 12;
  } else {
    hero.animState = "IDLE";
    hero.animTimer = 0;
  }

  if (hero.gunBurstRemaining === 0 && hero.gunReloadTimer <= 0 && input.gunHeld) {
    hero.gunBurstRemaining = GUN_BURST_COUNT;
  }

  if (hero.gunBurstRemaining > 0 && hero.gunCooldown <= 0) {
    const spreadAngle = hero.traits.tremor ? (Math.random() - 0.5) * hero.stats.spreadRad : 0;
    const fireAngle = hero.aimAngle + spreadAngle;
    const dirX = Math.cos(fireAngle);
    const dirY = Math.sin(fireAngle);
    const muzzleX = shoulderX + dirX * 18;
    const muzzleY = shoulderY + dirY * 18;

    hero.gunCooldown = GUN_SHOT_INTERVAL;
    hero.gunBurstRemaining--;
    if (hero.gunBurstRemaining === 0) {
      hero.gunReloadTimer = GUN_RELOAD_TIME;
    }

    const bulletSpeed = hero.stats.bulletSpeed * BULLET_SPEED_MULT;
    game.bullets.push({
      x: muzzleX, y: muzzleY,
      vx: dirX * bulletSpeed, vy: dirY * bulletSpeed,
      traveled: 0,
      dropStartDist: HALF_W * hero.stats.bulletDropRatio,
      damage: 10
    });
    SFX.beep(640, 0.036, "triangle", 0.06, 240);
  }

  if (input.bonePressed && hero.bones > 0) {
    const dirX = Math.cos(hero.aimAngle);
    const dirY = Math.sin(hero.aimAngle);
    const muzzleX = shoulderX + dirX * 18;
    const muzzleY = shoulderY + dirY * 18;
    hero.bones--;
    const boneSpeed = 480;
    game.bones.push({
      x: muzzleX, y: muzzleY - 4,
      vx: dirX * boneSpeed + hero.vx * 0.15,
      vy: dirY * boneSpeed - 150,
      rot: 0
    });
    SFX.beep(440, 0.12, "triangle", 0.09, 680);
  }

  // Super Cannon (頂帽大炮): 60s cooldown, bouncing/rolling physics ball, explodes after 1.0s for 200 AoE damage
  if (input.hatPressed && hero.hasMissileHat && hero.hatCooldown <= 0) {
    const dirX = Math.cos(hero.aimAngle);
    const dirY = Math.sin(hero.aimAngle);
    hero.hatCooldown = CANNON_COOLDOWN;
    const launchSpeed = 420;
    game.missiles.push({
      x: shoulderX + dirX * 12,
      y: hero.y - 4,
      r: 11,
      vx: dirX * launchSpeed + hero.vx * 0.25,
      vy: dirY * launchSpeed - 140,
      rot: 0,
      spinDir: dirX >= 0 ? 1 : -1,
      timer: 0,
      fuse: CANNON_FUSE_SEC,
      damage: CANNON_DAMAGE,
      splashRadius: CANNON_AOE_RADIUS
    });
    spawnParticles(shoulderX + dirX * 12, hero.y - 4, "#facc15", 8, 120);
    SFX.beep(190, 0.24, "sawtooth", 0.12, 85);
  }
}

function resolveCollisions(scr, stunned) {
  const onActiveLadder = hero.onLadder && hero.activeLadder;

  hero.x += hero.vx * DT;
  for (const s of scr.solids) {
    if (rectsOverlap(hero, s)) {
      if (onActiveLadder && s.y < game.worldH - 40 && Math.abs((hero.y + hero.h) - s.y) <= 18) continue;
      if (hero.vx > 0) hero.x = s.x - hero.w;
      else if (hero.vx < 0) hero.x = s.x + s.w;
      hero.vx = 0;
    }
  }

  const prevBottom = hero.y + hero.h;
  hero.y += hero.vy * DT;
  hero.grounded = false;

  for (const s of scr.solids) {
    if (onActiveLadder && s.y < game.worldH - 40) {
      const overlapsLadderX = s.x < hero.activeLadder.x + hero.activeLadder.w + 8 &&
                              s.x + s.w > hero.activeLadder.x - 8;
      if (overlapsLadderX) continue;
    }

    if (rectsOverlap(hero, s)) {
      if (hero.vy > 0) {
        hero.y = s.y - hero.h;
        hero.vy = 0;
        hero.grounded = true;
      } else if (hero.vy < 0) {
        hero.y = s.y + s.h;
        hero.vy = 0;
      }
    }
  }

  if (!hero.onLadder && hero.vy >= 0 && (stunned || hero.dropThroughTimer <= 0)) {
    for (const p of scr.oneWay) {
      if (
        hero.x + hero.w > p.x &&
        hero.x < p.x + p.w &&
        prevBottom <= p.y + 6 &&
        hero.y + hero.h >= p.y
      ) {
        hero.y = p.y - hero.h;
        hero.vy = 0;
        hero.grounded = true;
      }
    }
  }
}

function detonateCannonBall(m, scr) {
  game.shakeTimer = 0.30;
  spawnParticles(m.x, m.y, "#ef4444", 24, 260);
  spawnParticles(m.x, m.y, "#facc15", 16, 210);
  spawnParticles(m.x, m.y, "#334155", 12, 160);
  game.shockwaves.push({
    x: m.x,
    y: m.y,
    radius: 14,
    maxRadius: m.splashRadius,
    life: 0.28,
    maxLife: 0.28
  });
  SFX.beep(95, 0.34, "sawtooth", 0.16, 36);

  for (const e of scr.enemies) {
    if (!e.alive) continue;
    const closestX = Math.max(e.x, Math.min(m.x, e.x + e.w));
    const closestY = Math.max(e.y, Math.min(m.y, e.y + e.h));
    const dist = Math.hypot(m.x - closestX, m.y - closestY);
    if (dist <= m.splashRadius) {
      damageEnemy(e, m.damage, m.x, m.y);
    }
  }
}

function stepProjectilesAndPickups(scr) {
  for (const p of scr.pickups) {
    if (p.collected) continue;
    if (rectsOverlap(hero, p)) {
      p.collected = true;
      if (p.type === "chicken") {
        hero.hp = Math.min(hero.maxHp, hero.hp + 50);
        hero.bones += 2;
        hero.asthma = 0;
        game.score += 200;
        spawnParticles(p.x + p.w / 2, p.y + p.h / 2, "#e08a2e", 10, 140);
        SFX.beep(520, 0.18, "triangle", 0.1, 880);
      } else if (p.type === "hat") {
        hero.hasMissileHat = true;
        hero.hatMaxCooldown = CANNON_COOLDOWN;
        hero.hatCooldown = 0;
        game.score += 500;
        spawnParticles(p.x + p.w / 2, p.y + p.h / 2, "#f5c518", 14, 160);
        SFX.beep(440, 0.25, "square", 0.1, 990);
      } else if (p.type === "crown") {
        game.score += 250;
        spawnParticles(p.x + p.w / 2, p.y + p.h / 2, "#dc2626", 10, 140);
        SFX.beep(660, 0.14, "sine", 0.1, 1040);
      } else if (p.type === "treasure") {
        game.score += 1500;
        spawnParticles(p.x + p.w / 2, p.y + p.h / 2, "#ffd700", 20, 200);
        SFX.beep(523, 0.25, "square", 0.12, 1046);
      }
    }
  }

  for (let i = game.bullets.length - 1; i >= 0; i--) {
    const b = game.bullets[i];
    if (b.traveled >= b.dropStartDist) b.vy += 1850 * DT;
    else b.vy += 90 * DT;

    const stepX = b.vx * DT;
    const stepY = b.vy * DT;
    b.x += stepX;
    b.y += stepY;
    b.traveled += Math.hypot(stepX, stepY);

    const hitSolid = scr.solids.some(s => b.x >= s.x && b.x <= s.x + s.w && b.y >= s.y && b.y <= s.y + s.h);
    if (hitSolid || b.y > game.worldH || b.x < 0 || b.x > game.worldW) {
      spawnParticles(b.x, b.y, "#1e3a8a", 4, 80);
      game.bullets.splice(i, 1);
      continue;
    }

    let hitEnemy = false;
    for (const e of scr.enemies) {
      if (!e.alive) continue;
      if (b.x >= e.x && b.x <= e.x + e.w && b.y >= e.y && b.y <= e.y + e.h) {
        damageEnemy(e, b.damage, b.x, b.y);
        hitEnemy = true;
        break;
      }
    }
    if (hitEnemy) game.bullets.splice(i, 1);
  }

  for (let i = game.bones.length - 1; i >= 0; i--) {
    const bone = game.bones[i];
    bone.vy += 760 * DT;
    bone.x += bone.vx * DT;
    bone.y += bone.vy * DT;
    bone.rot += 15 * DT;

    const hitSolid = scr.solids.some(s => bone.x >= s.x && bone.x <= s.x + s.w && bone.y >= s.y && bone.y <= s.y + s.h);
    if (hitSolid || bone.y > game.worldH || bone.x < -40 || bone.x > game.worldW + 40) {
      spawnParticles(bone.x, bone.y, "#f8fafc", 8, 130);
      SFX.beep(220, 0.08, "triangle", 0.07, 120);
      game.bones.splice(i, 1);
      continue;
    }

    let hitEnemy = false;
    for (const e of scr.enemies) {
      if (!e.alive) continue;
      if (bone.x >= e.x - 6 && bone.x <= e.x + e.w + 6 && bone.y >= e.y - 6 && bone.y <= e.y + e.h + 6) {
        const boneDmg = Math.max(1, Math.round(e.hp * 0.15));
        damageEnemy(e, boneDmg, bone.x, bone.y);
        spawnParticles(bone.x, bone.y, "#fef08a", 12, 170);
        hitEnemy = true;
        break;
      }
    }
    if (hitEnemy) game.bones.splice(i, 1);
  }

  // Physics bouncing & rolling cannonball (3 rotations per 0.8s, explodes after 1.0s, never drops down ladders)
  for (let i = game.missiles.length - 1; i >= 0; i--) {
    const m = game.missiles[i];
    const r = m.r || 11;
    m.timer += DT;
    m.rot += m.spinDir * CANNON_SPIN_RAD_PER_SEC * DT;

    if (Math.random() < 0.65) {
      spawnParticles(m.x, m.y - r * 0.6, "#fb923c", 1, 55);
    }

    // Horizontal step & wall bounce
    m.x += m.vx * DT;
    if (m.x - r < 24) {
      m.x = 24 + r;
      m.vx = Math.abs(m.vx) * 0.65;
      m.spinDir = 1;
    } else if (m.x + r > game.worldW - 24) {
      m.x = game.worldW - 24 - r;
      m.vx = -Math.abs(m.vx) * 0.65;
      m.spinDir = -1;
    }

    for (const s of scr.solids) {
      if (m.y + r > s.y + 2 && m.y - r < s.y + s.h - 2) {
        if (m.vx > 0 && m.x + r > s.x && m.x - r < s.x) {
          m.x = s.x - r;
          m.vx = -Math.abs(m.vx) * 0.65;
          m.spinDir = -1;
          SFX.beep(240, 0.04, "triangle", 0.05, 160);
        } else if (m.vx < 0 && m.x - r < s.x + s.w && m.x + r > s.x + s.w) {
          m.x = s.x + s.w + r;
          m.vx = Math.abs(m.vx) * 0.65;
          m.spinDir = 1;
          SFX.beep(240, 0.04, "triangle", 0.05, 160);
        }
      }
    }

    // Gravity & vertical bounce / roll (treats both solids AND oneWay ladder hatches as solid ground)
    const prevBottom = m.y + r;
    m.vy = Math.min(m.vy + 1240 * DT, 820);
    m.y += m.vy * DT;

    let landedSurfaceY = null;
    for (const s of scr.solids) {
      if (m.x + r > s.x && m.x - r < s.x + s.w) {
        if (m.vy >= 0 && prevBottom <= s.y + 10 && m.y + r >= s.y) {
          if (landedSurfaceY === null || s.y < landedSurfaceY) landedSurfaceY = s.y;
        } else if (m.vy < 0 && m.y - r <= s.y + s.h && m.y + r > s.y + s.h) {
          m.y = s.y + s.h + r;
          m.vy = Math.abs(m.vy) * 0.5;
        }
      }
    }

    if (m.vy >= 0) {
      for (const p of scr.oneWay) {
        if (m.x + r > p.x && m.x - r < p.x + p.w && prevBottom <= p.y + 10 && m.y + r >= p.y) {
          if (landedSurfaceY === null || p.y < landedSurfaceY) landedSurfaceY = p.y;
        }
      }
    }

    if (landedSurfaceY !== null) {
      m.y = landedSurfaceY - r;
      if (m.vy > 125) {
        m.vy = -m.vy * 0.54;
        m.vx *= 0.86;
        SFX.beep(210, 0.04, "triangle", 0.05, 140);
      } else {
        m.vy = 0;
        m.vx *= Math.pow(0.42, DT);
      }
    }

    // Bounce off enemies without prematurely detonating before 1.0s
    for (const e of scr.enemies) {
      if (!e.alive) continue;
      if (m.x + r > e.x && m.x - r < e.x + e.w && m.y + r > e.y && m.y - r < e.y + e.h) {
        const bounceDir = (m.x < e.x + e.w * 0.5) ? -1 : 1;
        m.vx = bounceDir * Math.max(120, Math.abs(m.vx) * 0.55);
        m.vy = Math.min(m.vy, -140);
        m.spinDir = bounceDir;
        break;
      }
    }

    if (m.timer >= (m.fuse || CANNON_FUSE_SEC)) {
      detonateCannonBall(m, scr);
      game.missiles.splice(i, 1);
    }
  }
}

function alertGiantAxeman(enemy) {
  if (!enemy || enemy.kind !== "giant") return;
  const heroCenterX = hero.x + hero.w * 0.5;
  const enemyCenterX = enemy.x + enemy.w * 0.5;

  if (!enemy.alerted) {
    enemy.alertTimer = 0.75;
    SFX.beep(165, 0.14, "sawtooth", 0.08, 220);
  }
  enemy.alerted = true;
  enemy.aggroTimer = 8.0;
  enemy.facing = heroCenterX < enemyCenterX ? -1 : 1;

  if (enemy.aiState === "PATROL" || enemy.aiState === "WALK") {
    enemy.aiState = "CHASE";
  }
}

function hasGiantLineOfSight(scr, g) {
  const gx = g.x + g.w * 0.5;
  const hx = hero.x + hero.w * 0.5;
  const dx = hx - gx;
  const absDx = Math.abs(dx);

  const dy = Math.abs((hero.y + hero.h) - (g.y + g.h));
  if (dy > (g.isBoss ? 150 : 120)) return false;

  const inFront = (dx * g.facing >= 0) && (absDx <= (g.visionRange || 420));
  const closeBehind = absDx <= 110;
  if (!inFront && !closeBehind) return false;

  const eyeY = g.y + g.h * 0.30;
  const minRayX = Math.min(gx, hx);
  const maxRayX = Math.max(gx, hx);
  for (const s of scr.solids) {
    if (s.w <= 36 && s.h > 40 && s.y <= eyeY && s.y + s.h >= eyeY) {
      if (s.x + s.w > minRayX && s.x < maxRayX) {
        return false;
      }
    }
  }
  return true;
}

function snapEnemyToGround(scr, e) {
  const footX = e.x + e.w * 0.5;
  let bestFloorY = null;

  for (const s of scr.solids) {
    if (s.w > 36 && footX >= s.x && footX <= s.x + s.w) {
      if (s.y >= e.y + e.h - 24 && s.y <= e.y + e.h + 24) {
        if (bestFloorY === null || s.y < bestFloorY) bestFloorY = s.y;
      }
    }
  }
  if (bestFloorY === null) {
    for (const p of scr.oneWay) {
      if (footX >= p.x && footX <= p.x + p.w) {
        if (p.y >= e.y + e.h - 20 && p.y <= e.y + e.h + 20) {
          if (bestFloorY === null || p.y < bestFloorY) bestFloorY = p.y;
        }
      }
    }
  }
  if (bestFloorY !== null) {
    e.y = bestFloorY - e.h;
  }
}

function damageEnemy(enemy, dmg, hitX, hitY) {
  enemy.hp -= dmg;
  enemy.hurtTimer = 0.14;
  spawnParticles(hitX, hitY, "#dc2626", 6, 120);
  SFX.beep(190, 0.07, "square", 0.07, 110);

  if (enemy.hp > 0) {
    if (enemy.kind === "giant") {
      alertGiantAxeman(enemy);
    } else if (enemy.kind === "blade") {
      enemy.alerted = true;
      enemy.aggroTimer = 5.0;
      enemy.facing = (hero.x + hero.w * 0.5) < (enemy.x + enemy.w * 0.5) ? -1 : 1;
    }
  }

  if (enemy.hp <= 0) {
    enemy.alive = false;
    game.score += enemy.scoreValue || (enemy.kind === "giant" ? 800 : 250);

    if (enemy.kind === "alien" && game.activeScreen && Array.isArray(game.activeScreen.pickups)) {
      game.activeScreen.pickups.push({
        type: "hat",
        name: "頂帽大炮",
        x: Math.round(enemy.x + enemy.w * 0.5 - 22),
        y: Math.round(enemy.y + enemy.h - 32),
        w: 44,
        h: 32,
        collected: false
      });
      spawnParticles(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, "#38bdf8", 22, 210);
      SFX.beep(520, 0.28, "triangle", 0.12, 980);
    }

    if (enemy.isBoss) {
      game.bossDefeated = true;
      game.shakeTimer = 0.45;
      SFX.beep(440, 0.35, "triangle", 0.12, 880);
    }
    spawnParticles(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, "#1e293b", 16, 200);
    SFX.beep(150, 0.22, "sawtooth", 0.1, 55);
  }
}

function stepEnemies(scr) {
  if (game.roomType === "START" && game.transitions === 0 && !hero.hasMissileHat && !scr._alienSpawned) {
    if (typeof ensureStartScreenAlien === "function") ensureStartScreenAlien(scr);
  }

  const atkMult = getCompoundAttackMultiplier(game.transitions);

  for (const e of scr.enemies) {
    if (!e.alive) continue;
    if (e.hurtTimer > 0) e.hurtTimer = Math.max(0, e.hurtTimer - DT);

    if (e.kind === "alien") {
      const ex = e.x + e.w * 0.5;
      const hx = hero.x + hero.w * 0.5;
      e.facing = hx < ex ? -1 : 1;
      snapEnemyToGround(scr, e);
      continue;
    }

    if (e.kind === "blade") {
      if (e.slashCooldown > 0) e.slashCooldown = Math.max(0, e.slashCooldown - DT);
      if (e.slashTimer > 0) e.slashTimer = Math.max(0, e.slashTimer - DT);

      const ex = e.x + e.w * 0.5;
      const hx = hero.x + hero.w * 0.5;
      const dx = hx - ex;
      const dist = Math.abs(dx);
      const sameFloor = Math.abs((hero.y + hero.h) - (e.y + e.h)) < 80;
      const canSee = hasGiantLineOfSight(scr, e);

      if (canSee) {
        e.alerted = true;
        e.aggroTimer = 4.5;
      } else if (e.alerted) {
        e.aggroTimer -= DT;
        if (e.aggroTimer <= 0 && dist > 420) e.alerted = false;
      }

      if (e.alerted && sameFloor) {
        e.animTimer += DT * 1.8;
        const dir = dx < 0 ? -1 : 1;
        e.facing = dir;
        const runSpeed = e.chaseSpeed || 164.5;
        e.x = Math.max(e.minX, Math.min(e.maxX - e.w, e.x + dir * runSpeed * DT));
      } else {
        e.animTimer += DT;
        e.x += e.vx * DT;
        if (e.x <= e.minX) { e.x = e.minX; e.vx = Math.abs(e.vx); e.facing = 1; }
        if (e.x + e.w >= e.maxX) { e.x = e.maxX - e.w; e.vx = -Math.abs(e.vx); e.facing = -1; }
      }

      snapEnemyToGround(scr, e);

      const slashBox = {
        x: e.facing === 1 ? e.x + e.w * 0.4 : e.x - 22,
        y: e.y + 8,
        w: e.w * 0.6 + 22,
        h: e.h - 12
      };

      if (sameFloor && (rectsOverlap(hero, slashBox) || rectsOverlap(hero, e))) {
        e.facing = dx < 0 ? -1 : 1;
        if (e.slashCooldown <= 0) {
          e.slashTimer = 0.24;
          e.slashCooldown = 0.65;
          SFX.beep(260, 0.08, "sawtooth", 0.07, 140);
          damageHero(e.atk || Math.round(15 * atkMult), e.facing);
        }
      }
      continue;
    }

    if (e.kind === "giant") {
      if (e.alertTimer > 0) e.alertTimer = Math.max(0, e.alertTimer - DT);
      if (e.chargeCooldown > 0) e.chargeCooldown = Math.max(0, e.chargeCooldown - DT);

      const gx = e.x + e.w * 0.5;
      const hx = hero.x + hero.w * 0.5;
      const dx = hx - gx;
      const distToHero = Math.abs(dx);
      const sameFloor = Math.abs((hero.y + hero.h) - (e.y + e.h)) < (e.isBoss ? 150 : 120);
      const canSeeHero = hasGiantLineOfSight(scr, e);

      if (canSeeHero) {
        alertGiantAxeman(e);
      } else if (e.alerted && !e.isBoss) {
        e.aggroTimer -= DT;
        if (e.aggroTimer <= 0 && distToHero > 520) {
          e.alerted = false;
          e.aiState = "PATROL";
        }
      }

      const meleeReach = e.isBoss ? 132 : 98;
      const chargeMinRange = e.isBoss ? 110 : 75;
      const chargeMaxRange = e.isBoss ? 560 : 520;

      if (e.aiState === "PATROL" || e.aiState === "WALK") {
        e.animTimer += DT;
        e.x += e.vx * DT;
        e.weaponAngle = -0.35 + Math.sin(Math.floor(e.animTimer * 8)) * 0.12;
        if (e.x <= e.minX) { e.x = e.minX; e.vx = Math.abs(e.vx); e.facing = 1; }
        if (e.x + e.w >= e.maxX) { e.x = e.maxX - e.w; e.vx = -Math.abs(e.vx); e.facing = -1; }
      } else if (e.aiState === "CHASE") {
        e.animTimer += DT * 1.45;
        e.facing = dx < 0 ? -1 : 1;
        e.weaponAngle = -0.45 + Math.sin(e.animTimer * 12) * 0.18;

        if (distToHero <= meleeReach && sameFloor) {
          e.aiState = "STAND_WINDUP";
          e.aiTimer = 0.34;
        } else if (
          e.chargeCooldown <= 0 &&
          sameFloor &&
          distToHero >= chargeMinRange &&
          distToHero <= chargeMaxRange
        ) {
          e.aiState = "CHARGE_WINDUP";
          e.aiTimer = 0.40;
          e.chargeDir = e.facing;
          SFX.beep(125, 0.18, "sawtooth", 0.09, 85);
        } else {
          const step = e.facing * (e.chaseSpeed || 96) * DT;
          e.x = Math.max(e.minX, Math.min(e.maxX - e.w, e.x + step));
        }
      } else if (e.aiState === "STAND_WINDUP") {
        e.aiTimer -= DT;
        e.weaponAngle = -1.4;
        if (e.aiTimer <= 0) {
          e.aiState = "STAND_STRIKE";
          e.aiTimer = 0.18;
          e.struckThisSwing = false;
          SFX.beep(130, 0.14, "sawtooth", 0.09, 70);
        }
      } else if (e.aiState === "STAND_STRIKE") {
        e.aiTimer -= DT;
        e.weaponAngle = 1.45;
        if (!e.struckThisSwing) {
          const wpnLen = e.weaponLength || 68;
          const axeBox = {
            x: e.facing === 1 ? e.x + e.w * 0.45 : e.x + e.w * 0.55 - wpnLen,
            y: e.y + e.h * 0.18,
            w: wpnLen,
            h: e.h * 0.78
          };
          if (rectsOverlap(hero, axeBox)) {
            e.struckThisSwing = true;
            damageHero(e.cleaveAtk || Math.round(24 * atkMult), e.facing);
          }
        }
        if (e.aiTimer <= 0) {
          e.aiState = "RECOVER";
          e.aiTimer = 0.42;
        }
      } else if (e.aiState === "CHARGE_WINDUP") {
        e.aiTimer -= DT;
        e.weaponAngle = -1.55;
        if (e.aiTimer <= 0) {
          e.aiState = "CHARGE_RUN";
          e.aiTimer = 1.15;
          e.chargeDistTraveled = 0;
          e.struckThisSwing = false;
          e.chargeCooldown = 2.6;
          SFX.beep(155, 0.22, "sawtooth", 0.1, 65);
        }
      } else if (e.aiState === "CHARGE_RUN") {
        e.aiTimer -= DT;
        e.animTimer += DT * 2.4;
        const dir = e.chargeDir || e.facing;
        e.facing = dir;
        e.weaponAngle = Math.sin(e.animTimer * 22) * 1.35;

        const moveStep = dir * (e.chargeSpeed || 122.5) * DT;
        const nextX = Math.max(e.minX, Math.min(e.maxX - e.w, e.x + moveStep));
        const actualMoved = Math.abs(nextX - e.x);
        e.x = nextX;
        e.chargeDistTraveled += actualMoved;

        if (Math.random() < 0.45) {
          spawnParticles(e.x + e.w * 0.5, e.y + e.h - 4, "#94a3b8", 1, 70);
        }

        if (!e.struckThisSwing) {
          const wpnLen = e.weaponLength || 68;
          const swingBox = {
            x: dir === 1 ? e.x + e.w * 0.35 : e.x + e.w * 0.65 - wpnLen,
            y: e.y + e.h * 0.16,
            w: wpnLen,
            h: e.h * 0.80
          };
          if (rectsOverlap(hero, swingBox)) {
            e.struckThisSwing = true;
            damageHero(e.chargeAtk || Math.round(24 * atkMult), dir);
          }
        }

        const hitBoundary = actualMoved < Math.abs(moveStep) * 0.25;
        if (e.aiTimer <= 0 || e.chargeDistTraveled >= (e.chargeMaxDist || 260) || hitBoundary) {
          e.aiState = "RECOVER";
          e.aiTimer = 0.55;
        }
      } else if (e.aiState === "RECOVER") {
        e.aiTimer -= DT;
        e.weaponAngle = 0.85;
        if (e.aiTimer <= 0) {
          e.aiState = e.alerted ? "CHASE" : "PATROL";
        }
      }

      snapEnemyToGround(scr, e);

      if (rectsOverlap(hero, e)) {
        damageHero(e.atk || Math.round(24 * atkMult), hero.x < e.x ? -1 : 1);
      }
    }
  }
}

function stepParticles() {
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i];
    p.life -= DT;
    p.vy += 420 * DT;
    p.x += p.vx * DT;
    p.y += p.vy * DT;
    if (p.life <= 0) game.particles.splice(i, 1);
  }
  for (let i = game.shockwaves.length - 1; i >= 0; i--) {
    const sw = game.shockwaves[i];
    sw.life -= DT;
    const progress = 1 - Math.max(0, sw.life / sw.maxLife);
    sw.radius = 14 + (sw.maxRadius - 14) * progress;
    if (sw.life <= 0) game.shockwaves.splice(i, 1);
  }
}
