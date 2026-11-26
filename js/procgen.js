// js/procgen.js //
"use strict";

function getCompoundAttackMultiplier(transitions) {
  return Math.pow(1.02, Math.max(0, transitions || 0));
}

function createEnemyInstance(kind, centerX, floorY, minX, maxX, transitions = 0, isBoss = false) {
  const atkMult = getCompoundAttackMultiplier(transitions);
  const scale = 1 + Math.min(2.5, transitions * 0.04);

  if (isBoss) {
    const w = 72;
    const h = 144;
    return {
      kind: "giant",
      isBoss: true,
      name: "THE VAULT WARDEN",
      x: Math.round(centerX - w * 0.5),
      y: floorY - h,
      w,
      h,
      vx: 82,
      minX,
      maxX,
      facing: -1,
      hp: Math.round(680 * (1 + transitions * 0.03)),
      maxHp: Math.round(680 * (1 + transitions * 0.03)),
      atk: Math.round(26 * atkMult),
      cleaveAtk: Math.round(42 * atkMult),
      scoreValue: 5000,
      aiState: "WALK",
      aiTimer: 0,
      animTimer: 0,
      weaponAngle: -0.35,
      weaponLength: 92,
      struckThisSwing: false,
      hurtTimer: 0,
      alive: true
    };
  }

  if (kind === "giant") {
    const w = 48;
    const h = 96;
    return {
      kind: "giant",
      isBoss: false,
      x: Math.round(centerX - w * 0.5),
      y: floorY - h,
      w,
      h,
      vx: 58 * Math.min(1.6, scale),
      minX,
      maxX,
      facing: -1,
      hp: Math.round(130 * scale),
      maxHp: Math.round(130 * scale),
      atk: Math.round(18 * atkMult),
      cleaveAtk: Math.round(28 * atkMult),
      scoreValue: 800,
      aiState: "WALK",
      aiTimer: 0,
      animTimer: 0,
      weaponAngle: -0.35,
      weaponLength: 62,
      struckThisSwing: false,
      hurtTimer: 0,
      alive: true
    };
  }

  const w = 28;
  const h = 46;
  return {
    kind: "blade",
    isBoss: false,
    x: Math.round(centerX - w * 0.5),
    y: floorY - h,
    w,
    h,
    vx: -95 * Math.min(1.75, scale),
    minX,
    maxX,
    facing: -1,
    hp: Math.round(35 * scale),
    maxHp: Math.round(35 * scale),
    atk: Math.round(16 * atkMult),
    scoreValue: 250,
    animTimer: 0,
    slashTimer: 0,
    hurtTimer: 0,
    alive: true
  };
}

function createSeededRng(seedInt) {
  let a = seedInt >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateProceduralScreen(runSeed, stageIndex) {
  const roomSeed = (runSeed ^ Math.imul(stageIndex, 0x9E3779B1)) >>> 0;
  const rng = createSeededRng(roomSeed);
  const randInt = (min, max) => Math.floor(rng() * (max - min + 1)) + min;
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];

  const worldW = W;
  const worldH = H;
  const COLS = 3;
  const ROWS = 3;
  const topMargin = 58;
  const floorBaseY = worldH - 34;
  const usableH = floorBaseY - topMargin;
  const cellW = worldW / COLS;
  const cellH = usableH / ROWS;
  const wallThick = 24;

  const density = rng();
  const isSpacious = density < 0.35;
  const isDense = density > 0.65;

  const solids = [];
  const oneWay = [];
  const ladders = [];
  const pickups = [];
  const enemies = [];

  solids.push({ x: 0, y: 0, w: worldW, h: 28 });
  solids.push({ x: 0, y: floorBaseY, w: worldW, h: 34, hatched: true });
  solids.push({ x: 0, y: 0, w: wallThick, h: worldH });
  solids.push({ x: worldW - wallThick, y: 0, w: wallThick, h: worldH });

  const grid = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      onSpine: false,
      openLeft: false,
      openRight: false,
      openUp: false,
      openDown: false
    }))
  );

  let curR = randInt(0, ROWS - 1);
  let curC = 0;
  const startRow = curR;
  grid[curR][curC].onSpine = true;
  grid[curR][curC].openLeft = true;

  while (curC < COLS - 1) {
    const moves = [{ dr: 0, dc: 1, weight: isSpacious ? 3 : 2 }];
    if (curR > 0 && !grid[curR - 1][curC].onSpine) moves.push({ dr: -1, dc: 0, weight: isDense ? 3 : 2 });
    if (curR < ROWS - 1 && !grid[curR + 1][curC].onSpine) moves.push({ dr: 1, dc: 0, weight: 2 });

    const totalW = moves.reduce((s, m) => s + m.weight, 0);
    let roll = rng() * totalW;
    let chosen = moves[0];
    for (const m of moves) {
      roll -= m.weight;
      if (roll <= 0) { chosen = m; break; }
    }

    const nextR = curR + chosen.dr;
    const nextC = curC + chosen.dc;

    if (chosen.dc === 1) {
      grid[curR][curC].openRight = true;
      grid[nextR][nextC].openLeft = true;
    } else if (chosen.dr === -1) {
      grid[curR][curC].openUp = true;
      grid[nextR][nextC].openDown = true;
    } else if (chosen.dr === 1) {
      grid[curR][curC].openDown = true;
      grid[nextR][nextC].openUp = true;
    }

    curR = nextR;
    curC = nextC;
    grid[curR][curC].onSpine = true;
  }

  const exitRow = curR;
  grid[exitRow][COLS - 1].openRight = true;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      const x0 = c * cellW;
      const y0 = topMargin + r * cellH;
      const cellFloorY = (r === ROWS - 1) ? floorBaseY : Math.round(y0 + cellH - 16);

      if (r < ROWS - 1) {
        if (cell.openDown) {
          const hatchW = 86;
          const hatchX = Math.round(x0 + cellW * 0.5 - hatchW * 0.5);
          solids.push({ x: Math.round(x0), y: cellFloorY, w: hatchX - Math.round(x0), h: 16, hatched: true });
          oneWay.push({ x: hatchX, y: cellFloorY, w: hatchW });
          solids.push({ x: hatchX + hatchW, y: cellFloorY, w: Math.round(x0 + cellW) - (hatchX + hatchW), h: 16, hatched: true });
        } else if (cell.onSpine || !isSpacious || rng() < 0.45) {
          solids.push({ x: Math.round(x0), y: cellFloorY, w: Math.round(cellW), h: 16, hatched: true });
        } else {
          const platW = randInt(100, 175);
          const platX = Math.round(x0 + randInt(24, Math.max(26, Math.floor(cellW) - platW - 24)));
          oneWay.push({ x: platX, y: cellFloorY, w: platW });
        }
      }

      if (c < COLS - 1 && !cell.openRight) {
        const shouldWall = isDense ? (rng() < 0.70) : (!isSpacious && rng() < 0.38);
        if (shouldWall) {
          const wallX = Math.round(x0 + cellW - 11);
          const wallTop = Math.round(y0 + 16);
          const wallH = cellFloorY - wallTop;
          if (wallH > 36) solids.push({ x: wallX, y: wallTop, w: 22, h: wallH, hatched: true });
        }
      }

      if (cell.openUp || (!isSpacious && r > 0 && rng() < (isDense ? 0.35 : 0.14))) {
        const ladderX = Math.round(x0 + randInt(48, Math.max(52, Math.floor(cellW) - 80)));
        const upperFloorY = Math.round(y0 - 16);
        ladders.push({
          x: ladderX,
          y: upperFloorY - 6,
          w: 30,
          h: (cellFloorY - upperFloorY) + 10
        });
      }

      if (rng() < (isDense ? 0.50 : 0.25)) {
        const ledgeW = randInt(80, 130);
        const ledgeX = Math.round(x0 + randInt(28, Math.max(30, Math.floor(cellW) - ledgeW - 28)));
        const ledgeY = Math.round(y0 + cellH * 0.48);
        oneWay.push({ x: ledgeX, y: ledgeY, w: ledgeW });
      }
    }
  }

  const spawnFloorY = (startRow === ROWS - 1) ? floorBaseY : Math.round(topMargin + (startRow + 1) * cellH - 16);
  solids.push({ x: wallThick, y: spawnFloorY, w: 120, h: 16, hatched: true });
  const spawnX = 46;
  const spawnY = spawnFloorY - hero.h;

  const exitFloorY = (exitRow === ROWS - 1) ? floorBaseY : Math.round(topMargin + (exitRow + 1) * cellH - 16);
  solids.push({ x: worldW - wallThick - 120, y: exitFloorY, w: 120, h: 16, hatched: true });
  const exit = {
    x: worldW - wallThick - 40,
    y: exitFloorY - 68,
    w: 36,
    h: 68,
    dir: "right"
  };

  const enemyCount = Math.min(9, 3 + Math.floor(stageIndex * 0.55));
  for (let i = 0; i < enemyCount; i++) {
    const ec = randInt(1, COLS - 1);
    const er = randInt(0, ROWS - 1);
    if (ec === 0 && er === startRow) continue;

    const ex0 = Math.round(ec * cellW + 28);
    const ex1 = Math.round((ec + 1) * cellW - 28);
    const ey = (er === ROWS - 1) ? floorBaseY : Math.round(topMargin + (er + 1) * cellH - 16);
    const isGiant = stageIndex >= 3 && rng() < Math.min(0.45, 0.15 + stageIndex * 0.02);

    const enemy = createEnemyInstance(isGiant ? "giant" : "blade", (ex0 + ex1) * 0.5, ey, ex0, ex1, stageIndex, false);
    if (!isGiant) {
      enemy.vx = (rng() < 0.5 ? -1 : 1) * Math.abs(enemy.vx);
      enemy.animTimer = rng() * 6;
    }
    enemies.push(enemy);
  }

  const pickupTypes = ["chicken", "crown", "hat"];
  const numPickups = randInt(1, 2);
  for (let p = 0; p < numPickups; p++) {
    const pc = randInt(1, COLS - 1);
    const pr = randInt(0, ROWS - 1);
    const px = Math.round(pc * cellW + cellW * 0.5 - 14);
    const py = ((pr === ROWS - 1) ? floorBaseY : Math.round(topMargin + (pr + 1) * cellH - 16)) - 30;
    const pType = (stageIndex === 2 && p === 0) ? "hat" : pick(pickupTypes);
    pickups.push({ type: pType, x: px, y: py, w: 28, h: 26, collected: false });
  }

  return {
    id: `random.${String(stageIndex).padStart(2, "0")}`,
    roomType: "RANDOM",
    worldW,
    worldH,
    pageLeft: stageIndex * 2 + 1,
    pageRight: stageIndex * 2 + 2,
    spawn: { x: spawnX, y: spawnY },
    exit,
    solids,
    oneWay,
    ladders,
    pickups,
    enemies
  };
}

function generateBossScreen(transitions) {
  const floorBaseY = H - 34;
  return {
    id: "boss_chamber",
    roomType: "BOSS",
    worldW: W,
    worldH: H,
    pageLeft: "BOSS",
    pageRight: "ARENA",
    spawn: { x: 72, y: floorBaseY - hero.h },
    exit: {
      x: W - 64,
      y: floorBaseY - 72,
      w: 36,
      h: 72,
      dir: "right",
      lockedUntilBossDead: true
    },
    solids: [
      { x: 0, y: 0, w: W, h: 28 },
      { x: 0, y: floorBaseY, w: W, h: 34, hatched: true },
      { x: 0, y: 0, w: 24, h: H },
      { x: W - 24, y: 0, w: 24, h: H }
    ],
    oneWay: [
      { x: 140, y: 390, w: 180, h: 12 },
      { x: W - 320, y: 390, w: 180, h: 12 }
    ],
    ladders: [
      { x: 170, y: 390, w: 32, h: floorBaseY - 390 },
      { x: W - 202, y: 390, w: 32, h: floorBaseY - 390 }
    ],
    pickups: [
      { type: "chicken", x: 185, y: 358, w: 34, h: 28, collected: false },
      { type: "chicken", x: W - 219, y: 358, w: 34, h: 28, collected: false }
    ],
    enemies: [
      createEnemyInstance("giant", W * 0.68, floorBaseY, 64, W - 64, transitions, true)
    ]
  };
}

function generateTreasureScreen(transitions) {
  const floorBaseY = H - 34;
  return {
    id: "treasure_vault",
    roomType: "TREASURE",
    isFinal: true,
    worldW: W,
    worldH: H,
    pageLeft: "VAULT",
    pageRight: "END",
    spawn: { x: 84, y: floorBaseY - hero.h },
    exit: {
      x: W - 92,
      y: floorBaseY - 110,
      w: 54,
      h: 110,
      dir: "right",
      label: "VAULT"
    },
    solids: [
      { x: 0, y: 0, w: W, h: 28 },
      { x: 0, y: floorBaseY, w: W, h: 34, hatched: true },
      { x: 0, y: 0, w: 24, h: H },
      { x: W - 24, y: 0, w: 24, h: H }
    ],
    oneWay: [],
    ladders: [],
    pickups: [
      { type: "treasure", x: 300, y: floorBaseY - 36, w: 42, h: 36, collected: false },
      { type: "treasure", x: 450, y: floorBaseY - 36, w: 42, h: 36, collected: false },
      { type: "treasure", x: 600, y: floorBaseY - 36, w: 42, h: 36, collected: false },
      { type: "crown",    x: 735, y: floorBaseY - 26, w: 28, h: 24, collected: false }
    ],
    enemies: []
  };
}
