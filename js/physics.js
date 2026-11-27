// js/physics.js //
"use strict";

// Machine Gun & Bullet Pace Tuning
const GUN_BURST_COUNT = 6;           // Rounds per burst
const GUN_SHOT_INTERVAL = 0.095;     // Seconds between shots inside a burst
const GUN_RELOAD_TIME = 0.68;        // Seconds pause between bursts
const BULLET_SPEED_MULT = 0.56;      // -30% bullet speed compared to previous 0.80
const BULLET_DROP_DIST_MULT = 0.42;  // Starts falling on ground much earlier

// Normal Player Sight Range (used even when hero.traits.blind is active)
const NORMAL_PLAYER_VISION_RANGE = 275;

// Enemy Post-Hit Idle Pause Tuning
const BLADE_POST_HIT_IDLE_SEC = 4.0;
const KNIFER_POST_HIT_IDLE_SEC = 4.0;
const GIANT_POST_HIT_IDLE_SEC = 2.0;

// Super Cannon (頂帽大炮) Tuning
const CANNON_ROUNDS_PER_ROOM = 2;                        // Limited to 2 rounds per room
const CANNON_DAMAGE = 200;                               // 200 AoE damage
const CANNON_FUSE_SEC = 1.0;                             // Explodes 1.0 sec after shot
const CANNON_AOE_RADIUS = 115;                           // Area of effect radius
const CANNON_SPIN_RAD_PER_SEC = (3 * Math.PI * 2) / 0.8; // 3 full rotations per 0.8 sec

// Start-Screen Alien Tuning
const ALIEN_SAFE_START_SEC = 10.0;    // Holds fire for the first 10 seconds of gameplay
const ALIEN_SIGHT_RANGE = 220;        // Fits inside the 2x zoomed camera (240px half-view)
const ALIEN_CANNON_SPEED_MULT = 0.70; // -30% cannon projectile speed

const TREASURE_RELIC_DEFS = [
  { variant: 0, label: "GOLD COIN CHEST",     score: 1500, w: 50, h: 38 },
  { variant: 1, label: "ROYAL JEWEL BOX",     score: 2000, w: 46, h: 38 },
  { variant: 2, label: "CRYSTAL RELIC CHEST", score: 2500, w: 48, h: 38 }
];

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
  _cannonRoomRef: null,
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
  hasMissileHat: false, hatAmmo: 0, hatMaxAmmo: CANNON_ROUNDS_PER_ROOM,
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

function scatterTreasureRoomItems(scr) {
  if (!scr || scr._treasureScattered) return;
  const isTreasureVault = game.roomType === "TREASURE" || Boolean(scr.isFinal || scr.exit?.label === "VAULT");
  if (!isTreasureVault) return;

  scr._treasureScattered = true;
  scr.pickups = (scr.pickups || []).filter(p => p.type !== "treasure");

  const spots = [];
  const addSurfaceSpots = (surfaces) => {
    for (const s of (surfaces || [])) {
      if (s.w < 68 || s.y < 110 || s.y > game.worldH - 16) continue;
      const margin = 28;
      const step = 64;
      for (let cx = s.x + margin; cx <= s.x + s.w - margin; cx += step) {
        const nearStart = cx < 175 && Math.abs(s.y - (game.worldH - 34)) < 50;
        const nearExit = scr.exit &&
          cx >= scr.exit.x - 36 &&
          cx <= scr.exit.x + scr.exit.w + 36 &&
          Math.abs(s.y - (scr.exit.y + scr.exit.h)) < 64;
        if (!nearStart && !nearExit) {
          spots.push({ x: cx, surfaceY: s.y });
        }
      }
    }
  };

  addSurfaceSpots(scr.solids);
  addSurfaceSpots(scr.oneWay);

  if (spots.length < 3) {
    const floorY = game.worldH - 34;
    [240, 420, 600].forEach(fx => spots.push({ x: fx, surfaceY: floorY }));
  }

  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }

  const chosen = [];
  for (const spot of spots) {
    if (chosen.every(c => Math.hypot(c.x - spot.x, c.surfaceY - spot.surfaceY) >= 56)) {
      chosen.push(spot);
      if (chosen.length === 3) break;
    }
  }
  while (chosen.length < 3) {
    chosen.push(spots[chosen.length % spots.length]);
  }

  TREASURE_RELIC_DEFS.forEach((def, idx) => {
    const spot = chosen[idx];
    scr.pickups.push({
      type: "treasure",
      treasureVariant: def.variant,
      label: def.label,
      scoreValue: def.score,
      x: Math.round(spot.x - def.w * 0.5),
      y: Math.round(spot.surfaceY - def.h),
      w: def.w,
      h: def.h,
      collected: false
    });
  });
}

function damageHero(amount, knockDir) {
  if (hero.invulnTimer > 0 || game.state !== "PLAY") return false;
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
  return true;
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

// Monsters remain passive until the player sees them on screen within normal vision range (even for Blind hunters)
function hasPlayerSeenEnemy(e) {
  if (!e || !e.alive) return false;
  if (e.seenByPlayer) return true;
  if (game.state !== "PLAY") return false;

  const zoom = getActiveCamZoom();
  const viewLeft = game.camX;
  const viewRight = game.camX + W / zoom;
  const viewTop = game.camY;
  const viewBottom = game.camY + H / zoom;

  const onScreen =
    (e.x + e.w) > viewLeft &&
    e.x < viewRight &&
    (e.y + e.h) > viewTop &&
    e.y < viewBottom;

  if (!onScreen) return false;

  const heroCx = hero.x + hero.w * 0.5;
  const heroCy = hero.y + hero.h * 0.5;
  const enemyCx = e.x + e.w * 0.5;
  const enemyCy = e.y + e.h * 0.5;
  const dist = Math.hypot(enemyCx - heroCx, enemyCy - heroCy);

  if (dist <= NORMAL_PLAYER_VISION_RANGE) {
    e.seenByPlayer = true;
    return true;
  }

  return false;
}

function canDropThroughOneWay(scr) {
  if (!hero.grounded || hero.onLadder) return false;
  const footY = hero.y + hero.h;
  const onSolid = scr.solids.some(s =>
    hero.x + hero.w > s.x &&
    hero.x < s.x + s.w &&
    Math.abs(footY - s.y) <= 4
  );
  if (onSolid) return false;
  return scr.oneWay.some(p =>
    hero.x + hero.w > p.x &&
    hero.x < p.x + p.w &&
    Math.abs(footY - p.y) <= 6
  );
}

function stepHero(input, scr) {
  const GRAVITY = 1380;
  const WALK_SPEED = hero.stats.walkSpeed;
  const CLIMB_SPEED = hero.stats.climbSpeed;
  const JUMP_VEL = hero.stats.jumpVel;

  // Refill Super Cannon ammo to 2 rounds whenever entering a new room & scatter vault loot if in Treasure Room
  if (game._cannonRoomRef !== scr) {
    game._cannonRoomRef = scr;
    hero.hatMaxAmmo = CANNON_ROUNDS_PER_ROOM;
    hero.hatAmmo = hero.hasMissileHat ? CANNON_ROUNDS_PER_ROOM : 0;
    scatterTreasureRoomItems(scr);
  }

  if (hero.invulnTimer > 0) hero.invulnTimer = Math.max(0, hero.invulnTimer - DT);
  if (hero.gunCooldown > 0) hero.gunCooldown = Math.max(0, hero.gunCooldown - DT);
  if (hero.gunReloadTimer > 0) hero.gunReloadTimer = Math.max(0, hero.gunReloadTimer - DT);
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

  const onOneWayOnly = canDropThroughOneWay(scr);
  if (input.sHeld && onOneWayOnly) {
    hero.downHoldTimer += DT;
  } else {
    hero.downHoldTimer = 0;
  }

  if (((input.jumpPressed && input.sHeld) || hero.downHoldTimer >= 0.14) && onOneWayOnly) {
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

  if (hero.y > game.worldH + 40 && game.state === "PLAY") {
    hero.hp = 0;
    game.state = "GAMEOVER";
    SFX.beep(110, 0.35, "sawtooth", 0.15, 45);
    SFX.syncBgm();
    return;
  }

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
    const muzzle = typeof getHeroGunMuzzlePos === "function"
      ? getHeroGunMuzzlePos()
      : { x: shoulderX + dirX * 18, y: shoulderY + dirY * 18 };

    hero.gunCooldown = GUN_SHOT_INTERVAL;
    hero.gunBurstRemaining--;
    if (hero.gunBurstRemaining === 0) {
      hero.gunReloadTimer = GUN_RELOAD_TIME;
    }

    SFX.beep(640, 0.036, "triangle", 0.06, 240);

    const barrelHit = findSurfaceHit(scr, shoulderX, shoulderY, muzzle.x, muzzle.y);
    if (barrelHit) {
      spawnParticles(barrelHit.x, barrelHit.y, "#5c4033", 4, 80);
    } else {
      const bulletSpeed = hero.stats.bulletSpeed * BULLET_SPEED_MULT;
      game.bullets.push({
        x: muzzle.x,
        y: muzzle.y,
        vx: dirX * bulletSpeed,
        vy: dirY * bulletSpeed,
        traveled: 0,
        dropStartDist: HALF_W * hero.stats.bulletDropRatio * BULLET_DROP_DIST_MULT,
        damage: 10
      });
    }
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

  // Super Cannon (頂帽大炮): Limited to 2 rounds per room, bouncing/rolling physics ball, explodes after 1.0s for 200 AoE damage
  if (input.hatPressed && hero.hasMissileHat && hero.hatAmmo > 0) {
    const dirX = Math.cos(hero.aimAngle);
    const dirY = Math.sin(hero.aimAngle);
    hero.hatAmmo--;
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
      splashRadius: CANNON_AOE_RADIUS,
      fromEnemy: false
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

  if (m.fromEnemy) {
    const closestX = Math.max(hero.x, Math.min(m.x, hero.x + hero.w));
    const closestY = Math.max(hero.y, Math.min(m.y, hero.y + hero.h));
    const distToHero = Math.hypot(m.x - closestX, m.y - closestY);
    if (distToHero <= m.splashRadius && game.state === "PLAY") {
      hero.invulnTimer = 0;
      hero.hp = 0;
      spawnParticles(hero.x + hero.w / 2, hero.y + hero.h / 2, "#dc2626", 24, 240);
      SFX.beep(110, 0.35, "sawtooth", 0.15, 45);
      game.state = "GAMEOVER";
      SFX.syncBgm();
    }
    return;
  }

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

function segmentHitsBox(x1, y1, x2, y2, box) {
  const minX = box.x, maxX = box.x + box.w;
  const minY = box.y, maxY = box.y + box.h;
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;

  const checks = [
    [-dx, x1 - minX],
    [dx,  maxX - x1],
    [-dy, y1 - minY],
    [dy,  maxY - y1]
  ];

  for (let i = 0; i < 4; i++) {
    const p = checks[i][0];
    const q = checks[i][1];
    if (p === 0) {
      if (q < 0) return null;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }

  return { x: x1 + dx * t0, y: y1 + dy * t0, t: t0 };
}

// Swept check against solid horizontal floors and walls only (bullets pass through ladders and red one-way platforms)
function findSurfaceHit(scr, x1, y1, x2, y2) {
  if (!scr || !scr.solids) return null;
  let best = null;
  for (const s of scr.solids) {
    const hit = segmentHitsBox(x1, y1, x2, y2, s);
    if (hit && (!best || hit.t < best.t)) {
      best = hit;
    }
  }
  return best;
}

function stepProjectilesAndPickups(scr) {
  scatterTreasureRoomItems(scr);

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
        hero.hatMaxAmmo = CANNON_ROUNDS_PER_ROOM;
        hero.hatAmmo = CANNON_ROUNDS_PER_ROOM;
        game.score += 500;
        spawnParticles(p.x + p.w / 2, p.y + p.h / 2, "#f5c518", 14, 160);
        SFX.beep(440, 0.25, "square", 0.1, 990);
      } else if (p.type === "crown") {
        game.score += 250;
        spawnParticles(p.x + p.w / 2, p.y + p.h / 2, "#dc2626", 10, 140);
        SFX.beep(660, 0.14, "sine", 0.1, 1040);
      } else if (p.type === "treasure") {
        const pts = p.scoreValue || 1500;
        game.score += pts;
        const burstColor = p.treasureVariant === 2 ? "#38bdf8" : (p.treasureVariant === 1 ? "#f43f5e" : "#ffd700");
        spawnParticles(p.x + p.w / 2, p.y + p.h / 2, burstColor, 22, 210);
        spawnParticles(p.x + p.w / 2, p.y + p.h / 2, "#facc15", 14, 170);
        SFX.beep(523 + (p.treasureVariant || 0) * 130, 0.25, "square", 0.12, 1046);
      }
    }
  }

  for (let i = game.bullets.length - 1; i >= 0; i--) {
    const b = game.bullets[i];
    if (b.traveled >= b.dropStartDist) b.vy += 2200 * DT;
    else b.vy += 260 * DT;

    const prevX = b.x;
    const prevY = b.y;
    const stepX = b.vx * DT;
    const stepY = b.vy * DT;
    b.x += stepX;
    b.y += stepY;
    b.traveled += Math.hypot(stepX, stepY);

    const hitSurface = findSurfaceHit(scr, prevX, prevY, b.x, b.y);
    if (hitSurface || b.y > game.worldH || b.x < 0 || b.x > game.worldW) {
      const fx = hitSurface ? hitSurface.x : b.x;
      const fy = hitSurface ? hitSurface.y : b.y;
      spawnParticles(fx, fy, "#5c4033", 4, 80);
      game.bullets.splice(i, 1);
      continue;
    }

    let hitEnemy = false;
    for (const e of scr.enemies) {
      if (!e.alive) continue;
      if (segmentHitsBox(prevX, prevY, b.x, b.y, e)) {
        damageEnemy(e, b.damage, b.x, b.y);
        if (typeof spawnBulletHitSparks === "function") {
          spawnBulletHitSparks(b.x, b.y);
        }
        hitEnemy = true;
        break;
      }
    }
    if (hitEnemy) game.bullets.splice(i, 1);
  }

  for (let i = game.bones.length - 1; i >= 0; i--) {
    const bone = game.bones[i];
    const prevX = bone.x;
    const prevY = bone.y;
    bone.vy += 760 * DT;
    bone.x += bone.vx * DT;
    bone.y += bone.vy * DT;
    bone.rot += 15 * DT;

    const hitSurface = findSurfaceHit(scr, prevX, prevY, bone.x, bone.y);
    if (hitSurface || bone.y > game.worldH || bone.x < -40 || bone.x > game.worldW + 40) {
      const fx = hitSurface ? hitSurface.x : bone.x;
      const fy = hitSurface ? hitSurface.y : bone.y;
      spawnParticles(fx, fy, "#f8fafc", 8, 130);
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

  for (let i = game.missiles.length - 1; i >= 0; i--) {
    const m = game.missiles[i];
    const r = m.r || 11;
    m.timer += DT;
    m.rot += m.spinDir * CANNON_SPIN_RAD_PER_SEC * DT;

    if (Math.random() < 0.65) {
      spawnParticles(m.x, m.y - r * 0.6, "#fb923c", 1, 55);
    }

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

    if (m.fromEnemy) {
      if (m.x + r > hero.x && m.x - r < hero.x + hero.w && m.y + r > hero.y && m.y - r < hero.y + hero.h) {
        const bounceDir = (m.x < hero.x + hero.w * 0.5) ? -1 : 1;
        m.vx = bounceDir * Math.max(120, Math.abs(m.vx) * 0.55);
        m.vy = Math.min(m.vy, -140);
        m.spinDir = bounceDir;
      }
    } else {
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
  enemy.seenByPlayer = true; // Taking damage alerts the enemy even from off-screen
  spawnParticles(hitX, hitY, "#dc2626", 6, 120);
  SFX.beep(190, 0.07, "square", 0.07, 110);

  if (enemy.hp > 0) {
    if (enemy.kind === "giant") {
      alertGiantAxeman(enemy);
    } else if (enemy.kind === "blade" || enemy.kind === "knifer") {
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

    // Gate all active/attacking AI until the player sees the monster on screen within normal vision range
    const playerSawEnemy = hasPlayerSeenEnemy(e);

    if (e.kind === "alien") {
      if (game.state === "PLAY" && playerSawEnemy) {
        e.activeTimer = (e.activeTimer || 0) + DT;
      }
      const ex = e.x + e.w * 0.5;
      const hx = hero.x + hero.w * 0.5;
      const dx = hx - ex;
      const dy = Math.abs((hero.y + hero.h) - (e.y + e.h));
      if (playerSawEnemy) e.facing = dx < 0 ? -1 : 1;
      snapEnemyToGround(scr, e);

      if (playerSawEnemy && !e.hasFiredCannon && game.state === "PLAY" && e.activeTimer >= ALIEN_SAFE_START_SEC) {
        const inSight = Math.abs(dx) <= ALIEN_SIGHT_RANGE && dy <= 110;
        const shouldEngage = inSight || e.hp < e.maxHp;
        if (shouldEngage && !e.cannonWindingUp) {
          e.cannonWindingUp = true;
          e.cannonWindupTimer = 0.55;
          SFX.beep(300, 0.14, "square", 0.08, 460);
        }

        if (e.cannonWindingUp) {
          e.cannonWindupTimer -= DT;
          if (e.cannonWindupTimer <= 0) {
            e.cannonWindingUp = false;
            e.hasFiredCannon = true;

            const launchX = ex + e.facing * 10;
            const launchY = e.y + 8;
            const maxVx = 440 * ALIEN_CANNON_SPEED_MULT;
            const targetVx = Math.max(-maxVx, Math.min(maxVx, (hx - launchX) * 1.12 * ALIEN_CANNON_SPEED_MULT));

            game.missiles.push({
              x: launchX,
              y: launchY,
              r: 11,
              vx: targetVx,
              vy: -210 * ALIEN_CANNON_SPEED_MULT,
              rot: 0,
              spinDir: e.facing,
              timer: 0,
              fuse: CANNON_FUSE_SEC,
              damage: CANNON_DAMAGE,
              splashRadius: CANNON_AOE_RADIUS,
              fromEnemy: true
            });
            spawnParticles(launchX, launchY, "#ef4444", 12, 150);
            SFX.beep(175, 0.26, "sawtooth", 0.13, 75);
          }
        }
      }
      continue;
    }

    if (e.kind === "blade") {
      if (e.slashCooldown > 0) e.slashCooldown = Math.max(0, e.slashCooldown - DT);
      if (e.slashTimer > 0) e.slashTimer = Math.max(0, e.slashTimer - DT);

      if (e.postHitIdleTimer > 0) {
        e.postHitIdleTimer = Math.max(0, e.postHitIdleTimer - DT);
        e.alerted = false;
        e.aggroTimer = 0;
        snapEnemyToGround(scr, e);
        continue;
      }

      if (!playerSawEnemy) {
        e.alerted = false;
        e.aggroTimer = 0;
        e.animTimer += DT;
        e.x += e.vx * DT;
        if (e.x <= e.minX) { e.x = e.minX; e.vx = Math.abs(e.vx); e.facing = 1; }
        if (e.x + e.w >= e.maxX) { e.x = e.maxX - e.w; e.vx = -Math.abs(e.vx); e.facing = -1; }
        snapEnemyToGround(scr, e);
        continue;
      }

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
          if (damageHero(e.atk || Math.round(15 * atkMult), e.facing)) {
            e.postHitIdleTimer = BLADE_POST_HIT_IDLE_SEC;
            e.alerted = false;
            e.aggroTimer = 0;
          }
        }
      }
      continue;
    }

    if (e.kind === "knifer") {
      if (e.aggroTimer > 0) e.aggroTimer = Math.max(0, e.aggroTimer - DT);
      if (e.dashCooldown > 0) e.dashCooldown = Math.max(0, e.dashCooldown - DT);

      if (e.postHitIdleTimer > 0) {
        e.postHitIdleTimer = Math.max(0, e.postHitIdleTimer - DT);
        e.alerted = false;
        e.aggroTimer = 0;
        e.aiState = "IDLE";
        snapEnemyToGround(scr, e);
        if (e.postHitIdleTimer === 0) {
          e.aiState = "PATROL";
        }
        continue;
      }

      if (!playerSawEnemy) {
        e.alerted = false;
        e.aggroTimer = 0;
        e.aiState = "PATROL";
        e.animTimer += DT * 0.65;
        e.x += e.vx * DT;
        if (e.x <= e.minX) {
          e.x = e.minX;
          e.vx = Math.abs(e.vx);
        } else if (e.x + e.w >= e.maxX) {
          e.x = e.maxX - e.w;
          e.vx = -Math.abs(e.vx);
        }
        e.facing = e.vx < 0 ? -1 : 1;
        snapEnemyToGround(scr, e);
        continue;
      }

      const eCenterX = e.x + e.w * 0.5;
      const hCenterX = hero.x + hero.w * 0.5;
      const dx = hCenterX - eCenterX;
      const sameFloor = Math.abs((hero.y + hero.h) - (e.y + e.h)) < 46;

      if (sameFloor && Math.abs(dx) < (e.visionRange || 340)) {
        e.alerted = true;
        e.aggroTimer = 3.5;
      } else if (e.aggroTimer <= 0 && e.aiState !== "DASH_WINDUP" && e.aiState !== "DASH_STAB") {
        e.alerted = false;
        e.aiState = "PATROL";
      }

      if (e.aiState === "DASH_WINDUP") {
        e.aiTimer -= DT;
        e.facing = e.dashDir || (dx < 0 ? -1 : 1);
        if (e.aiTimer <= 0) {
          e.aiState = "DASH_STAB";
          e.aiTimer = e.dashDuration || 0.22;
          e.struckThisDash = false;
          SFX.beep(540, 0.08, "sawtooth", 0.06, 260);
        }
      } else if (e.aiState === "DASH_STAB") {
        e.aiTimer -= DT;
        e.animTimer += DT * 2.4;
        const dir = e.dashDir || e.facing || 1;
        const dashSpd = e.dashSpeed || 265;
        e.x = Math.max(e.minX, Math.min(e.maxX - e.w, e.x + dir * dashSpd * DT));

        const knifeBox = {
          x: dir === 1 ? e.x + e.w - 4 : e.x - 18,
          y: e.y + e.h * 0.28,
          w: 22,
          h: e.h * 0.48
        };

        if (sameFloor && !e.struckThisDash && (rectsOverlap(hero, knifeBox) || rectsOverlap(hero, e))) {
          e.struckThisDash = true;
          SFX.beep(240, 0.09, "sawtooth", 0.08, 120);
          if (damageHero(e.atk || Math.round(13 * atkMult), dir)) {
            e.postHitIdleTimer = KNIFER_POST_HIT_IDLE_SEC;
            e.aiState = "IDLE";
            e.alerted = false;
            e.aggroTimer = 0;
            snapEnemyToGround(scr, e);
            continue;
          }
        }

        if (e.aiTimer <= 0) {
          e.aiState = "STALK";
          e.dashCooldown = e.dashCooldownTime || 1.35;
        }
      } else if (e.alerted && sameFloor) {
        e.aiState = "STALK";
        e.animTimer += DT * 0.85;
        const dir = dx < 0 ? -1 : 1;
        e.facing = dir;

        if (e.dashCooldown <= 0 && Math.abs(dx) <= 118) {
          e.aiState = "DASH_WINDUP";
          e.aiTimer = e.dashWindup || 0.26;
          e.dashDir = dir;
        } else if (Math.abs(dx) > 42) {
          const stalkSpeed = e.chaseSpeed || 56;
          e.x = Math.max(e.minX, Math.min(e.maxX - e.w, e.x + dir * stalkSpeed * DT));
        }
      } else {
        e.aiState = "PATROL";
        e.animTimer += DT * 0.65;
        e.x += e.vx * DT;
        if (e.x <= e.minX) {
          e.x = e.minX;
          e.vx = Math.abs(e.vx);
        } else if (e.x + e.w >= e.maxX) {
          e.x = e.maxX - e.w;
          e.vx = -Math.abs(e.vx);
        }
        e.facing = e.vx < 0 ? -1 : 1;
      }

      snapEnemyToGround(scr, e);
      continue;
    }

    if (e.kind === "giant") {
      if (e.alertTimer > 0) e.alertTimer = Math.max(0, e.alertTimer - DT);
      if (e.chargeCooldown > 0) e.chargeCooldown = Math.max(0, e.chargeCooldown - DT);

      if (e.postHitIdleTimer > 0) {
        e.postHitIdleTimer = Math.max(0, e.postHitIdleTimer - DT);
        e.alerted = false;
        e.aggroTimer = 0;
        e.aiState = "IDLE";
        e.weaponAngle = -0.25;
        snapEnemyToGround(scr, e);
        if (e.postHitIdleTimer === 0) {
          e.aiState = "PATROL";
        }
        continue;
      }

      if (!playerSawEnemy) {
        e.alerted = false;
        e.aggroTimer = 0;
        e.aiState = "PATROL";
        e.animTimer += DT;
        e.x += e.vx * DT;
        e.weaponAngle = -0.35 + Math.sin(Math.floor(e.animTimer * 8)) * 0.12;
        if (e.x <= e.minX) { e.x = e.minX; e.vx = Math.abs(e.vx); e.facing = 1; }
        if (e.x + e.w >= e.maxX) { e.x = e.maxX - e.w; e.vx = -Math.abs(e.vx); e.facing = -1; }
        snapEnemyToGround(scr, e);
        continue;
      }

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
            if (damageHero(e.cleaveAtk || Math.round(24 * atkMult), e.facing)) {
              e.postHitIdleTimer = GIANT_POST_HIT_IDLE_SEC;
              e.aiState = "IDLE";
              e.alerted = false;
              e.aggroTimer = 0;
              e.weaponAngle = -0.25;
              snapEnemyToGround(scr, e);
              continue;
            }
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
            if (damageHero(e.chargeAtk || Math.round(24 * atkMult), dir)) {
              e.postHitIdleTimer = GIANT_POST_HIT_IDLE_SEC;
              e.aiState = "IDLE";
              e.alerted = false;
              e.aggroTimer = 0;
              e.weaponAngle = -0.25;
              snapEnemyToGround(scr, e);
              continue;
            }
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
        if (damageHero(e.atk || Math.round(24 * atkMult), hero.x < e.x ? -1 : 1)) {
          e.postHitIdleTimer = GIANT_POST_HIT_IDLE_SEC;
          e.aiState = "IDLE";
          e.alerted = false;
          e.aggroTimer = 0;
          e.weaponAngle = -0.25;
        }
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
