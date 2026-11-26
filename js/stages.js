// js/stages.js //
"use strict";

const MAX_FLOORS = 100;

// Deterministic 32-bit hash for Stage 001 Floors 1..100
function getFloorSeed(floorNum) {
  let h = (Math.floor(floorNum) * 0x9e3779b9) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) || 1;
}

// Stage-isolated seed so Stage 001 keeps exact seeds and Stage 002+ get independent deterministic streams
function getStageFloorSeed(stageId, floorNum) {
  const baseSeed = getFloorSeed(floorNum);
  const idStr = String(stageId || "001");
  if (idStr === "001") return baseSeed;

  let stageHash = 0x811c9dc5;
  for (let i = 0; i < idStr.length; i++) {
    stageHash ^= idStr.charCodeAt(i);
    stageHash = Math.imul(stageHash, 0x01000193) >>> 0;
  }
  return ((baseSeed ^ stageHash) >>> 0) || 1;
}

// Isolated Mulberry32 PRNG (never touches Math.random or cross-floor state)
function createFloorRng(floorNum, stageId = "001") {
  const seed = getStageFloorSeed(stageId, floorNum);
  let state = seed;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    seed,
    next,
    range(min, max) {
      return min + next() * (max - min);
    },
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    }
  };
}

function getCompoundAttackMultiplier(transitions) {
  const depth = Math.max(0, Math.min(MAX_FLOORS, transitions || 0));
  return Math.pow(1.035, depth);
}

// ============================================================================
// STAGE 001 ("RUIN CAVE") — 100-Floor Deterministic Cave Generator
// ============================================================================
function generateStage001Floor(floorNum) {
  const floor = Math.max(1, Math.min(MAX_FLOORS, Math.floor(floorNum)));
  const rng = createFloorRng(floor, "001");

  // Deterministic brick background template selection for Stage 001
  let bgTemplate = "bg001";
  if (floor % 5 === 0 || (floor >= 8 && rng.next() < 0.34)) {
    bgTemplate = "bg003"; // Glowing rune wall on milestone & deep floors
  } else if (rng.next() < 0.48) {
    bgTemplate = "bg002"; // Cobweb & vine brick wall
  }

  const wallT = 24;
  const ceilH = 54;
  const floorH = 34;
  const floorY = H - floorH; // 548
  const innerLeft = wallT;
  const innerRight = W - wallT;
  const innerW = innerRight - innerLeft; // 912

  const solids = [
    { x: 0, y: 0, w: wallT, h: H, hatched: true },         // Left wall
    { x: W - wallT, y: 0, w: wallT, h: H, hatched: true }, // Right wall
    { x: 0, y: 0, w: W, h: ceilH, hatched: true },         // Ceiling
    { x: 0, y: floorY, w: W, h: floorH, hatched: true }    // Ground floor
  ];
  const oneWay = [];
  const ladders = [];
  const enemies = [];
  const pickups = [];

  // Choose 2 or 3 elevated cave tiers deterministically for this floor
  const tierYs = rng.next() < 0.55 ? [418, 288, 164] : [406, 256];
  const allLevels = [floorY, ...tierYs];

  // Plan guaranteed ladder X positions connecting each tier to the tier above
  const ladderW = 36;
  const hatchW = 48;
  const tierLadders = [];
  let prevLadderX = rng.int(innerLeft + 150, innerRight - 150 - ladderW);

  for (let t = 0; t < tierYs.length; t++) {
    const lowerY = allLevels[t];
    const upperY = allLevels[t + 1];

    let lx = rng.int(innerLeft + 70, innerRight - 70 - ladderW);
    for (let tries = 0; tries < 12; tries++) {
      const candidate = rng.int(innerLeft + 70, innerRight - 70 - ladderW);
      if (Math.abs(candidate - prevLadderX) >= 150) {
        lx = candidate;
        break;
      }
    }
    prevLadderX = lx;

    const rungList = [{ x: lx, lowerY, upperY }];

    if (rng.next() < 0.42) {
      const altX = lx < HALF_W
        ? rng.int(HALF_W + 80, innerRight - 80 - ladderW)
        : rng.int(innerLeft + 80, HALF_W - 80 - ladderW);
      if (Math.abs(altX - lx) >= 160) {
        rungList.push({ x: altX, lowerY, upperY });
      }
    }

    tierLadders.push(rungList);
    for (const r of rungList) {
      ladders.push({
        x: r.x,
        y: r.upperY - 12,
        w: ladderW,
        h: (r.lowerY - r.upperY) + 12
      });
    }
  }

  // Build horizontal platforms on each elevated tier, cutting red oneWay hatches at ladder tops
  const walkableLedges = [
    { x: innerLeft, y: floorY, w: innerW, tier: 0 }
  ];

  for (let t = 0; t < tierYs.length; t++) {
    const y = tierYs[t];
    const platH = 18;
    const enteringLadders = tierLadders[t].map(r => r.x + ladderW * 0.5).sort((a, b) => a - b);
    const exitingLadders = (t + 1 < tierLadders.length)
      ? tierLadders[t + 1].map(r => r.x + ladderW * 0.5)
      : [];

    const anchors = [...enteringLadders, ...exitingLadders];
    const minSpan = Math.max(220, Math.min(...anchors) - 90);
    const maxSpan = Math.min(innerRight - 24, Math.max(...anchors) + 90);

    const spans = [];
    if (maxSpan - minSpan > 560 || rng.next() < 0.45) {
      const leftStart = rng.int(innerLeft + 24, Math.max(innerLeft + 24, Math.min(minSpan, innerLeft + 130)));
      const rightEnd = rng.int(Math.min(innerRight - 24, Math.max(maxSpan, innerRight - 130)), innerRight - 24);
      spans.push([leftStart, rightEnd]);
    } else {
      const gapCenter = rng.int(HALF_W - 70, HALF_W + 70);
      const gapHalf = rng.int(34, 48);
      const s1Start = rng.int(innerLeft + 24, innerLeft + 90);
      const s1End = Math.max(s1Start + 160, gapCenter - gapHalf);
      const s2End = rng.int(innerRight - 90, innerRight - 24);
      const s2Start = Math.min(s2End - 160, gapCenter + gapHalf);
      spans.push([s1Start, s1End], [s2Start, s2End]);
    }

    for (const [sx, ex] of spans) {
      const hatchesInSpan = enteringLadders
        .map(cx => ({ hx: Math.round(cx - hatchW * 0.5), hw: hatchW }))
        .filter(h => h.hx >= sx + 12 && h.hx + h.hw <= ex - 12);

      let cursor = sx;
      for (const h of hatchesInSpan) {
        if (h.hx - cursor >= 24) {
          solids.push({ x: cursor, y, w: h.hx - cursor, h: platH, hatched: false });
        }
        oneWay.push({ x: h.hx, y, w: h.hw });
        cursor = h.hx + h.hw;
      }
      if (ex - cursor >= 24) {
        solids.push({ x: cursor, y, w: ex - cursor, h: platH, hatched: false });
      }

      walkableLedges.push({ x: sx, y, w: ex - sx, tier: t + 1 });
    }
  }

  // Place exit on the highest tier, away from the top ladder landing
  const topLedges = walkableLedges.filter(l => l.tier === tierYs.length);
  const topLedge = topLedges[topLedges.length - 1] || walkableLedges[walkableLedges.length - 1];
  const topLadderCenter = tierLadders[tierLadders.length - 1][0].x + ladderW * 0.5;
  const exitOnRight = topLadderCenter < topLedge.x + topLedge.w * 0.5;
  const exitW = 36;
  const exitH = 54;
  const exitX = exitOnRight
    ? Math.max(topLedge.x + 12, topLedge.x + topLedge.w - exitW - 14)
    : Math.min(topLedge.x + topLedge.w - exitW - 12, topLedge.x + 14);
  const exit = {
    x: Math.round(exitX),
    y: Math.round(topLedge.y - exitH),
    w: exitW,
    h: exitH,
    dir: "right"
  };

  // Populate enemies deterministically along walkable ledges
  const diffScale = typeof setup !== "undefined"
    ? (setup.difficulty === "ULTIMATE" ? 1.45 : (setup.difficulty === "HARD" ? 1.2 : 1.0))
    : 1.0;
  const atkMult = getCompoundAttackMultiplier(floor);
  const hpScale = (1 + floor * 0.04) * diffScale;

  for (const ledge of walkableLedges) {
    const safeLeft = ledge.tier === 0 ? Math.max(ledge.x + 8, 220) : ledge.x + 8;
    const safeRight = ledge.x + ledge.w - 8;
    const usableW = safeRight - safeLeft;
    if (usableW < 120) continue;

    const enemyCount = usableW > 460 && floor >= 4 ? rng.int(1, 2) : (rng.next() < 0.78 ? 1 : 0);
    for (let i = 0; i < enemyCount; i++) {
      const slotW = usableW / enemyCount;
      const minX = Math.round(safeLeft + i * slotW);
      const maxX = Math.round(safeLeft + (i + 1) * slotW);
      const spawnGiant = floor >= 3 && rng.next() < Math.min(0.45, 0.16 + floor * 0.003);

      if (spawnGiant) {
        const gw = 54;
        const gh = 92;
        const gx = rng.int(minX + 6, Math.max(minX + 6, maxX - gw - 6));
        const maxHp = Math.round(110 * hpScale);
        enemies.push({
          kind: "giant",
          name: "AXE GIANT",
          x: gx,
          y: ledge.y - gh,
          w: gw,
          h: gh,
          vx: (rng.next() < 0.5 ? -1 : 1) * 44,
          chaseSpeed: 96,
          chargeSpeed: 122.5,
          chargeMaxDist: 260,
          minX,
          maxX,
          hp: maxHp,
          maxHp,
          atk: Math.round(24 * atkMult),
          cleaveAtk: Math.round(26 * atkMult),
          chargeAtk: Math.round(28 * atkMult),
          weaponLength: 68,
          weaponAngle: -0.35,
          visionRange: 420,
          facing: -1,
          aiState: "PATROL",
          aiTimer: 0,
          alerted: false,
          alertTimer: 0,
          aggroTimer: 0,
          chargeCooldown: 0,
          chargeDir: 1,
          chargeDistTraveled: 0,
          struckThisSwing: false,
          hurtTimer: 0,
          animTimer: 0,
          isBoss: false,
          scoreValue: 800,
          alive: true
        });
      } else {
        const bw = 34;
        const bh = 54;
        const bx = rng.int(minX + 6, Math.max(minX + 6, maxX - bw - 6));
        const maxHp = Math.round(40 * hpScale);
        enemies.push({
          kind: "blade",
          name: "BLADEMAN",
          x: bx,
          y: ledge.y - bh,
          w: bw,
          h: bh,
          vx: (rng.next() < 0.5 ? -1 : 1) * 62,
          chaseSpeed: 145,
          minX,
          maxX,
          hp: maxHp,
          maxHp,
          atk: Math.round(15 * atkMult),
          facing: -1,
          alerted: false,
          aggroTimer: 0,
          slashCooldown: 0,
          slashTimer: 0,
          hurtTimer: 0,
          animTimer: 0,
          scoreValue: 250,
          alive: true
        });
      }
    }
  }

  // Deterministic pickups
  const midLedges = walkableLedges.filter(l => l.tier > 0);
  if (midLedges.length > 0 && (floor % 2 === 0 || rng.next() < 0.45)) {
    const healLedge = rng.pick(midLedges);
    const px = rng.int(healLedge.x + 18, Math.max(healLedge.x + 18, healLedge.x + healLedge.w - 50));
    pickups.push({
      type: "chicken",
      x: px,
      y: healLedge.y - 28,
      w: 34,
      h: 28,
      collected: false
    });
  }
  if (midLedges.length > 0 && rng.next() < 0.65) {
    const crownLedge = midLedges[0];
    const cx = rng.int(crownLedge.x + 18, Math.max(crownLedge.x + 18, crownLedge.x + crownLedge.w - 44));
    pickups.push({
      type: "crown",
      x: cx,
      y: crownLedge.y - 24,
      w: 26,
      h: 24,
      collected: false
    });
  }

  return {
    id: `stage001_floor_${String(floor).padStart(3, "0")}`,
    stageId: "001",
    bgTemplate,
    floorNumber: floor,
    seed: rng.seed,
    pageLeft: floor * 2 + 1,
    pageRight: floor * 2 + 2,
    heroSpawn: { x: 64, y: floorY - hero.h },
    solids,
    oneWay,
    ladders,
    enemies,
    pickups,
    exit
  };
}

function generateStage001Boss(floorNum) {
  const floorY = H - 34;
  const atkMult = getCompoundAttackMultiplier(floorNum);
  const diffScale = typeof setup !== "undefined"
    ? (setup.difficulty === "ULTIMATE" ? 1.5 : (setup.difficulty === "HARD" ? 1.25 : 1.0))
    : 1.0;
  const bossHp = Math.round((480 + floorNum * 12) * diffScale);

  return {
    id: "stage001_boss_chamber",
    stageId: "001",
    bgTemplate: "bg003",
    pageLeft: 201,
    pageRight: 202,
    heroSpawn: { x: 68, y: floorY - hero.h },
    solids: [
      { x: 0, y: 0, w: 24, h: H, hatched: true },
      { x: W - 24, y: 0, w: 24, h: H, hatched: true },
      { x: 0, y: 0, w: W, h: 54, hatched: true },
      { x: 0, y: floorY, w: W, h: 34, hatched: true },
      { x: 90, y: 390, w: 220, h: 18, hatched: false },
      { x: W - 310, y: 390, w: 220, h: 18, hatched: false },
      { x: HALF_W - 150, y: 265, w: 300, h: 18, hatched: false }
    ],
    oneWay: [],
    ladders: [
      { x: 130, y: 378, w: 36, h: floorY - 378 },
      { x: W - 166, y: 378, w: 36, h: floorY - 378 }
    ],
    enemies: [
      {
        kind: "giant",
        name: "ABYSS EXECUTIONER",
        x: W - 240,
        y: floorY - 124,
        w: 74,
        h: 124,
        vx: -54,
        chaseSpeed: 112,
        chargeSpeed: 155,
        chargeMaxDist: 360,
        minX: 30,
        maxX: W - 30,
        hp: bossHp,
        maxHp: bossHp,
        atk: Math.round(32 * atkMult),
        cleaveAtk: Math.round(36 * atkMult),
        chargeAtk: Math.round(40 * atkMult),
        weaponLength: 92,
        weaponAngle: -0.35,
        visionRange: 640,
        facing: -1,
        aiState: "CHASE",
        aiTimer: 0,
        alerted: true,
        alertTimer: 0,
        aggroTimer: 999,
        chargeCooldown: 1.5,
        chargeDir: -1,
        chargeDistTraveled: 0,
        struckThisSwing: false,
        hurtTimer: 0,
        animTimer: 0,
        isBoss: true,
        scoreValue: 5000,
        alive: true
      }
    ],
    pickups: [
      { type: "chicken", x: HALF_W - 17, y: 265 - 28, w: 34, h: 28, collected: false }
    ],
    exit: {
      x: W - 78,
      y: floorY - 58,
      w: 42,
      h: 58,
      dir: "right",
      lockedUntilBossDead: true
    }
  };
}

function generateStage001Vault() {
  const floorY = H - 34;
  return {
    id: "stage001_treasure_vault",
    stageId: "001",
    bgTemplate: "bg003",
    isFinal: true,
    pageLeft: 203,
    pageRight: 204,
    heroSpawn: { x: 68, y: floorY - hero.h },
    solids: [
      { x: 0, y: 0, w: 24, h: H, hatched: true },
      { x: W - 24, y: 0, w: 24, h: H, hatched: true },
      { x: 0, y: 0, w: W, h: 54, hatched: true },
      { x: 0, y: floorY, w: W, h: 34, hatched: true },
      { x: 140, y: 400, w: 250, h: 18, hatched: false },
      { x: 570, y: 400, w: 250, h: 18, hatched: false },
      { x: 330, y: 270, w: 300, h: 18, hatched: false }
    ],
    oneWay: [],
    ladders: [
      { x: 220, y: 388, w: 36, h: floorY - 388 },
      { x: 462, y: 258, w: 36, h: floorY - 258 },
      { x: 704, y: 388, w: 36, h: floorY - 388 }
    ],
    enemies: [],
    pickups: [], // Populated by scatterTreasureRoomItems(scr) in js/physics.js
    exit: {
      x: W - 82,
      y: floorY - 62,
      w: 46,
      h: 62,
      dir: "right",
      label: "VAULT"
    }
  };
}

// ============================================================================
// STAGE REGISTRY — Add Stage 002+ landscape templates here without editing core flow
// ============================================================================
const STAGE_GENERATORS = {
  "001": {
    stageId: "001",
    stageName: "RUIN CAVE",
    bgm: "music/music001.mp3",
    maxFloors: 100,
    nextStageId: null, // Change to "002" once Stage 002 landscape templates are registered
    generateFloor: generateStage001Floor,
    generateBoss: generateStage001Boss,
    generateVault: generateStage001Vault
  }
};

function registerStageGenerator(stageId, config) {
  const key = String(stageId).padStart(3, "0");
  STAGE_GENERATORS[key] = {
    stageId: key,
    stageName: config.stageName || `STAGE ${key}`,
    bgm: config.bgm || `music/music${key}.mp3`,
    maxFloors: config.maxFloors || MAX_FLOORS,
    nextStageId: config.nextStageId || null,
    generateStart: config.generateStart || null,
    generateFloor: config.generateFloor,
    generateBoss: config.generateBoss,
    generateVault: config.generateVault
  };
}

function getActiveStageGenerator() {
  const id = String(game.stageId || "001").padStart(3, "0");
  return STAGE_GENERATORS[id] || STAGE_GENERATORS["001"];
}

function applyScreenToGame(scr) {
  game.activeScreen = scr;
  game.bullets.length = 0;
  game.bones.length = 0;
  game.missiles.length = 0;
  game.particles.length = 0;
  game.shockwaves.length = 0;

  const spawn = scr.heroSpawn || { x: 112, y: (H - 34) - hero.h };
  hero.x = spawn.x;
  hero.y = spawn.y;
  hero.vx = 0;
  hero.vy = 0;
  hero.grounded = true;
  hero.onLadder = false;
  hero.activeLadder = null;
  hero.dropThroughTimer = 0;
  hero.invulnTimer = 0.5;
  game.camX = 0;
  game.camY = 0;
}

async function switchToStage(nextStageId) {
  const id = String(nextStageId).padStart(3, "0");
  const gen = STAGE_GENERATORS[id];
  if (!gen) return false;

  game.stageId = id;
  game.transitions = 0;
  game.bossArmed = false;
  game.bossDefeated = false;

  if (typeof stageManager !== "undefined") {
    stageManager.stageFolder = `./Stages/${id}`;
    stageManager.bgImages = {};
    if (!stageManager.data) stageManager.data = {};
    stageManager.data.stageName = gen.stageName;
    stageManager.data.bgm = gen.bgm;

    try {
      const res = await fetch(`${stageManager.stageFolder}/stage.json`, { cache: "no-store" });
      if (res.ok) {
        const parsed = await res.json();
        if (parsed) {
          stageManager.data = { ...stageManager.data, ...parsed };
          if (Array.isArray(parsed.screens)) {
            parsed.screens.forEach((scr, idx) => {
              const key = scr.id || scr.file || String(idx);
              const imgFile = scr.image || scr.file;
              if (imgFile) {
                stageManager.bgImages[key] = loadOptionalImage(`${stageManager.stageFolder}/${imgFile}`);
              }
            });
          }
        }
      }
    } catch (_) {}

    if (typeof resolveStageBgmPath === "function" && typeof createStage001BgmAudio === "function") {
      const resolvedBgmSrc = resolveStageBgmPath(stageManager.stageFolder, stageManager.data.bgm);
      if (stageManager.bgmAudio) stageManager.bgmAudio.pause();
      stageManager.bgmAudio = createStage001BgmAudio(resolvedBgmSrc);
      SFX.syncBgm();
    }
  }

  // Start Stage 2+ either on its custom ENTRY screen (if defined) or directly on Floor 1
  if (typeof gen.generateStart === "function") {
    game.roomType = "START";
    const startScr = gen.generateStart();
    game.runSeed = startScr.seed || getStageFloorSeed(id, 0);
    applyScreenToGame(startScr);
  } else {
    game.transitions = 1;
    game.roomType = "RANDOM";
    const floor1 = gen.generateFloor(1);
    game.runSeed = floor1.seed || getStageFloorSeed(id, 1);
    applyScreenToGame(floor1);
  }
  return true;
}

function advanceToNextScreen() {
  const gen = getActiveStageGenerator();
  const stageMaxFloors = gen.maxFloors || MAX_FLOORS;

  if (game.roomType === "TREASURE") {
    if (gen.nextStageId && STAGE_GENERATORS[gen.nextStageId]) {
      switchToStage(gen.nextStageId);
      SFX.beep(520, 0.22, "triangle", 0.1, 880);
      return;
    }
    game.state = "VICTORY";
    if (typeof SFX !== "undefined" && typeof SFX.playVictoryFanfare === "function") {
      SFX.playVictoryFanfare();
    }
    SFX.syncBgm();
    return;
  }

  if (game.roomType === "BOSS") {
    game.roomType = "TREASURE";
    game.runSeed = getStageFloorSeed(gen.stageId, stageMaxFloors + 2);
    const vault = gen.generateVault(game.transitions);
    if (typeof scatterTreasureRoomItems === "function") {
      scatterTreasureRoomItems(vault);
    }
    applyScreenToGame(vault);
    SFX.beep(580, 0.22, "triangle", 0.1, 980);
    return;
  }

  // Enter Boss Chamber if player armed [B] after Floor 10 OR reached the stage's 100-floor summit
  if ((game.transitions >= 10 && game.bossArmed) || game.transitions >= stageMaxFloors) {
    game.roomType = "BOSS";
    game.bossArmed = false;
    game.bossDefeated = false;
    game.runSeed = getStageFloorSeed(gen.stageId, stageMaxFloors + 1);
    applyScreenToGame(gen.generateBoss(game.transitions));
    SFX.beep(140, 0.35, "sawtooth", 0.12, 65);
    return;
  }

  // Advance to the next deterministic floor (1..100) for the active stage
  game.transitions = Math.min(stageMaxFloors, game.transitions + 1);
  game.roomType = "RANDOM";
  const nextScr = gen.generateFloor(game.transitions);
  game.runSeed = nextScr.seed || getStageFloorSeed(gen.stageId, game.transitions);
  applyScreenToGame(nextScr);
  SFX.beep(440, 0.12, "triangle", 0.08, 660);
}
