// js/physics.js //
"use strict";

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
  particles: []
};

const hero = {
  x: 112, y: 492, w: 34, h: 56,
  vx: 0, vy: 0, facing: 1, aimAngle: 0,
  grounded: false, onLadder: false, dropThroughTimer: 0,
  hp: 100, maxHp: 100, invulnTimer: 0,
  gunCooldown: 0, gunBurstRemaining: 0, gunReloadTimer: 0,
  bones: 0,
  hasMissileHat: false, hatCooldown: 0, hatMaxCooldown: 4.5,
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

  const heroCenter = { x: hero.x + 6, y: hero.y + 4, w: hero.w - 12, h: hero.h };
  const ladder = scr.ladders.find(l => rectsOverlap(heroCenter, l));

  if (ladder && (input.wHeld || input.sHeld)) {
    hero.onLadder = true;
    hero.grounded = false;
    hero.vx = 0;
    hero.vy = input.wHeld ? -CLIMB_SPEED : CLIMB_SPEED;
    const targetX = ladder.x + (ladder.w - hero.w) / 2;
    hero.x += (targetX - hero.x) * 0.35;
  } else if (!ladder) {
    hero.onLadder = false;
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

  if (input.jumpPressed && input.sHeld && hero.grounded && !hero.onLadder) {
    hero.dropThroughTimer = 0.18;
    hero.grounded = false;
    hero.y += 4;
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
    hero.gunBurstRemaining = 7;
  }

  if (hero.gunBurstRemaining > 0 && hero.gunCooldown <= 0) {
    const spreadAngle = hero.traits.tremor ? (Math.random() - 0.5) * hero.stats.spreadRad : 0;
    const fireAngle = hero.aimAngle + spreadAngle;
    const dirX = Math.cos(fireAngle);
    const dirY = Math.sin(fireAngle);
    const muzzleX = shoulderX + dirX * 18;
    const muzzleY = shoulderY + dirY * 18;

    hero.gunCooldown = 0.045;
    hero.gunBurstRemaining--;
    if (hero.gunBurstRemaining === 0) {
      hero.gunReloadTimer = 0.40;
    }

    const bulletSpeed = hero.stats.bulletSpeed;
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
      rot: 0, damage: 55
    });
    SFX.beep(440, 0.12, "triangle", 0.09, 680);
  }

  if (input.hatPressed && hero.hasMissileHat && hero.hatCooldown <= 0) {
    const dirX = Math.cos(hero.aimAngle);
    const dirY = Math.sin(hero.aimAngle);
    hero.hatCooldown = hero.hatMaxCooldown;
    game.missiles.push({
      x: shoulderX, y: hero.y - 4,
      vx: dirX * 520, vy: dirY * 520 - 70,
      targetVx: dirX * 560, targetVy: dirY * 560,
      timer: 0, damage: 110, splashRadius: 74
    });
    SFX.beep(260, 0.22, "sawtooth", 0.1, 720);
  }
}

function resolveCollisions(scr, stunned) {
  hero.x += hero.vx * DT;
  for (const s of scr.solids) {
    if (rectsOverlap(hero, s)) {
      if (hero.vx > 0) hero.x = s.x - hero.w;
      else if (hero.vx < 0) hero.x = s.x + s.w;
      hero.vx = 0;
    }
  }

  const prevBottom = hero.y + hero.h;
  hero.y += hero.vy * DT;
  hero.grounded = false;

  for (const s of scr.solids) {
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

function stepProjectilesAndPickups(scr) {
  for (const p of scr.pickups) {
    if (p.collected) continue;
    if (rectsOverlap(hero, p)) {
      p.collected = true;
      if (p.type === "chicken") {
        hero.hp = Math.min(hero.maxHp, hero.hp + 45);
        hero.bones = 4;
        hero.asthma = 0;
        game.score += 200;
        spawnParticles(p.x + p.w / 2, p.y + p.h / 2, "#e08a2e", 10, 140);
        SFX.beep(520, 0.18, "triangle", 0.1, 880);
      } else if (p.type === "hat") {
        hero.hasMissileHat = true;
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
        damageEnemy(e, bone.damage, bone.x, bone.y);
        spawnParticles(bone.x, bone.y, "#fef08a", 12, 170);
        hitEnemy = true;
        break;
      }
    }
    if (hitEnemy) game.bones.splice(i, 1);
  }

  for (let i = game.missiles.length - 1; i >= 0; i--) {
    const m = game.missiles[i];
    m.timer += DT;
    if (m.timer > 0.12) {
      m.vx += (m.targetVx - m.vx) * 0.25;
      m.vy += (m.targetVy - m.vy) * 0.25;
    }
    m.x += m.vx * DT;
    m.y += m.vy * DT;

    if (m.timer % 0.03 < DT) spawnParticles(m.x, m.y, "#fb923c", 2, 40);

    const outOfWorld = m.x < 0 || m.x > game.worldW || m.y < 0 || m.y > game.worldH;
    const hitSolid = scr.solids.some(s => m.x >= s.x && m.x <= s.x + s.w && m.y >= s.y && m.y <= s.y + s.h);
    const hitEnemy = scr.enemies.some(e => e.alive && m.x >= e.x && m.x <= e.x + e.w && m.y >= e.y && m.y <= e.y + e.h);

    if (outOfWorld || hitSolid || hitEnemy) {
      game.shakeTimer = 0.22;
      spawnParticles(m.x, m.y, "#ef4444", 18, 230);
      SFX.beep(110, 0.26, "sawtooth", 0.14, 42);
      for (const e of scr.enemies) {
        if (!e.alive) continue;
        const dist = Math.hypot(e.x + e.w / 2 - m.x, e.y + e.h / 2 - m.y);
        if (dist <= m.splashRadius + e.w * 0.5) {
          damageEnemy(e, m.damage, m.x, m.y);
        }
      }
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
  enemy.aggroTimer = 6.5;
  enemy.facing = heroCenterX < enemyCenterX ? -1 : 1;

  if (enemy.aiState === "PATROL") {
    enemy.aiState = "CHASE";
  }
}

function hasGiantLineOfSight(scr, g) {
  const gx = g.x + g.w * 0.5;
  const hx = hero.x + hero.w * 0.5;
  const dx = hx - gx;
  const absDx = Math.abs(dx);

  // Must be on roughly the same floor elevation
  const dy = Math.abs((hero.y + hero.h) - (g.y + g.h));
  if (dy > (g.isBoss ? 140 : 95)) return false;

  // Detect player in front within visionRange, or very close behind (footsteps)
  const inFront = (dx * g.facing >= 0) && (absDx <= (g.visionRange || 330));
  const closeBehind = absDx <= 64;
  if (!inFront && !closeBehind) return false;

  // Check if a solid wall blocks line of sight between giant's eye level and hero's chest
  const eyeY = g.y + g.h * 0.28;
  const minRayX = Math.min(gx, hx);
  const maxRayX = Math.max(gx, hx);
  for (const s of scr.solids) {
    if (s.y <= eyeY && s.y + s.h >= eyeY) {
      if (s.x + s.w > minRayX && s.x < maxRayX) {
        return false;
      }
    }
  }
  return true;
}

function damageEnemy(enemy, dmg, hitX, hitY) {
  enemy.hp -= dmg;
  enemy.hurtTimer = 0.14;
  spawnParticles(hitX, hitY, "#dc2626", 6, 120);
  SFX.beep(190, 0.07, "square", 0.07, 110);

  // Shooting or hitting the giant immediately activates him to hunt the player
  if (enemy.kind === "giant" && enemy.hp > 0) {
    alertGiantAxeman(enemy);
  }

  if (enemy.hp <= 0) {
    enemy.alive = false;
    game.score += enemy.scoreValue || (enemy.kind === "giant" ? 800 : 250);
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
  const atkMult = getCompoundAttackMultiplier(game.transitions);

  for (const e of scr.enemies) {
    if (!e.alive) continue;
    if (e.hurtTimer > 0) e.hurtTimer = Math.max(0, e.hurtTimer - DT);

    if (e.kind === "blade") {
      e.animTimer += DT;
      e.x += e.vx * DT;
      if (e.x <= e.minX) { e.x = e.minX; e.vx = Math.abs(e.vx); e.facing = 1; }
      if (e.x + e.w >= e.maxX) { e.x = e.maxX - e.w; e.vx = -Math.abs(e.vx); e.facing = -1; }

      const dist = Math.abs((hero.x + hero.w / 2) - (e.x + e.w / 2));
      const sameFloor = Math.abs((hero.y + hero.h) - (e.y + e.h)) < 60;
      if (dist < 68 && sameFloor) {
        e.facing = hero.x < e.x ? -1 : 1;
        e.slashTimer = 0.22;
      } else if (e.slashTimer > 0) {
        e.slashTimer = Math.max(0, e.slashTimer - DT);
      }

      if (rectsOverlap(hero, e)) {
        damageHero(e.atk || Math.round(16 * atkMult), hero.x < e.x ? -1 : 1);
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
      const sameFloor = Math.abs((hero.y + hero.h) - (e.y + e.h)) < (e.isBoss ? 140 : 95);
      const canSeeHero = hasGiantLineOfSight(scr, e);

      // Vision trigger activates pursuit
      if (canSeeHero) {
        alertGiantAxeman(e);
      } else if (e.alerted && !e.isBoss) {
        e.aggroTimer -= DT;
        if (e.aggroTimer <= 0 && distToHero > 460) {
          e.alerted = false;
          e.aiState = "PATROL";
        }
      }

      const meleeReach = e.isBoss ? 132 : 98;
      const chargeMinRange = e.isBoss ? 145 : 115;
      const chargeMaxRange = e.isBoss ? 460 : 340;

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

        // 1. Close range -> Standing Axe Swing
        if (distToHero <= meleeReach && sameFloor) {
          e.aiState = "STAND_WINDUP";
          e.aiTimer = 0.36;
        }
        // 2. Mid-to-long range on same floor -> Charging Running Axe Swing
        else if (
          e.chargeCooldown <= 0 &&
          sameFloor &&
          distToHero >= chargeMinRange &&
          distToHero <= chargeMaxRange
        ) {
          e.aiState = "CHARGE_WINDUP";
          e.aiTimer = 0.44;
          e.chargeDir = e.facing;
          SFX.beep(125, 0.18, "sawtooth", 0.09, 85);
        }
        // 3. Otherwise advance toward player within patrol bounds
        else {
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
            damageHero(e.cleaveAtk || Math.round(28 * atkMult), e.facing);
          }
        }
        if (e.aiTimer <= 0) {
          e.aiState = "RECOVER";
          e.aiTimer = 0.45;
        }
      } else if (e.aiState === "CHARGE_WINDUP") {
        e.aiTimer -= DT;
        e.weaponAngle = -1.55;
        if (e.aiTimer <= 0) {
          e.aiState = "CHARGE_RUN";
          e.aiTimer = 0.72;
          e.chargeDistTraveled = 0;
          e.struckThisSwing = false;
          e.chargeCooldown = 3.2;
          SFX.beep(155, 0.22, "sawtooth", 0.1, 65);
        }
      } else if (e.aiState === "CHARGE_RUN") {
        e.aiTimer -= DT;
        e.animTimer += DT * 2.6;
        const dir = e.chargeDir || e.facing;
        e.facing = dir;

        // Continuously swing axe while charging forward
        e.weaponAngle = Math.sin(e.animTimer * 22) * 1.35;

        const moveStep = dir * (e.chargeSpeed || 245) * DT;
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
            damageHero(e.chargeAtk || Math.round(32 * atkMult), dir);
          }
        }

        const hitBoundary = actualMoved < Math.abs(moveStep) * 0.25;
        if (e.aiTimer <= 0 || e.chargeDistTraveled >= (e.chargeMaxDist || 230) || hitBoundary) {
          e.aiState = "RECOVER";
          e.aiTimer = 0.62;
        }
      } else if (e.aiState === "RECOVER") {
        e.aiTimer -= DT;
        e.weaponAngle = 0.85;
        if (e.aiTimer <= 0) {
          e.aiState = e.alerted ? "CHASE" : "PATROL";
        }
      }

      if (rectsOverlap(hero, e)) {
        damageHero(e.atk || Math.round(18 * atkMult), hero.x < e.x ? -1 : 1);
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
}
