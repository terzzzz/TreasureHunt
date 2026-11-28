// js/procgen.js //
"use strict";

// Tunable Procedural Room Generation Parameters
const PROCGEN_PARAMS = {
  minLadderHeight: 140,       // Minimum ladder span in px (floor-to-floor is 180px -> ladder h = 198px)
  highWallMinHeight: 148,     // Non-jumpable divider wall height (hero max jump is ~92px)
  highWallMaxHeight: 180,     // Full floor-to-floor divider wall height
  lowWallHeight: 54,          // Jumpable tactical cover wall (splits enemy sightlines & patrol zones)
  safeMaxJumpHeight: 82,      // Conservative jump height used by pathability check (< 92.4px apex)
  safeMaxJumpGap: 112,        // Conservative horizontal jump gap calibrated for slow Prosthesis speed
  maxValidationAttempts: 24   // Max seeded layout retries before guaranteed fallback
};

const ROOM_ARCHETYPES = [
  "DIVIDED_CITADEL",
  "ZIGZAG_ASCENT",
  "UNDERGROUND_BYPASS",
  "TWIN_SHAFTS",
  "CATACOMB_BRIDGES"
];

function getCompoundAttackMultiplier(transitions) {
  return Math.pow(1.02, Math.max(0, transitions || 0));
}

function createEnemyInstance(kind, centerX, floorY, minX, maxX, transitions = 0, isBoss = false) {
  const atkMult = getCompoundAttackMultiplier(transitions);
  const scale = 1 + Math.min(2.5, transitions * 0.04);

  if (isBoss) {
    const w = 84;
    const h = 138;
    return {
      kind: "giant",
      isBoss: true,
      name: "THE VAULT WARDEN",
      x: Math.round(centerX - w * 0.5),
      y: floorY - h,
      w,
      h,
      vx: 72,
      chaseSpeed: 118,
      chargeSpeed: 147.5,
      chargeMaxDist: 340,
      chargeDistTraveled: 0,
      chargeCooldown: 1.5,
      visionRange: 540,
      alerted: true,
      alertTimer: 0,
      aggroTimer: 999,
      minX,
      maxX,
      facing: -1,
      hp: Math.round(680 * (1 + transitions * 0.03)),
      maxHp: Math.round(680 * (1 + transitions * 0.03)),
      atk: Math.round(24 * atkMult),
      cleaveAtk: Math.round(24 * atkMult),
      chargeAtk: Math.round(24 * atkMult),
      scoreValue: 5000,
      aiState: "CHASE",
      aiTimer: 0,
      animTimer: 0,
      weaponAngle: -0.35,
      weaponLength: 96,
      struckThisSwing: false,
      hurtTimer: 0,
      alive: true
    };
  }

  if (kind === "giant") {
    const w = 56;
    const h = 92;
    return {
      kind: "giant",
      isBoss: false,
      x: Math.round(centerX - w * 0.5),
      y: floorY - h,
      w,
      h,
      vx: 54 * Math.min(1.5, scale),
      chaseSpeed: 96 * Math.min(1.5, scale),
      chargeSpeed: 122.5 * Math.min(1.45, scale),
      chargeMaxDist: 260,
      chargeDistTraveled: 0,
      chargeCooldown: 0,
      visionRange: 420,
      alerted: false,
      alertTimer: 0,
      aggroTimer: 0,
      minX,
      maxX,
      facing: -1,
      hp: Math.round(145 * scale),
      maxHp: Math.round(145 * scale),
      atk: Math.round(24 * atkMult),
      cleaveAtk: Math.round(24 * atkMult),
      chargeAtk: Math.round(24 * atkMult),
      scoreValue: 800,
      aiState: "PATROL",
      aiTimer: 0,
      animTimer: 0,
      weaponAngle: -0.35,
      weaponLength: 68,
      struckThisSwing: false,
      hurtTimer: 0,
      alive: true
    };
  }

  if (kind === "knifer") {
    const w = 32;
    const h = 51;
    const hp = Math.round(34 * scale);
    return {
      kind: "knifer",
      isBoss: false,
      x: Math.round(centerX - w * 0.5),
      y: floorY - h,
      w,
      h,
      vx: -46 * Math.min(1.4, scale),
      chaseSpeed: 56 * Math.min(1.4, scale),
      dashSpeed: 265 * Math.min(1.35, scale),
      dashWindup: 0.26,
      dashDuration: 0.22,
      dashCooldown: 0,
      dashCooldownTime: 1.35,
      dashDir: -1,
      struckThisDash: false,
      visionRange: 340,
      alerted: false,
      aggroTimer: 0,
      minX,
      maxX,
      facing: -1,
      hp,
      maxHp: hp,
      atk: Math.round(13 * atkMult),
      scoreValue: 260,
      aiState: "PATROL",
      aiTimer: 0,
      animTimer: 0,
      hurtTimer: 0,
      alive: true
    };
  }

  const w = 34;
  const h = 56;
  return {
    kind: "blade",
    isBoss: false,
    x: Math.round(centerX - w * 0.5),
    y: floorY - h,
    w,
    h,
    vx: -77 * Math.min(1.5, scale),
    chaseSpeed: 164.5 * Math.min(1.45, scale),
    visionRange: 340,
    alerted: false,
    aggroTimer: 0,
    minX,
    maxX,
    facing: -1,
    hp: Math.round(45 * scale),
    maxHp: Math.round(45 * scale),
    atk: Math.round(15 * atkMult),
    scoreValue: 250,
    animTimer: 0,
    slashTimer: 0,
    slashCooldown: 0,
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

// ============================================================================
// PATHABILITY VALIDATOR (Walk + Jump + Low-Wall Vault + Ladder + Drop-Through)
// ============================================================================
function isRoomPassable(room, params = PROCGEN_PARAMS) {
  if (!room || !room.spawn || !room.exit) return false;

  const heroW = (typeof hero !== "undefined" && hero.w) ? hero.w : 34;
  const heroH = (typeof hero !== "undefined" && hero.h) ? hero.h : 56;
  const minLadderH = Math.max(40, params.minLadderHeight || 140);
  const maxJumpH = params.safeMaxJumpHeight || 82;
  const maxJumpGap = params.safeMaxJumpGap || 112;
  const stepX = 8;

  // 1. Enforce minimum ladder height constraint
  for (const l of (room.ladders || [])) {
    if (l.h < minLadderH) return false;
  }

  // 2. Collect all walkable surfaces (solid floor tops & one-way platforms)
  const surfaces = [];
  for (const s of (room.solids || [])) {
    if (s.w >= 28 && s.y > 44 && s.y < room.worldH) {
      surfaces.push({ x1: s.x, x2: s.x + s.w, y: s.y, kind: "solid" });
    }
  }
  for (const p of (room.oneWay || [])) {
    if (p.w >= 24 && p.y > 44 && p.y < room.worldH) {
      surfaces.push({ x1: p.x, x2: p.x + p.w, y: p.y, kind: "oneWay" });
    }
  }
  if (surfaces.length === 0) return false;

  // Helper: returns height of any solid wall obstructing standing at (x, floorY), or 0 if clear
  function getObstructionHeight(x, floorY) {
    const left = x - heroW * 0.42;
    const right = x + heroW * 0.42;
    let maxWallH = 0;

    for (const s of (room.solids || [])) {
      if (right <= s.x + 1 || left >= s.x + s.w - 1) continue;
      // Ceiling / overhead block above floorY
      if (s.y + s.h <= floorY && s.y + s.h > floorY - heroH + 4) {
        return 999; // Headroom blocked
      }
      // Wall rising from or crossing floorY
      if (s.y < floorY - 2 && s.y + s.h >= floorY - 2) {
        const hAboveFloor = floorY - s.y;
        if (hAboveFloor > maxWallH) maxWallH = hAboveFloor;
      }
    }
    return maxWallH;
  }

  // Helper: check if a solid slab blocks vertical movement between yTop and yBottom at x
  function isVerticallyBlocked(x, yTop, yBottom, ignoreLadderZone) {
    const left = x - heroW * 0.35;
    const right = x + heroW * 0.35;
    for (const s of (room.solids || [])) {
      if (s.y >= yBottom || s.y + s.h <= yTop) continue;
      if (right <= s.x + 1 || left >= s.x + s.w - 1) continue;
      if (ignoreLadderZone && s.y < room.worldH - 40) {
        if (s.x < ignoreLadderZone.x + ignoreLadderZone.w + 8 && s.x + s.w > ignoreLadderZone.x - 8) {
          continue;
        }
      }
      return true;
    }
    return false;
  }

  // 3. Sample valid standing nodes across all walkable surfaces
  const nodes = [];
  surfaces.forEach((surf, sIdx) => {
    const startSample = Math.ceil((surf.x1 + 10) / stepX) * stepX;
    const endSample = Math.floor((surf.x2 - 10) / stepX) * stepX;
    for (let x = startSample; x <= endSample; x += stepX) {
      if (getObstructionHeight(x, surf.y) === 0) {
        nodes.push({ id: nodes.length, sIdx, x, y: surf.y, kind: surf.kind });
      }
    }
  });
  if (nodes.length === 0) return false;

  // Locate start node under spawn and check exit overlap
  const spawnCenterX = room.spawn.x + heroW * 0.5;
  const spawnFootY = room.spawn.y + heroH;
  let startNode = null;
  let bestStartDist = Infinity;

  for (const n of nodes) {
    if (Math.abs(n.y - spawnFootY) <= 22) {
      const d = Math.abs(n.x - spawnCenterX);
      if (d < bestStartDist) {
        bestStartDist = d;
        startNode = n;
      }
    }
  }
  if (!startNode || bestStartDist > 48) return false;

  const ex = room.exit;
  function reachesExit(n) {
    const heroBox = { x: n.x - heroW * 0.5, y: n.y - heroH, w: heroW, h: heroH };
    const exitBox = { x: ex.x - 6, y: ex.y - 6, w: ex.w + 12, h: ex.h + 12 };
    return (
      heroBox.x < exitBox.x + exitBox.w &&
      heroBox.x + heroBox.w > exitBox.x &&
      heroBox.y < exitBox.y + exitBox.h &&
      heroBox.y + heroBox.h > exitBox.y
    );
  }

  // Group nodes by surface for fast horizontal walk/jump-over scanning
  const bySurface = new Map();
  for (const n of nodes) {
    if (!bySurface.has(n.sIdx)) bySurface.set(n.sIdx, []);
    bySurface.get(n.sIdx).push(n);
  }

  // Precompute ladder contacts for each node
  const ladders = room.ladders || [];
  const ladderNodes = ladders.map(() => []);
  for (const n of nodes) {
    for (let li = 0; li < ladders.length; li++) {
      const l = ladders[li];
      if (
        n.x >= l.x - 16 &&
        n.x <= l.x + l.w + 16 &&
        n.y >= l.y - 4 &&
        n.y <= l.y + l.h + 10
      ) {
        ladderNodes[li].push(n);
      }
    }
  }

  // 4. BFS from startNode
  const visited = new Uint8Array(nodes.length);
  const queue = [startNode];
  visited[startNode.id] = 1;
  let head = 0;

  while (head < queue.length) {
    const cur = queue[head++];
    if (reachesExit(cur)) return true;

    // A) Horizontal walk & jumping over low tactical walls on the same surface
    const sameSurf = bySurface.get(cur.sIdx) || [];
    for (const nxt of sameSurf) {
      if (visited[nxt.id]) continue;
      const dx = Math.abs(nxt.x - cur.x);
      if (dx === 0 || dx > maxJumpGap) continue;

      // Check maximum wall height along the span [cur.x, nxt.x]
      const minX = Math.min(cur.x, nxt.x);
      const maxX = Math.max(cur.x, nxt.x);
      let maxObstacle = 0;
      for (let sx = minX; sx <= maxX; sx += stepX) {
        const obs = getObstructionHeight(sx, cur.y);
        if (obs > maxObstacle) maxObstacle = obs;
      }

      if (maxObstacle === 0 && dx <= stepX * 2) {
        visited[nxt.id] = 1;
        queue.push(nxt);
      } else if (maxObstacle > 0 && maxObstacle <= maxJumpH) {
        // Must have enough overhead clearance above the low wall to vault it
        if (!isVerticallyBlocked(Math.round((minX + maxX) * 0.5), cur.y - maxObstacle - heroH, cur.y - maxObstacle, null)) {
          visited[nxt.id] = 1;
          queue.push(nxt);
        }
      }
    }

    // B) Ladder climb up / down to any connected floor in the ladder shaft
    for (let li = 0; li < ladders.length; li++) {
      const l = ladders[li];
      if (
        cur.x >= l.x - 16 &&
        cur.x <= l.x + l.w + 16 &&
        cur.y >= l.y - 4 &&
        cur.y <= l.y + l.h + 10
      ) {
        for (const nxt of ladderNodes[li]) {
          if (visited[nxt.id]) continue;
          const topY = Math.min(cur.y, nxt.y) - heroH * 0.5;
          const botY = Math.max(cur.y, nxt.y) - 4;
          if (!isVerticallyBlocked(l.x + l.w * 0.5, topY, botY, l)) {
            visited[nxt.id] = 1;
            queue.push(nxt);
          }
        }
      }
    }

    // C) Jumping up to nearby ledges / one-way platforms, or dropping down to lower floors
    for (const nxt of nodes) {
      if (visited[nxt.id] || nxt.sIdx === cur.sIdx) continue;
      const dx = Math.abs(nxt.x - cur.x);
      if (dx > maxJumpGap) continue;

      const dy = cur.y - nxt.y; // > 0 means jumping UP; < 0 means dropping DOWN
      if (dy > 0 && dy <= maxJumpH) {
        // Jumping up onto a platform or ledge
        const midX = Math.round((cur.x + nxt.x) * 0.5);
        if (!isVerticallyBlocked(midX, nxt.y - heroH, cur.y - 4, null)) {
          visited[nxt.id] = 1;
          queue.push(nxt);
        }
      } else if (dy < 0) {
        // Dropping down through a one-way platform or stepping off a ledge
        const canDrop = (cur.kind === "oneWay" && dx <= 24) || dx >= 16;
        if (canDrop) {
          const dropX = (cur.kind === "oneWay" && dx <= 24) ? cur.x : nxt.x;
          if (!isVerticallyBlocked(dropX, cur.y + 4, nxt.y - 4, null)) {
            visited[nxt.id] = 1;
            queue.push(nxt);
          }
        }
      }
    }
  }

  return false;
}

// ============================================================================
// ARCHITECTURAL HELPERS (Exact Integer Tiers — Zero Pixel Misalignment)
// ============================================================================
function buildTierFloor(solids, oneWay, xStart, xEnd, floorY, thickness, hatches) {
  const sortedHatches = [...(hatches || [])]
    .filter(h => h.x + h.w > xStart + 8 && h.x < xEnd - 8)
    .sort((a, b) => a.x - b.x);

  let cursor = xStart;
  for (const h of sortedHatches) {
    const hx0 = Math.max(xStart, h.x);
    const hx1 = Math.min(xEnd, h.x + h.w);
    if (hx0 > cursor) {
      solids.push({ x: cursor, y: floorY, w: hx0 - cursor, h: thickness, hatched: true });
    }
    if (hx1 > hx0) {
      oneWay.push({ x: hx0, y: floorY, w: hx1 - hx0, h: 10 });
    }
    cursor = hx1;
  }
  if (xEnd > cursor) {
    solids.push({ x: cursor, y: floorY, w: xEnd - cursor, h: thickness, hatched: true });
  }
}

function addShaftLadder(ladders, hatchMap, floorKey, upperY, lowerY, centerX) {
  const hatchW = 86;
  const ladderW = 34;
  const hx = Math.round(centerX - hatchW * 0.5);
  if (hatchMap && floorKey) {
    hatchMap[floorKey].push({ x: hx, w: hatchW });
  }
  ladders.push({
    x: hx + Math.round((hatchW - ladderW) * 0.5),
    y: upperY - 18,
    w: ladderW,
    h: (lowerY - upperY) + 18
  });
}

function addHighDividerWall(solids, wallX, floorY, height) {
  const h = Math.max(PROCGEN_PARAMS.highWallMinHeight, Math.min(PROCGEN_PARAMS.highWallMaxHeight, height));
  solids.push({
    x: Math.round(wallX),
    y: floorY - h,
    w: 24,
    h,
    hatched: true
  });
}

function addLowCoverWall(solids, wallX, floorY, height = PROCGEN_PARAMS.lowWallHeight) {
  const h = Math.max(44, Math.min(64, height));
  solids.push({
    x: Math.round(wallX),
    y: floorY - h,
    w: 22,
    h,
    hatched: true
  });
}

// ============================================================================
// MAIN PROCEDURAL GENERATOR (Seeded Archetypes + Guaranteed Pathability)
// ============================================================================
function generateProceduralScreen(runSeed, stageIndex) {
  const heroH = (typeof hero !== "undefined" && hero.h) ? hero.h : 56;
  const worldW = W;        // 984
  const worldH = H;        // 621
  const wallThick = 24;
  const innerL = wallThick;          // 24
  const innerR = worldW - wallThick; // 960

  // Exact integer floor Y elevations (180px tier spacing -> zero 1-2px drift)
  const Y1 = worldH - 34; // 587 (1/F Ground Floor)
  const Y2 = 407;         // 407 (2/F Middle Floor, 180px above 1/F)
  const Y3 = 227;         // 227 (3/F Top Floor, 180px above 2/F)

  const baseSeed = (runSeed ^ Math.imul(stageIndex, 0x9E3779B1)) >>> 0;
  const baseRng = createSeededRng(baseSeed);

  // Rotate archetypes deterministically while still allowing seed variation
  const startArchIdx = (stageIndex + Math.floor(baseRng() * ROOM_ARCHETYPES.length)) % ROOM_ARCHETYPES.length;

  function buildCandidate(attempt) {
    const attemptSeed = (baseSeed + Math.imul(attempt, 0x85EBCA6B)) >>> 0;
    const rng = createSeededRng(attemptSeed);
    const randInt = (min, max) => Math.floor(rng() * (max - min + 1)) + min;
    const snap4 = (val) => Math.round(val / 4) * 4;

    const archetype = ROOM_ARCHETYPES[(startArchIdx + attempt) % ROOM_ARCHETYPES.length];

    const solids = [
      { x: 0, y: 0, w: worldW, h: 28 },
      { x: 0, y: 0, w: wallThick, h: worldH },
      { x: innerR, y: 0, w: wallThick, h: worldH }
    ];
    const oneWay = [];
    const ladders = [];
    const pickups = [];
    const enemies = [];
    const hatchMap = { Y2: [], Y3: [] };
    const spawnZones = []; // { x1, x2, y }

    let spawn = { x: 54, y: Y1 - heroH };
    let exit = { x: innerR - 42, y: Y1 - 72, w: 36, h: 72, dir: "right" };

    if (archetype === "DIVIDED_CITADEL") {
      // Non-jumpable high wall splits 1/F in the center; must ladder up to 2/F, cross over, and ladder down
      const wallX = snap4(randInt(444, 520));
      const leftLadderX = snap4(randInt(210, 320));
      const rightLadderX = snap4(randInt(640, 760));
      const topLadderX = snap4(randInt(440, 530));
      const highH = snap4(randInt(PROCGEN_PARAMS.highWallMinHeight, PROCGEN_PARAMS.highWallMaxHeight));

      addShaftLadder(ladders, hatchMap, "Y2", Y2, Y1, leftLadderX);
      addShaftLadder(ladders, hatchMap, "Y2", Y2, Y1, rightLadderX);
      if (rng() < 0.72) {
        addShaftLadder(ladders, hatchMap, "Y3", Y3, Y2, topLadderX);
      }

      buildTierFloor(solids, oneWay, innerL, innerR, Y1, 34, []);
      buildTierFloor(solids, oneWay, innerL + 48, innerR - 48, Y2, 18, hatchMap.Y2);
      buildTierFloor(solids, oneWay, 240, 744, Y3, 18, hatchMap.Y3);

      // Central non-jumpable high wall on 1/F
      addHighDividerWall(solids, wallX, Y1, highH);

      // Low tactical cover walls to separate enemy groups
      const cover2X = snap4(randInt(370, 580));
      addLowCoverWall(solids, cover2X, Y2);
      const cover1RightX = snap4(randInt(wallX + 90, rightLadderX - 60));
      if (cover1RightX > wallX + 70 && cover1RightX < rightLadderX - 48) {
        addLowCoverWall(solids, cover1RightX, Y1);
      }

      spawn = { x: 54, y: Y1 - heroH };
      exit = { x: innerR - 42, y: Y1 - 72, w: 36, h: 72, dir: "right" };

      spawnZones.push(
        { x1: 230, x2: wallX - 12, y: Y1 },
        { x1: cover1RightX + 28, x2: innerR - 70, y: Y1 },
        { x1: innerL + 64, x2: cover2X - 12, y: Y2 },
        { x1: cover2X + 32, x2: innerR - 64, y: Y2 },
        { x1: 260, x2: 724, y: Y3 }
      );
    } else if (archetype === "ZIGZAG_ASCENT") {
      // Staircase climb: Start 1/F Left -> Ladder Right to 2/F -> Cross Left -> Ladder Left to 3/F -> Exit 3/F Right
      const lad12X = snap4(randInt(740, 845));
      const lad23X = snap4(randInt(130, 235));
      const wall2X = snap4(randInt(540, 660));
      const wall1X = snap4(randInt(380, 480));

      addShaftLadder(ladders, hatchMap, "Y2", Y2, Y1, lad12X);
      addShaftLadder(ladders, hatchMap, "Y3", Y3, Y2, lad23X);

      buildTierFloor(solids, oneWay, innerL, innerR, Y1, 34, []);
      buildTierFloor(solids, oneWay, innerL + 36, innerR - 36, Y2, 18, hatchMap.Y2);
      buildTierFloor(solids, oneWay, innerL + 36, innerR, Y3, 18, hatchMap.Y3);

      // Non-jumpable divider on 2/F right of ladder so player must traverse left to reach 3/F shaft
      addHighDividerWall(solids, wall2X, Y2, 152);
      // Low cover walls on 1/F and 3/F to split enemy charges
      addLowCoverWall(solids, wall1X, Y1);
      addLowCoverWall(solids, snap4(randInt(460, 620)), Y3);

      spawn = { x: 54, y: Y1 - heroH };
      exit = { x: innerR - 42, y: Y3 - 72, w: 36, h: 72, dir: "right" };

      spawnZones.push(
        { x1: wall1X + 32, x2: innerR - 36, y: Y1 },
        { x1: innerL + 50, x2: wall2X - 14, y: Y2 },
        { x1: 310, x2: innerR - 75, y: Y3 }
      );
    } else if (archetype === "UNDERGROUND_BYPASS") {
      // Spawn 2/F Left & Exit 2/F Right, but a non-jumpable high wall seals the center of 2/F -> drop/ladder to 1/F & climb back
      const wall2X = snap4(randInt(440, 520));
      const leftDropX = snap4(randInt(230, 340));
      const rightClimbX = snap4(randInt(640, 760));
      const low1X = snap4(randInt(430, 540));

      addShaftLadder(ladders, hatchMap, "Y2", Y2, Y1, leftDropX);
      addShaftLadder(ladders, hatchMap, "Y2", Y2, Y1, rightClimbX);

      buildTierFloor(solids, oneWay, innerL, innerR, Y1, 34, []);
      buildTierFloor(solids, oneWay, innerL, innerR, Y2, 18, hatchMap.Y2);

      // Optional upper catwalk on 3/F
      if (rng() < 0.65) {
        addShaftLadder(ladders, hatchMap, "Y3", Y3, Y2, snap4(randInt(220, 330)));
        buildTierFloor(solids, oneWay, 170, 520, Y3, 18, hatchMap.Y3);
      }

      // Non-jumpable wall blocking 2/F center
      addHighDividerWall(solids, wall2X, Y2, 154);
      // Low cover wall on 1/F splitting the underground enemy squad
      addLowCoverWall(solids, low1X, Y1);

      spawn = { x: 54, y: Y2 - heroH };
      exit = { x: innerR - 42, y: Y2 - 72, w: 36, h: 72, dir: "right" };

      spawnZones.push(
        { x1: 210, x2: low1X - 14, y: Y1 },
        { x1: low1X + 32, x2: innerR - 40, y: Y1 },
        { x1: wall2X + 34, x2: innerR - 75, y: Y2 }
      );
    } else if (archetype === "TWIN_SHAFTS") {
      // Three full aligned floors with staggered shafts + alternating non-jumpable divider walls
      const leftShaftX = snap4(randInt(220, 320));
      const rightShaftX = snap4(randInt(650, 760));
      const midShaftX = snap4(randInt(450, 520));
      const wall1X = snap4(randInt(470, 560));
      const wall2X = snap4(randInt(310, 400));

      addShaftLadder(ladders, hatchMap, "Y2", Y2, Y1, leftShaftX);
      addShaftLadder(ladders, hatchMap, "Y2", Y2, Y1, rightShaftX);
      addShaftLadder(ladders, hatchMap, "Y3", Y3, Y2, midShaftX);

      buildTierFloor(solids, oneWay, innerL, innerR, Y1, 34, []);
      buildTierFloor(solids, oneWay, innerL + 40, innerR - 40, Y2, 18, hatchMap.Y2);
      buildTierFloor(solids, oneWay, innerL + 80, innerR - 80, Y3, 18, hatchMap.Y3);

      // Non-jumpable divider on 1/F + low cover walls on 2/F & 3/F
      addHighDividerWall(solids, wall1X, Y1, 160);
      addLowCoverWall(solids, wall2X, Y2);
      addLowCoverWall(solids, snap4(randInt(540, 660)), Y3);

      const exitOnTop = rng() < 0.45;
      spawn = { x: 54, y: Y1 - heroH };
      exit = exitOnTop
        ? { x: innerR - 122, y: Y3 - 72, w: 36, h: 72, dir: "right" }
        : { x: innerR - 42, y: Y1 - 72, w: 36, h: 72, dir: "right" };

      spawnZones.push(
        { x1: wall1X + 34, x2: innerR - 75, y: Y1 },
        { x1: innerL + 54, x2: wall2X - 14, y: Y2 },
        { x1: wall2X + 34, x2: innerR - 54, y: Y2 },
        { x1: innerL + 96, x2: innerR - 140, y: Y3 }
      );
    } else {
      // CATACOMB_BRIDGES: Solid islands + red jump-through/drop-through bridges + high-wall gate
      const wall1X = snap4(randInt(460, 530));
      const leftLadX = snap4(randInt(200, 290));
      const rightLadX = snap4(randInt(690, 790));

      addShaftLadder(ladders, hatchMap, "Y2", Y2, Y1, leftLadX);
      addShaftLadder(ladders, hatchMap, "Y2", Y2, Y1, rightLadX);

      buildTierFloor(solids, oneWay, innerL, innerR, Y1, 34, []);
      // Left and right solid decks on 2/F joined by a wide red oneWay bridge in the center
      buildTierFloor(solids, oneWay, innerL + 40, 390, Y2, 18, hatchMap.Y2);
      buildTierFloor(solids, oneWay, 594, innerR - 40, Y2, 18, hatchMap.Y2);
      oneWay.push({ x: 390, y: Y2, w: 204, h: 10 });

      // Upper 3/F lookout platforms linked by a red bridge
      buildTierFloor(solids, oneWay, 220, 420, Y3, 18, []);
      buildTierFloor(solids, oneWay, 564, 764, Y3, 18, []);
      oneWay.push({ x: 420, y: Y3, w: 144, h: 10 });

      addHighDividerWall(solids, wall1X, Y1, 156);
      addLowCoverWall(solids, snap4(randInt(wall1X + 95, rightLadX - 55)), Y1);

      spawn = { x: 54, y: Y1 - heroH };
      exit = { x: innerR - 42, y: Y1 - 72, w: 36, h: 72, dir: "right" };

      spawnZones.push(
        { x1: 220, x2: wall1X - 14, y: Y1 },
        { x1: wall1X + 40, x2: innerR - 75, y: Y1 },
        { x1: 604, x2: innerR - 54, y: Y2 },
        { x1: 240, x2: 740, y: Y3 }
      );
    }

    // Populate enemies cleanly inside valid bounded floor zones (never overlapping spawn or clipping walls)
    const maxRoomEnemies = Math.min(10, 3 + Math.floor(stageIndex * 0.65));
    const giantChance = Math.min(0.32, 0.14 + stageIndex * 0.015);
    const kniferChance = 0.40;

    // Shuffle spawn zones
    for (let i = spawnZones.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [spawnZones[i], spawnZones[j]] = [spawnZones[j], spawnZones[i]];
    }

    for (const zone of spawnZones) {
      if (enemies.length >= maxRoomEnemies) break;
      const zMin = Math.round(zone.x1);
      const zMax = Math.round(zone.x2);
      if (zMax - zMin < 76) continue;

      const groupRoll = rng();
      const desiredGroup = groupRoll < 0.56 ? 1 : (groupRoll < 0.88 ? 2 : 3);
      const groupCount = Math.min(desiredGroup, maxRoomEnemies - enemies.length);
      const span = zMax - zMin;

      for (let g = 0; g < groupCount; g++) {
        const typeRoll = rng();
        let kind = "blade";
        if (typeRoll < giantChance) kind = "giant";
        else if (typeRoll < giantChance + kniferChance) kind = "knifer";

        const cx = Math.round(zMin + ((g + 0.5) / groupCount) * span);
        const enemy = createEnemyInstance(kind, cx, zone.y, zMin, zMax, stageIndex, false);
        const dirSign = rng() < 0.5 ? -1 : 1;
        enemy.vx = dirSign * Math.abs(enemy.vx);
        enemy.facing = dirSign;
        enemy.animTimer = rng() * 6;
        enemies.push(enemy);
      }
    }

    // Every 10th room drops a healing chicken on the last enemy
    if (stageIndex > 0 && stageIndex % 10 === 0 && enemies.length > 0) {
      const hostEnemy = enemies[enemies.length - 1];
      pickups.push({
        type: "chicken",
        x: Math.round(hostEnemy.x + hostEnemy.w * 0.5 - 16),
        y: Math.round(hostEnemy.y + hostEnemy.h - 28),
        w: 32,
        h: 28,
        collected: false
      });
    }

    // Place 1–2 score crowns on elevated tiers
    const crownTiers = [Y2, Y3, Y1];
    const numCrowns = randInt(1, 2);
    for (let p = 0; p < numCrowns; p++) {
      const tierY = crownTiers[(p + stageIndex) % crownTiers.length];
      const px = snap4(randInt(200, 780));
      pickups.push({ type: "crown", x: px, y: tierY - 30, w: 28, h: 26, collected: false });
    }

    const bgPool = ["bg001", "bg002", "bg003"];
    const bgTemplate = bgPool[(stageIndex + randInt(0, 1)) % bgPool.length];

    return {
      id: `random.${String(stageIndex).padStart(2, "0")}`,
      roomType: "RANDOM",
      archetype,
      bgTemplate,
      worldW,
      worldH,
      pageLeft: stageIndex * 2 + 1,
      pageRight: stageIndex * 2 + 2,
      spawn,
      exit,
      solids,
      oneWay,
      ladders,
      pickups,
      enemies
    };
  }

  // Generate and verify passability; retry with shifted seed if any layout fails validation
  for (let attempt = 0; attempt < PROCGEN_PARAMS.maxValidationAttempts; attempt++) {
    const candidate = buildCandidate(attempt);
    if (isRoomPassable(candidate, PROCGEN_PARAMS)) {
      return candidate;
    }
  }

  // Guaranteed-passable fallback room if all randomized retries were rejected
  const fallbackSolids = [
    { x: 0, y: 0, w: worldW, h: 28 },
    { x: 0, y: Y1, w: worldW, h: 34, hatched: true },
    { x: 0, y: 0, w: wallThick, h: worldH },
    { x: innerR, y: 0, w: wallThick, h: worldH }
  ];
  const fallbackOneWay = [];
  const fallbackLadders = [];
  const fbHatches = { Y2: [] };
  addShaftLadder(fallbackLadders, fbHatches, "Y2", Y2, Y1, 260);
  addShaftLadder(fallbackLadders, fbHatches, "Y2", Y2, Y1, 720);
  buildTierFloor(fallbackSolids, fallbackOneWay, 140, 844, Y2, 18, fbHatches.Y2);
  addHighDividerWall(fallbackSolids, 480, Y1, 160);

  return {
    id: `random.${String(stageIndex).padStart(2, "0")}`,
    roomType: "RANDOM",
    archetype: "DIVIDED_CITADEL",
    bgTemplate: ["bg001", "bg002", "bg003"][stageIndex % 3],
    worldW,
    worldH,
    pageLeft: stageIndex * 2 + 1,
    pageRight: stageIndex * 2 + 2,
    spawn: { x: 54, y: Y1 - heroH },
    exit: { x: innerR - 42, y: Y1 - 72, w: 36, h: 72, dir: "right" },
    solids: fallbackSolids,
    oneWay: fallbackOneWay,
    ladders: fallbackLadders,
    pickups: [{ type: "crown", x: 480, y: Y2 - 30, w: 28, h: 26, collected: false }],
    enemies: [
      createEnemyInstance("blade", 360, Y1, 200, 465, stageIndex, false),
      createEnemyInstance("knifer", 560, Y2, 320, 660, stageIndex, false)
    ]
  };
}

function generateBossScreen(transitions) {
  const floorBaseY = H - 34; // 587
  // Low-to-mid stepping-stone red platforms (66px & 94px above ground):
  // High enough to vault over the 138px boss (head at y=449),
  // but low enough that the boss stays aggroed and his axe swing (y=471..581) still threatens stationary campers.
  const outerPlatY = floorBaseY - 66; // 521 (single-jump reachable directly from floor)
  const innerPlatY = floorBaseY - 94; // 493 (28px step-up from outer platforms)

  return {
    id: "boss_chamber",
    roomType: "BOSS",
    bgTemplate: "bg003",
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
      { x: 165, y: outerPlatY, w: 112, h: 12 }, // Left step-up
      { x: 345, y: innerPlatY, w: 112, h: 12 }, // Center-left vault
      { x: 527, y: innerPlatY, w: 112, h: 12 }, // Center-right vault
      { x: 707, y: outerPlatY, w: 112, h: 12 }  // Right step-up
    ],
    ladders: [],
    pickups: [
      { type: "chicken", x: 204, y: outerPlatY - 28, w: 34, h: 28, collected: false },
      { type: "chicken", x: 746, y: outerPlatY - 28, w: 34, h: 28, collected: false }
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
    bgTemplate: "bg002",
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