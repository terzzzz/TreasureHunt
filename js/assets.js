// js/assets.js //
"use strict";

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

    // Erase ONLY the protruding rifle barrel to the right of the chest/knee (x >= 0.65, y 0.36..0.56)
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
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] === 0) continue;
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const dist = Math.hypot(r - bgR, g - bgG, b - bgB);
          const isNearWhite = r > 235 && g > 235 && b > 235;
          if (dist < 26 || isNearWhite) {
            d[i + 3] = 0;
          } else if (dist < 44) {
            d[i + 3] = Math.round(((dist - 26) / 18) * 255);
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
  blind:      [0.18, 0.02, 0.56, 0.36],
  deaf:       [0.10, 0.04, 0.50, 0.36],
  asthma:     [0.24, 0.34, 0.40, 0.32],
  tremor:     [0.16, 0.36, 0.46, 0.34],
  prosthesis: [0.16, 0.64, 0.72, 0.36]
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

    // Strip the dark ground strip at the bottom of the source image if present
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
  giant:    loadGroundEnemySprite("./char/giant.jpeg", "./char/giant.png", 0.785),
  giantAxe: loadOptionalImage("./char/giant_axe.png"),
  blade:    loadGroundEnemySprite("./char/blade.jpeg", "./char/blade_enemy.png", 0.785),
  alien:    loadGroundEnemySprite("./char/alien.png", "./char/alien.jpeg", 0.90),
  hat:      loadGroundEnemySprite("./char/hat.png", "./char/hat.jpeg", 1.0),
  chicken:  loadOptionalImage("./char/chicken.png"),
  bone:     loadOptionalImage("./char/bone.png"),
  crown:    loadOptionalImage("./char/crown.png"),
  treasure: loadOptionalImage("./char/treasure.png")
};

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
          stageName: parsed.stageName || parsed.title || STAGE_001_DEFAULT.stageName
        };
      }
    }
  } catch (_) {}

  // Guarantee the 頂帽大炮 Alien always spawns in start.jpeg (screen 0)
  const startScr = stageManager.data.screens[0];
  if (startScr) {
    startScr.enemies = startScr.enemies || [];
    startScr.pickups = (startScr.pickups || []).filter(p => p.type !== "hat");
    if (!startScr.enemies.some(e => e.kind === "alien")) {
      startScr.enemies.push({
        kind: "alien",
        name: "頂帽大炮",
        x: 560,
        y: 548 - 76,
        w: 44,
        h: 76,
        hp: 60,
        maxHp: 60,
        facing: -1,
        alive: true
      });
    }
  }

  stageManager.bgImages = {};
  stageManager.data.screens.forEach((scr, idx) => {
    const key = scr.id || scr.file || String(idx);
    const imgFile = scr.image || scr.file;
    if (imgFile) {
      stageManager.bgImages[key] = loadOptionalImage(`${stageManager.stageFolder}/${imgFile}`);
    }
  });

  if (stageManager.data.bgm) {
    const audio = new Audio(`${stageManager.stageFolder}/${stageManager.data.bgm}`);
    audio.loop = true;
    audio.volume = 0.45;
    stageManager.bgmAudio = audio;
  }
}

const SFX = {
  ctx: null,
  muted: false,
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
    const bgm = stageManager.bgmAudio;
    if (!bgm) return;
    if (this.muted || game.state !== "PLAY") {
      bgm.pause();
    } else {
      bgm.volume = Math.max(0, Math.min(1, 0.45 * (hero.stats?.bgmVolumeScale ?? 1.0)));
      bgm.play().catch(() => {});
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
    gain.gain.setValueAtTime(gainVal * deafMult, t);
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
      gain.gain.setValueAtTime(0.11 * deafMult, now + n.t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d);
    }
  }
};

initTraitsJson();
initStage001();
