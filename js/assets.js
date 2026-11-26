// js/assets.js //
"use strict";

const BGM_MASTER_VOLUME = 0.40; // 40% of actual volume for all game music
const SFX_MASTER_GAIN = 2.0;    // +100% (2x) volume for all sound effects

function loadKeyedSprite(src, keyBg = true, eraseOriginalGun = false) {
  const entry = { img: new Image(), canvas: null, loaded: false };
  entry.img.onload = () => {
    const w = entry.img.naturalWidth;
    const h = entry.img.naturalHeight;
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const octx = off.getContext("2d");
    octx.drawImage(entry.img, 0, 0);

    if (eraseOriginalGun) {
      octx.clearRect(
        Math.floor(w * 0.65),
        Math.floor(h * 0.36),
        Math.ceil(w * 0.35),
        Math.ceil(h * 0.20)
      );
    }

    try {
      if (keyBg) {
        const imgData = octx.getImageData(0, 0, w, h);
        const d = imgData.data;
        const bgR = d[0], bgG = d[1], bgB = d[2];
        const visited = new Uint8Array(w * h);
        const queue = new Int32Array(w * h);
        let head = 0;
        let tail = 0;

        const isBgPixel = (idx) => {
          const p = idx * 4;
          if (d[p + 3] === 0) return true;
          const r = d[p], g = d[p + 1], b = d[p + 2];
          const dist = Math.hypot(r - bgR, g - bgG, b - bgB);
          const isNearWhite = r > 232 && g > 232 && b > 232;
          return dist < 32 || isNearWhite;
        };

        for (let x = 0; x < w; x++) {
          const topIdx = x;
          const botIdx = (h - 1) * w + x;
          if (!visited[topIdx] && isBgPixel(topIdx)) { visited[topIdx] = 1; queue[tail++] = topIdx; }
          if (!visited[botIdx] && isBgPixel(botIdx)) { visited[botIdx] = 1; queue[tail++] = botIdx; }
        }
        for (let y = 1; y < h - 1; y++) {
          const leftIdx = y * w;
          const rightIdx = y * w + (w - 1);
          if (!visited[leftIdx] && isBgPixel(leftIdx)) { visited[leftIdx] = 1; queue[tail++] = leftIdx; }
          if (!visited[rightIdx] && isBgPixel(rightIdx)) { visited[rightIdx] = 1; queue[tail++] = rightIdx; }
        }

        while (head < tail) {
          const idx = queue[head++];
          d[idx * 4 + 3] = 0;

          const x = idx % w;
          const y = (idx - x) / w;

          if (x > 0) {
            const n = idx - 1;
            if (!visited[n] && isBgPixel(n)) { visited[n] = 1; queue[tail++] = n; }
          }
          if (x + 1 < w) {
            const n = idx + 1;
            if (!visited[n] && isBgPixel(n)) { visited[n] = 1; queue[tail++] = n; }
          }
          if (y > 0) {
            const n = idx - w;
            if (!visited[n] && isBgPixel(n)) { visited[n] = 1; queue[tail++] = n; }
          }
          if (y + 1 < h) {
            const n = idx + w;
            if (!visited[n] && isBgPixel(n)) { visited[n] = 1; queue[tail++] = n; }
          }
        }

        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const idx = y * w + x;
            if (visited[idx]) continue;
            const p = idx * 4;
            if (d[p + 3] === 0) continue;
            if (visited[idx - 1] || visited[idx + 1] || visited[idx - w] || visited[idx + w]) {
              const r = d[p], g = d[p + 1], b = d[p + 2];
              const dist = Math.hypot(r - bgR, g - bgG, b - bgB);
              if (dist < 56) {
                d[p + 3] = Math.round(((dist - 24) / 32) * 255);
              }
            }
          }
        }

        octx.putImageData(imgData, 0, 0);
      }
    } catch (_) {
      if (eraseOriginalGun) {
        octx.fillStyle = "#f5f1e6";
        octx.fillRect(
          Math.floor(w * 0.65),
          Math.floor(h * 0.36),
          Math.ceil(w * 0.35),
          Math.ceil(h * 0.20)
        );
      }
    }

    entry.canvas = off;
    entry.loaded = true;
  };
  entry.img.onerror = () => { entry.loaded = false; };
  entry.img.src = src;
  return entry;
}

function loadSpriteFloodFill(primarySrc, fallbackSrc) {
  const entry = { img: new Image(), canvas: null, loaded: false };

  function processImage(img) {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const octx = off.getContext("2d");
    octx.drawImage(img, 0, 0);

    let minX = w, minY = h, maxX = 0, maxY = 0;
    try {
      const imgData = octx.getImageData(0, 0, w, h);
      const d = imgData.data;
      const bgR = d[0], bgG = d[1], bgB = d[2];
      const visited = new Uint8Array(w * h);
      const queue = new Int32Array(w * h);
      let head = 0;
      let tail = 0;

      const isBgPixel = (idx) => {
        const p = idx * 4;
        if (d[p + 3] === 0) return true;
        const r = d[p], g = d[p + 1], b = d[p + 2];
        const dist = Math.hypot(r - bgR, g - bgG, b - bgB);
        const isNearWhite = r > 235 && g > 235 && b > 235;
        return dist < 28 || isNearWhite;
      };

      for (let x = 0; x < w; x++) {
        const topIdx = x;
        const botIdx = (h - 1) * w + x;
        if (!visited[topIdx] && isBgPixel(topIdx)) { visited[topIdx] = 1; queue[tail++] = topIdx; }
        if (!visited[botIdx] && isBgPixel(botIdx)) { visited[botIdx] = 1; queue[tail++] = botIdx; }
      }
      for (let y = 1; y < h - 1; y++) {
        const leftIdx = y * w;
        const rightIdx = y * w + (w - 1);
        if (!visited[leftIdx] && isBgPixel(leftIdx)) { visited[leftIdx] = 1; queue[tail++] = leftIdx; }
        if (!visited[rightIdx] && isBgPixel(rightIdx)) { visited[rightIdx] = 1; queue[tail++] = rightIdx; }
      }

      while (head < tail) {
        const idx = queue[head++];
        d[idx * 4 + 3] = 0;
        const x = idx % w;
        const y = (idx - x) / w;
        if (x > 0 && !visited[idx - 1] && isBgPixel(idx - 1)) { visited[idx - 1] = 1; queue[tail++] = idx - 1; }
        if (x + 1 < w && !visited[idx + 1] && isBgPixel(idx + 1)) { visited[idx + 1] = 1; queue[tail++] = idx + 1; }
        if (y > 0 && !visited[idx - w] && isBgPixel(idx - w)) { visited[idx - w] = 1; queue[tail++] = idx - w; }
        if (y + 1 < h && !visited[idx + w] && isBgPixel(idx + w)) { visited[idx + w] = 1; queue[tail++] = idx + w; }
      }

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = y * w + x;
          if (!visited[idx] && d[idx * 4 + 3] > 0) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      octx.putImageData(imgData, 0, 0);

      if (maxX > minX && maxY > minY) {
        const cropW = maxX - minX + 1;
        const cropH = maxY - minY + 1;
        const cropped = document.createElement("canvas");
        cropped.width = cropW;
        cropped.height = cropH;
        cropped.getContext("2d").drawImage(off, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
        entry.canvas = cropped;
        entry.loaded = true;
        return;
      }
    } catch (_) {}

    entry.canvas = off;
    entry.loaded = true;
  }

  entry.img.onload = () => processImage(entry.img);
  entry.img.onerror = () => {
    if (fallbackSrc && entry.img.src.indexOf(fallbackSrc) === -1) {
      entry.img.src = fallbackSrc;
    } else {
      entry.loaded = false;
    }
  };
  entry.img.src = primarySrc;
  return entry;
}

// Extracts the 3 treasure chest icons side-by-side from Stages/001/treasure.jpeg into separate cropped canvases
function loadTreasureSheetSprite(sources) {
  const entry = { img: new Image(), items: [], loaded: false };
  let srcIndex = 0;

  function cropSlice(off, d, w, h, xStart, xEnd) {
    let minX = xEnd, maxX = xStart, minY = h, maxY = 0;
    for (let y = 0; y < h; y++) {
      for (let x = xStart; x <= xEnd; x++) {
        if (d[(y * w + x) * 4 + 3] > 16) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX <= minX || maxY <= minY) return null;
    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;
    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    c.getContext("2d").drawImage(off, minX, minY, cw, ch, 0, 0, cw, ch);
    return c;
  }

  function processSheet(img) {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const octx = off.getContext("2d");
    octx.drawImage(img, 0, 0);

    try {
      const imgData = octx.getImageData(0, 0, w, h);
      const d = imgData.data;
      const bgR = d[0], bgG = d[1], bgB = d[2];
      const visited = new Uint8Array(w * h);
      const queue = new Int32Array(w * h);
      let head = 0;
      let tail = 0;

      const isBgPixel = (idx) => {
        const p = idx * 4;
        if (d[p + 3] === 0) return true;
        const r = d[p], g = d[p + 1], b = d[p + 2];
        const dist = Math.hypot(r - bgR, g - bgG, b - bgB);
        const isNearWhite = r > 236 && g > 236 && b > 236;
        return dist < 24 || isNearWhite;
      };

      for (let x = 0; x < w; x++) {
        const topIdx = x;
        const botIdx = (h - 1) * w + x;
        if (!visited[topIdx] && isBgPixel(topIdx)) { visited[topIdx] = 1; queue[tail++] = topIdx; }
        if (!visited[botIdx] && isBgPixel(botIdx)) { visited[botIdx] = 1; queue[tail++] = botIdx; }
      }
      for (let y = 1; y < h - 1; y++) {
        const leftIdx = y * w;
        const rightIdx = y * w + (w - 1);
        if (!visited[leftIdx] && isBgPixel(leftIdx)) { visited[leftIdx] = 1; queue[tail++] = leftIdx; }
        if (!visited[rightIdx] && isBgPixel(rightIdx)) { visited[rightIdx] = 1; queue[tail++] = rightIdx; }
      }

      while (head < tail) {
        const idx = queue[head++];
        d[idx * 4 + 3] = 0;
        const x = idx % w;
        const y = (idx - x) / w;
        if (x > 0 && !visited[idx - 1] && isBgPixel(idx - 1)) { visited[idx - 1] = 1; queue[tail++] = idx - 1; }
        if (x + 1 < w && !visited[idx + 1] && isBgPixel(idx + 1)) { visited[idx + 1] = 1; queue[tail++] = idx + 1; }
        if (y > 0 && !visited[idx - w] && isBgPixel(idx - w)) { visited[idx - w] = 1; queue[tail++] = idx - w; }
        if (y + 1 < h && !visited[idx + w] && isBgPixel(idx + w)) { visited[idx + w] = 1; queue[tail++] = idx + w; }
      }

      octx.putImageData(imgData, 0, 0);

      // Find contiguous horizontal column runs for each of the 3 treasure chests
      const colHasInk = new Uint8Array(w);
      for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
          if (d[(y * w + x) * 4 + 3] > 24) {
            colHasInk[x] = 1;
            break;
          }
        }
      }

      const rawSegments = [];
      let segStart = -1;
      for (let x = 0; x < w; x++) {
        if (colHasInk[x] && segStart === -1) {
          segStart = x;
        } else if (!colHasInk[x] && segStart !== -1) {
          if (x - segStart >= 16) rawSegments.push([segStart, x - 1]);
          segStart = -1;
        }
      }
      if (segStart !== -1 && w - segStart >= 16) {
        rawSegments.push([segStart, w - 1]);
      }

      const extracted = [];
      if (rawSegments.length === 3) {
        for (const [sx, ex] of rawSegments) {
          const itemCanvas = cropSlice(off, d, w, h, sx, ex);
          if (itemCanvas) extracted.push(itemCanvas);
        }
      } else {
        // Fallback: split into 3 equal horizontal thirds and tight-crop each
        const thirdW = Math.floor(w / 3);
        for (let k = 0; k < 3; k++) {
          const sx = k * thirdW;
          const ex = k === 2 ? w - 1 : (k + 1) * thirdW - 1;
          const itemCanvas = cropSlice(off, d, w, h, sx, ex);
          if (itemCanvas) extracted.push(itemCanvas);
        }
      }

      if (extracted.length > 0) {
        entry.items = extracted;
        entry.loaded = true;
        return;
      }
    } catch (_) {}

    // Tainted-canvas fallback if opened directly via file:// without a local server
    const thirdW = Math.floor(w / 3);
    for (let k = 0; k < 3; k++) {
      const c = document.createElement("canvas");
      c.width = thirdW;
      c.height = h;
      c.getContext("2d").drawImage(img, k * thirdW, 0, thirdW, h, 0, 0, thirdW, h);
      entry.items.push(c);
    }
    entry.loaded = true;
  }

  function tryNextSource() {
    if (srcIndex >= sources.length) {
      entry.loaded = false;
      return;
    }
    entry.img.src = sources[srcIndex++];
  }

  entry.img.onload = () => processSheet(entry.img);
  entry.img.onerror = () => tryNextSource();
  tryNextSource();
  return entry;
}

function loadOptionalImage(src) {
  const img = new Image();
  img.loaded = false;
  img.onload = () => { img.loaded = true; };
  img.onerror = () => { img.loaded = false; };
  img.src = src;
  return img;
}

const CHAR_LAYERS = {
  base:       loadKeyedSprite("./char/normal_char.jpg", true, true),
  blind:      loadKeyedSprite("./char/blind.jpeg", true, true),
  deaf:       loadKeyedSprite("./char/deaf.jpeg", true, true),
  prosthesis: loadKeyedSprite("./char/prosthesis.jpeg", true, true),
  tremor:     loadKeyedSprite("./char/tremor.jpeg", true, true),
  asthma:     loadKeyedSprite("./char/asthma.jpeg", true, true)
};

const TRAIT_BODY_ZONES = {
  blind:      [0.505, 0.14, 0.125, 0.09],
  deaf:       [0.380, 0.14, 0.125, 0.13],
  asthma:     [0.240, 0.34, 0.400, 0.32],
  tremor:     [0.160, 0.36, 0.460, 0.34],
  prosthesis: [0.160, 0.64, 0.720, 0.36]
};

function loadGroundEnemySprite(primarySrc, fallbackSrc, floorCutoffRatio = 0.785) {
  const entry = { img: new Image(), canvas: null, loaded: false };

  function processImage(img) {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const octx = off.getContext("2d");
    octx.drawImage(img, 0, 0);

    const floorCutoffY = Math.floor(h * floorCutoffRatio);
    if (floorCutoffY < h) {
      octx.clearRect(0, floorCutoffY, w, h - floorCutoffY);
    }

    let minX = w, minY = floorCutoffY, maxX = 0, maxY = 0;
    try {
      const imgData = octx.getImageData(0, 0, w, floorCutoffY);
      const d = imgData.data;
      const bgR = d[0], bgG = d[1], bgB = d[2];

      for (let y = 0; y < floorCutoffY; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          if (d[i + 3] === 0) continue;
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const dist = Math.hypot(r - bgR, g - bgG, b - bgB);
          const isNearWhite = r > 232 && g > 232 && b > 232;

          if (dist < 28 || isNearWhite) {
            d[i + 3] = 0;
          } else {
            if (dist < 46) d[i + 3] = Math.round(((dist - 28) / 18) * 255);
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      octx.putImageData(imgData, 0, 0);

      if (maxX > minX && maxY > minY) {
        const cropW = maxX - minX + 1;
        const cropH = maxY - minY + 1;
        const cropped = document.createElement("canvas");
        cropped.width = cropW;
        cropped.height = cropH;
        cropped.getContext("2d").drawImage(off, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
        entry.canvas = cropped;
        entry.loaded = true;
        return;
      }
    } catch (_) {}

    entry.canvas = off;
    entry.loaded = true;
  }

  entry.img.onload = () => processImage(entry.img);
  entry.img.onerror = () => {
    if (fallbackSrc && entry.img.src.indexOf(fallbackSrc) === -1) {
      entry.img.src = fallbackSrc;
    } else {
      entry.loaded = false;
    }
  };
  entry.img.src = primarySrc;
  return entry;
}

const EXTRA_SPRITES = {
  giant:        loadGroundEnemySprite("./char/giant.jpeg", "./char/giant.png", 0.785),
  giantAxe:     loadOptionalImage("./char/giant_axe.png"),
  blade:        loadGroundEnemySprite("./char/blade.jpeg", "./char/blade_enemy.png", 0.785),
  alien:        loadGroundEnemySprite("./char/alien.png", "./char/alien.jpeg", 0.90),
  hat:          loadGroundEnemySprite("./char/hat.png", "./char/hat.jpeg", 1.0),
  cannonball:   loadSpriteFloodFill("./char/cannonball.png", "./char/cannonball.jpeg"),
  chicken:      loadOptionalImage("./char/chicken.png"),
  bone:         loadOptionalImage("./char/bone.png"),
  crown:        loadOptionalImage("./char/crown.png"),
  treasure:     loadOptionalImage("./char/treasure.png"),
  treasureSheet: loadTreasureSheetSprite([
    "./Stages/001/treasure.jpeg",
    "./stage/001/treasure.jpeg",
    "./Stages/001/treasure.jpg",
    "./Stages/001/treasure.png"
  ])
};

// Loads background templates trying .jpg / .jpeg / .png automatically
function loadImageWithExtFallback(basePathNoExt, exts = [".jpg", ".jpeg", ".png"]) {
  const img = new Image();
  img.loaded = false;
  let idx = 0;

  function tryLoad() {
    if (idx >= exts.length) {
      img.loaded = false;
      return;
    }
    img.src = `${basePathNoExt}${exts[idx++]}`;
  }

  img.onload = () => { img.loaded = true; };
  img.onerror = () => tryLoad();
  tryLoad();
  return img;
}

const STAGE_001_BG_TEMPLATES = {
  bg001: loadImageWithExtFallback("./Stages/001/bg/bg001"),
  bg002: loadImageWithExtFallback("./Stages/001/bg/bg002"),
  bg003: loadImageWithExtFallback("./Stages/001/bg/bg003")
};

function ensureStartScreenAlien(scr) {
  if (!scr) return;
  if (!scr.bgTemplate) scr.bgTemplate = "bg001";
  scr.enemies = (scr.enemies || []).filter(e => e.kind !== "blade" && e.kind !== "alien");
  scr.pickups = (scr.pickups || []).filter(p => p.type !== "hat");

  const alienX = 560;
  let floorY = (typeof H === "number" ? H - 34 : 548);
  if (Array.isArray(scr.solids)) {
    const floorSolid = scr.solids.find(s => s.w > 80 && s.y > 120 && alienX >= s.x && alienX <= s.x + s.w);
    if (floorSolid) floorY = floorSolid.y;
  }

  scr.enemies.push({
    kind: "alien",
    name: "頂帽大炮",
    x: alienX,
    y: floorY - 76,
    w: 44,
    h: 76,
    hp: 60,
    maxHp: 60,
    facing: -1,
    hasFiredCannon: false,
    cannonWindingUp: false,
    cannonWindupTimer: 0,
    alive: true
  });
  scr._alienSpawned = true;
}

if (typeof STAGE_001_DEFAULT !== "undefined") {
  STAGE_001_DEFAULT.stageName = "RUIN CAVE";
  STAGE_001_DEFAULT.bgm = "music/music001.mp3";
  if (Array.isArray(STAGE_001_DEFAULT.screens)) {
    ensureStartScreenAlien(STAGE_001_DEFAULT.screens[0]);
  }
}
if (typeof stageManager !== "undefined" && stageManager.data) {
  stageManager.data.stageName = "RUIN CAVE";
  if (!stageManager.data.bgm) stageManager.data.bgm = "music/music001.mp3";
  if (Array.isArray(stageManager.data.screens)) {
    ensureStartScreenAlien(stageManager.data.screens[0]);
  }
}

function createStage001BgmAudio(src = "./Stages/001/music/music001.mp3") {
  const audio = new Audio(src);
  audio.loop = true;
  audio.volume = BGM_MASTER_VOLUME;
  return audio;
}

if (typeof stageManager !== "undefined" && !stageManager.bgmAudio) {
  stageManager.bgmAudio = createStage001BgmAudio("./Stages/001/music/music001.mp3");
}

function resolveStageBgmPath(stageFolder, bgmField) {
  if (!bgmField) return `${stageFolder}/music/music001.mp3`;
  const clean = String(bgmField).replace(/^\.?\//, "");
  if (clean.startsWith("Stages/") || clean.startsWith("BGM/")) return `./${clean}`;
  if (clean.includes("/")) return `${stageFolder}/${clean}`;
  return `${stageFolder}/music/${clean}`;
}

async function initStage001() {
  stageManager.stageFolder = "./Stages/001";
  try {
    const res = await fetch(`${stageManager.stageFolder}/stage.json`, { cache: "no-store" });
    if (res.ok) {
      const parsed = await res.json();
      if (parsed && Array.isArray(parsed.screens) && parsed.screens.length > 0) {
        stageManager.data = {
          ...STAGE_001_DEFAULT,
          ...parsed,
          stageName: parsed.stageName || parsed.title || "RUIN CAVE",
          bgm: parsed.bgm || "music/music001.mp3"
        };
      }
    }
  } catch (_) {}

  if (stageManager.data) {
    if (!stageManager.data.stageName) stageManager.data.stageName = "RUIN CAVE";
    if (!stageManager.data.bgm) stageManager.data.bgm = "music/music001.mp3";
    if (Array.isArray(stageManager.data.screens)) {
      ensureStartScreenAlien(stageManager.data.screens[0]);
    }
  }
  if (typeof game !== "undefined" && game.activeScreen && game.roomType === "START" && game.transitions === 0 && !hero.hasMissileHat) {
    ensureStartScreenAlien(game.activeScreen);
  }

  stageManager.bgImages = {};
  stageManager.data.screens.forEach((scr, idx) => {
    const key = scr.id || scr.file || String(idx);
    const imgFile = scr.image || scr.file;
    if (imgFile) {
      stageManager.bgImages[key] = loadOptionalImage(`${stageManager.stageFolder}/${imgFile}`);
    }
  });

  const resolvedBgmSrc = resolveStageBgmPath(stageManager.stageFolder, stageManager.data?.bgm);
  if (!stageManager.bgmAudio) {
    stageManager.bgmAudio = createStage001BgmAudio(resolvedBgmSrc);
  } else if (!stageManager.bgmAudio.src.endsWith(resolvedBgmSrc.replace(/^\.\//, ""))) {
    stageManager.bgmAudio.pause();
    stageManager.bgmAudio = createStage001BgmAudio(resolvedBgmSrc);
  }
  SFX.syncBgm();
}

function createTitleBgmAudio() {
  const audio = new Audio("./BGM/char_select.mp3");
  audio.loop = true;
  audio.volume = BGM_MASTER_VOLUME;
  return audio;
}

const SFX = {
  ctx: null,
  muted: false,
  selectBgm: createTitleBgmAudio(),
  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    this.syncBgm();
  },
  syncBgm() {
    const stageBgm = typeof stageManager !== "undefined" ? stageManager.bgmAudio : null;
    const titleBgm = this.selectBgm;
    const state = typeof game !== "undefined" ? game.state : "SELECT";

    if (this.muted) {
      if (titleBgm && !titleBgm.paused) titleBgm.pause();
      if (stageBgm && !stageBgm.paused) stageBgm.pause();
      return;
    }

    if (state === "SELECT") {
      if (stageBgm && !stageBgm.paused) {
        stageBgm.pause();
        stageBgm.currentTime = 0;
      }
      if (titleBgm) {
        titleBgm.volume = BGM_MASTER_VOLUME;
        if (titleBgm.paused) titleBgm.play().catch(() => {});
      }
    } else if (state === "PLAY" || state === "VICTORY_WALK") {
      if (titleBgm && !titleBgm.paused) {
        titleBgm.pause();
        titleBgm.currentTime = 0;
      }
      if (stageBgm) {
        const traitScale = (typeof hero !== "undefined" && hero.stats?.bgmVolumeScale != null)
          ? hero.stats.bgmVolumeScale
          : 1.0;
        stageBgm.volume = Math.max(0, Math.min(1, BGM_MASTER_VOLUME * traitScale));
        if (stageBgm.paused) stageBgm.play().catch(() => {});
      }
    } else {
      if (titleBgm && !titleBgm.paused) titleBgm.pause();
      if (stageBgm && !stageBgm.paused) stageBgm.pause();
    }
  },

  toggleMute() {
    this.muted = !this.muted;
    this.syncBgm();
  },

  beep(freq, dur, type = "square", gainVal = 0.08, slideTo = null) {
    if (this.muted || !this.ctx) return;
    const deafMult = hero.traits.deaf ? (hero.stats?.sfxGainMultiplier ?? 0.30) : 1.0;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * (hero.traits.deaf ? 0.68 : 1), t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(Math.min(1.0, gainVal * deafMult * SFX_MASTER_GAIN), t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  },
  playVictoryFanfare() {
    if (this.muted || !this.ctx) return;
    const deafMult = hero.traits.deaf ? (hero.stats?.sfxGainMultiplier ?? 0.30) : 1.0;
    const notes = [
      { f: 523.25, t: 0.00, d: 0.14 },
      { f: 659.25, t: 0.14, d: 0.14 },
      { f: 783.99, t: 0.28, d: 0.14 },
      { f: 1046.5, t: 0.42, d: 0.32 },
      { f: 783.99, t: 0.78, d: 0.16 },
      { f: 1046.5, t: 0.96, d: 0.62 }
    ];
    const now = this.ctx.currentTime;
    for (const n of notes) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(n.f * (hero.traits.deaf ? 0.85 : 1), now + n.t);
      gain.gain.setValueAtTime(Math.min(1.0, 0.11 * deafMult * SFX_MASTER_GAIN), now + n.t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d);
    }
  }
};

// Attempt title BGM immediately at game start and unlock on first user interaction
SFX.syncBgm();
["pointerdown", "keydown"].forEach((evt) => {
  window.addEventListener(evt, () => SFX.unlock(), { passive: true });
});
setInterval(() => SFX.syncBgm(), 250);

initTraitsJson();
initStage001();
