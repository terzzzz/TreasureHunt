// js/procgen.js //
"use strict";

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

function hashSeedString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Generates a standard W x H room with a guaranteed path from spawn to exit.
 * When played at camZoom = 2.0, the player sees 1/4 of this room at a time.
 */
function generateProceduralScreen(runSeed, stageIndex, totalRandomStages = 9) {
  const roomSeed = (runSeed ^ Math.imul(stageIndex, 0x9E3779B1)) >>> 0;
  const rng = createSeededRng(roomSeed);
  const randInt = (min, max) => Math.floor(rng() * (max - min + 1)) + min;
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];

  const worldW = W;
  const worldH = H;
  const COLS = 3;
  const ROWS = 3;
  const topMargin = 58; // keep below notebook DATE/TIME header
  const floorBaseY = worldH - 34;
  const usableH = floorBaseY - topMargin;
  const cellW = worldW / COLS;
  const cellH = usableH / ROWS;
  const wallThick = 24;

  // Room personality: spacious vs. dense multi-floor + ladders
  const density = rng();
  const isSpacious = density < 0.35;
  const isDense = density > 0.65;

  const solids = [];
  const oneWay = [];
  const ladders = [];
  const pickups = [];
  const enemies = [];

  // Outer perimeter shell
  solids.push({ x: 0, y: 0, w: worldW, h: 28 }); // ceiling
  solids.push({ x: 0, y: floorBaseY, w: worldW, h: 34, hatched: true }); // ground floor
  solids.push({ x: 0, y: 0, w: wallThick, h: worldH }); // left wall
  solids.push({ x: worldW - wallThick, y: 0, w: wallThick, h: worldH }); // right wall

  // 1. Carve guaranteed spine across 3x3 grid from col 0 to col 2
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
    if (curR > 0 && !grid[curR - 1][curC].onSpine) {
      moves.push({ dr: -1, dc: 0, weight: isDense ? 3 : 2 });
    }
    if (curR < ROWS - 1 && !grid[curR + 1][curC].onSpine) {
      moves.push({ dr: 1, dc: 0, weight: 2 });
    }

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

  // 2. Build cell floors, impassable vertical walls, one-way ledges, and ladders
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      const x0 = c * cellW;
      const y0 = topMargin + r * cellH;
      const cellFloorY = (r === ROWS - 1) ? floorBaseY : Math.round(y0 + cellH - 16);

      if (r < ROWS - 1) {
        if (cell.openDown) {
          // Guaranteed drop-through hatch on spine (safe drop, no fall dmg)
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

      // Impassable vertical wall between columns when NOT connected on spine
      if (c < COLS - 1 && !cell.openRight) {
        const shouldWall = isDense ? (rng() < 0.70) : (!isSpacious && rng() < 0.38);
        if (shouldWall) {
          const wallX = Math.round(x0 + cellW - 11);
          const wallTop = Math.round(y0 + 16);
          const wallH = cellFloorY - wallTop;
          if (wallH > 36) {
            solids.push({ x: wallX, y: wallTop, w: 22, h: wallH, hatched: true });
          }
        }
      }

      // Mandatory ladder when spine climbs UP
      if (cell.openUp) {
        const ladderX = Math.round(x0 + randInt(48, Math.max(52, Math.floor(cellW) - 80)));
        const upperFloorY = Math.round(y0 - 16);
        ladders.push({
          x: ladderX,
          y: upperFloorY - 6,
          w: 30,
          h: (cellFloorY - upperFloorY) + 10
        });
      } else if (!isSpacious && r > 0 && rng() < (isDense ? 0.35 : 0.14)) {
        const ladderX = Math.round(x0 + randInt(48, Math.max(52, Math.floor(cellW) - 80)));
        const upperFloorY = Math.round(y0 - 16);
        ladders.push({
          x: ladderX,
          y: upperFloorY - 6,
          w: 30,
          h: (cellFloorY - upperFloorY) + 10
        });
      }

      // Optional mid-cell one-way ledge
      if (rng() < (isDense ? 0.50 : 0.25)) {
        const ledgeW = randInt(80, 130);
        const ledgeX = Math.round(x0 + randInt(28, Math.max(30, Math.floor(cellW) - ledgeW - 28)));
        const ledgeY = Math.round(y0 + cellH * 0.48);
        oneWay.push({ x: ledgeX, y: ledgeY, w: ledgeW });
      }
    }
  }

  // 3. Guaranteed Spawn & Exit pads
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

  // 4. Populate scaled enemies & pickups on valid floors
  const difficultyScale = 1 + (stageIndex / totalRandomStages) * 0.75;
  const enemyCount = Math.min(9, 3 + Math.floor(stageIndex * 0.7));

  for (let i = 0; i < enemyCount; i++) {
    const ec = randInt(1, COLS - 1);
    const er = randInt(0, ROWS - 1);
    if (ec === 0 && er === startRow) continue;

    const ex0 = Math.round(ec * cellW + 28);
    const ex1 = Math.round((ec + 1) * cellW - 28);
    const ey = (er === ROWS - 1) ? floorBaseY : Math.round(topMargin + (er + 1) * cellH - 16);
    const isGiant = stageIndex >= 3 && rng() < (0.15 + stageIndex * 0.04);

    if (isGiant) {
      enemies.push({
        kind: "giant",
        x: Math.round((ex0 + ex1) * 0.5 - 24),
        y: ey - 96,
        w: 48, h: 96,
        vx: 58 * difficultyScale,
        minX: ex0, maxX: ex1,
        facing: -1,
        hp: Math.round(130 * difficultyScale),
        maxHp: Math.round(130 * difficultyScale),
        aiState: "WALK", aiTimer: 0, animTimer: 0,
        weaponAngle: -0.35, weaponLength: 62,
        struckThisSwing: false, hurtTimer: 0, alive: true
      });
    } else {
      enemies.push({
        kind: "blade",
        x: Math.round((ex0 + ex1) * 0.5 - 14),
        y: ey - 46,
        w: 28, h: 46,
        vx: (rng() < 0.5 ? -1 : 1) * 95 * difficultyScale,
        minX: ex0, maxX: ex1,
        facing: -1,
        hp: Math.round(35 * difficultyScale),
        maxHp: Math.round(35 * difficultyScale),
        animTimer: rng() * 6, slashTimer: 0, hurtTimer: 0, alive: true
      });
    }
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
