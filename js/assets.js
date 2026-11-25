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
        // Sample top-left corner pixel as background color (handles both pure white and #f5f1e6 paper)
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
      // If file:// security blocks getImageData, paint the erased barrel box with the sprite's paper tone
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

const EXTRA_SPRITES = {
  giant:    loadOptionalImage("./char/giant.png"),
  giantAxe: loadOptionalImage("./char/giant_axe.png"),
  blade:    loadOptionalImage("./char/blade_enemy.png"),
  chicken:  loadOptionalImage("./char/chicken.png"),
  bone:     loadOptionalImage("./char/bone.png"),
  hat:      loadOptionalImage("./char/hat.png"),
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
