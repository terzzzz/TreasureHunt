// js/config.js //
"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const SCALE = 3;
const W = 328 * SCALE;        // 984 px logical width
const H = 207 * SCALE;        // 621 px logical height
const HALF_W = W / 2;         // 492 px
const DISPLAY_ASPECT_RATIO = W / H; // Exact 984 / 621 (328:207) native aspect ratio
const FPS = 60;
const DT = 1 / FPS;

const sightCanvas = document.createElement("canvas");
sightCanvas.width = W;
sightCanvas.height = H;
const sightCtx = sightCanvas.getContext("2d");

const blurCanvas = document.createElement("canvas");
blurCanvas.width = W;
blurCanvas.height = H;
const blurCtx = blurCanvas.getContext("2d");

const FALLBACK_TRAITS_DATA = {
  baseHunter: {
    walkSpeed: 210,
    climbSpeed: 145,
    jumpVel: -505,
    hp: 100,
    bulletSpeed: 660,
    bulletDropRatio: 0.75
  },
  traits: {
    blind: {
      num: "1",
      en: "Blind",
      zhName: "阿漢",
      anchor: "盲",
      visual: "smoky_eyes",
      desc: "Sight circle (310px) + dark blur outside",
      stats: { sightRadius: 310, bgmVolumeScale: 1.0 }
    },
    prosthesis: {
      num: "2",
      en: "Prosthesis",
      zhName: "阿義",
      anchor: "義",
      visual: "metal_stick_legs",
      desc: "0.62x ground speed + mechanical legs",
      stats: { walkSpeedMultiplier: 0.62 }
    },
    deaf: {
      num: "3",
      en: "Deaf",
      zhName: "阿隆",
      anchor: "聾",
      visual: "ear_hearing_device",
      desc: "0.40s press/release delay + ear device",
      stats: { inputDelaySec: 0.40, sfxGainMultiplier: 0.30, bgmVolumeScale: 0.27 }
    },
    tremor: {
      num: "4",
      en: "Tremor",
      zhName: "阿振",
      anchor: "震",
      visual: "fragile_thin_arms",
      desc: "Thin fragile arms + shaky cursor aim",
      stats: { aimJitterPx: 14, spreadRad: 0.32, headShakePx: 0 }
    },
    asthma: {
      num: "5",
      en: "Asthma",
      zhName: "阿揣",
      anchor: "喘",
      visual: "breath_puffs",
      desc: "A/W fills fatigue (+70% rate) -> 1s gasp stun",
      stats: { fatigueGainPerSec: 71.4, fatigueDecayPerSec: 58, stunDurationSec: 1.0, stunOnGroundOnly: true }
    }
  },
  roster: {
    "1":     { enName: "Blind",       zhName: "阿漢",       anchors: "盲" },
    "2":     { enName: "Prosthesis",  zhName: "阿義",       anchors: "義" },
    "3":     { enName: "Deaf",        zhName: "阿隆",       anchors: "聾" },
    "4":     { enName: "Tremor",      zhName: "阿振",       anchors: "震" },
    "5":     { enName: "Asthma",      zhName: "阿揣",       anchors: "喘" },
    "123":   { enName: "Blosthef",    zhName: "濃義漢",     anchors: "盲義聾" },
    "124":   { enName: "Blosthemor",  zhName: "震義漢",     anchors: "盲義震" },
    "125":   { enName: "Blosthema",   zhName: "全義漢",     anchors: "盲義喘" },
    "134":   { enName: "Bleamor",     zhName: "真漢龍",     anchors: "盲聾震" },
    "135":   { enName: "Bleama",      zhName: "全漢龍",     anchors: "盲聾喘" },
    "145":   { enName: "Blemoma",     zhName: "全真漢",     anchors: "盲震喘" },
    "234":   { enName: "Proseamor",   zhName: "罕真龍",     anchors: "義聾震" },
    "235":   { enName: "Proseama",    zhName: "全義龍",     anchors: "義聾喘" },
    "245":   { enName: "Prosemoma",   zhName: "義鎮泉",     anchors: "義震喘" },
    "345":   { enName: "Dremoma",     zhName: "龍鎮泉",     anchors: "聾震喘" },
    "12345": { enName: "Blosthefema", zhName: "全真濃義漢", anchors: "盲義聾震喘" }
  }
};

let traitsConfig = FALLBACK_TRAITS_DATA;
let TRAIT_ORDER = ["blind", "prosthesis", "deaf", "tremor", "asthma"];

const setup = {
  difficulty: "NORMAL",
  selected: ["blind"],
  uiBoxes: []
};

function requiredTraitCount() {
  if (setup.difficulty === "ULTIMATE") return 5;
  if (setup.difficulty === "HARD") return 3;
  return 1;
}

function buildHunterIdentity(traitIds) {
  if (!traitIds || traitIds.length === 0) {
    return { code: "---", enName: "---", zhName: "---", anchors: "" };
  }
  const sortedNums = traitIds
    .map(id => traitsConfig.traits[id]?.num)
    .filter(Boolean)
    .sort((a, b) => Number(a) - Number(b));
  const key = sortedNums.join("");

  if (traitsConfig.roster && traitsConfig.roster[key]) {
    return { code: key, ...traitsConfig.roster[key] };
  }
  const partialZh = sortedNums.map(n => {
    const id = TRAIT_ORDER[Number(n) - 1];
    return traitsConfig.traits[id]?.anchor || "";
  }).join("·");
  return {
    code: key,
    enName: `Picking (${traitIds.length}/${requiredTraitCount()})`,
    zhName: partialZh,
    anchors: partialZh
  };
}

function computeHunterStats(traitIds) {
  const base = traitsConfig.baseHunter || FALLBACK_TRAITS_DATA.baseHunter;
  const active = {
    blind: false,
    prosthesis: false,
    deaf: false,
    tremor: false,
    asthma: false
  };
  for (const id of traitIds) {
    if (id in active) active[id] = true;
  }

  const tStats = traitsConfig.traits || FALLBACK_TRAITS_DATA.traits;
  const walkMult = active.prosthesis ? (tStats.prosthesis?.stats?.walkSpeedMultiplier ?? 0.62) : 1.0;

  return {
    active,
    selectedOrder: [...traitIds],
    walkSpeed: (base.walkSpeed ?? 210) * walkMult,
    climbSpeed: base.climbSpeed ?? 145,
    jumpVel: base.jumpVel ?? -505,
    maxHp: base.hp ?? 100,
    bulletSpeed: base.bulletSpeed ?? 660,
    bulletDropRatio: base.bulletDropRatio ?? 0.75,
    sightRadius: Math.max(310, tStats.blind?.stats?.sightRadius ?? 310),
    inputDelaySec: tStats.deaf?.stats?.inputDelaySec ?? 0.40,
    sfxGainMultiplier: tStats.deaf?.stats?.sfxGainMultiplier ?? 0.30,
    bgmVolumeScale: active.deaf
      ? (tStats.deaf?.stats?.bgmVolumeScale ?? 0.27)
      : (tStats.blind?.stats?.bgmVolumeScale ?? 1.0),
    aimJitterPx: tStats.tremor?.stats?.aimJitterPx ?? 14,
    spreadRad: tStats.tremor?.stats?.spreadRad ?? 0.32,
    headShakePx: 0,
    fatigueGainPerSec: Math.max(71.4, tStats.asthma?.stats?.fatigueGainPerSec ?? 71.4),
    fatigueDecayPerSec: tStats.asthma?.stats?.fatigueDecayPerSec ?? 58,
    stunDurationSec: tStats.asthma?.stats?.stunDurationSec ?? 1.0
  };
}

function setDifficulty(diff) {
  setup.difficulty = diff;
  if (diff === "NORMAL") {
    setup.selected = setup.selected.length > 0 ? [setup.selected[0]] : ["blind"];
  } else if (diff === "HARD") {
    while (setup.selected.length > 3) setup.selected.pop();
  } else if (diff === "ULTIMATE") {
    setup.selected = [...TRAIT_ORDER];
  }
}

function toggleTraitSelection(traitId) {
  if (setup.difficulty === "ULTIMATE") return;
  const maxPicks = requiredTraitCount();
  const idx = setup.selected.indexOf(traitId);
  if (idx !== -1) {
    setup.selected.splice(idx, 1);
  } else {
    if (setup.selected.length >= maxPicks) setup.selected.shift();
    setup.selected.push(traitId);
  }
}

const STAGE_001_DEFAULT = {
  stageId: "001",
  stageName: "STAGE 001 — INK RUINS",
  timeLimit: 600,
  bgm: "music/bgm.mp3",
  screens: [
    {
      id: "001",
      image: "start.jpg",
      pageLeft: "26",
      pageRight: "27",
      spawn: { x: 112, y: 492 },
      exit: { x: 424, y: 364, w: 40, h: 24, dir: "up" },
      solids: [
        { x: 0,   y: 548, w: 984, h: 73, hatched: true },
        { x: 0,   y: 0,   w: 24,  h: 548 },
        { x: 944, y: 370, w: 22,  h: 178 },
        { x: 24,  y: 382, w: 392, h: 18, hatched: true },
        { x: 472, y: 382, w: 494, h: 18, hatched: true }
      ],
      oneWay: [],
      ladders: [
        { x: 424, y: 382, w: 40, h: 166 }
      ],
      pickups: [
        { type: "crown",   x: 215, y: 455, w: 26, h: 20 },
        { type: "crown",   x: 785, y: 435, w: 26, h: 20 },
        { type: "chicken", x: 845, y: 516, w: 34, h: 28 }
      ],
      enemies: [
        { kind: "blade", x: 310, y: 496, minX: 185, maxX: 405, hp: 40 },
        { kind: "giant", x: 635, y: 448, minX: 525, maxX: 775, hp: 150 }
      ]
    },
    {
      id: "002",
      image: "001.jpg",
      pageLeft: "28",
      pageRight: "29",
      spawn: { x: 64, y: 492 },
      exit: { x: 944, y: 430, w: 32, h: 118, dir: "right" },
      solids: [
        { x: 0,   y: 548, w: 984, h: 73, hatched: true },
        { x: 0,   y: 0,   w: 24,  h: 548 },
        { x: 956, y: 0,   w: 28,  h: 430 }
      ],
      oneWay: [
        { x: 220, y: 416, w: 220, h: 12 },
        { x: 540, y: 310, w: 220, h: 12 }
      ],
      ladders: [
        { x: 310, y: 416, w: 40, h: 132 },
        { x: 620, y: 310, w: 40, h: 238 }
      ],
      pickups: [
        { type: "hat",   x: 625, y: 274, w: 30, h: 24 },
        { type: "crown", x: 280, y: 384, w: 26, h: 20 }
      ],
      enemies: [
        { kind: "giant", x: 460, y: 448, minX: 360, maxX: 840, hp: 170 }
      ]
    },
    {
      id: "003",
      image: "exit.jpg",
      pageLeft: "30",
      pageRight: "31",
      isFinal: true,
      spawn: { x: 64, y: 492 },
      exit: { x: 896, y: 430, w: 54, h: 118, dir: "right", label: "VAULT" },
      solids: [
        { x: 0,   y: 548, w: 984, h: 73, hatched: true },
        { x: 0,   y: 0,   w: 24,  h: 548 },
        { x: 956, y: 0,   w: 28,  h: 430 },
        { x: 620, y: 400, w: 280, h: 20, hatched: true }
      ],
      oneWay: [
        { x: 360, y: 470, w: 180, h: 12 }
      ],
      ladders: [
        { x: 640, y: 400, w: 40, h: 148 }
      ],
      pickups: [
        { type: "chicken",  x: 160, y: 516, w: 34, h: 28 },
        { type: "treasure", x: 810, y: 356, w: 42, h: 36 }
      ],
      enemies: [
        { kind: "blade", x: 380, y: 496, minX: 240, maxX: 580, hp: 50 },
        { kind: "giant", x: 700, y: 300, minX: 685, maxX: 880, hp: 200 }
      ]
    }
  ]
};

const stageManager = {
  stageFolder: "./Stages/001",
  data: STAGE_001_DEFAULT,
  bgImages: {},
  bgmAudio: null
};

async function initTraitsJson() {
  try {
    const res = await fetch("./char/traits.json", { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      if (json && json.traits) {
        traitsConfig = {
          baseHunter: { ...FALLBACK_TRAITS_DATA.baseHunter, ...(json.baseHunter || {}) },
          traits: { ...FALLBACK_TRAITS_DATA.traits, ...json.traits },
          roster: { ...FALLBACK_TRAITS_DATA.roster, ...(json.roster || {}) }
        };
        const ordered = Object.keys(traitsConfig.traits).sort(
          (a, b) => Number(traitsConfig.traits[a].num || 99) - Number(traitsConfig.traits[b].num || 99)
        );
        if (ordered.length > 0) TRAIT_ORDER = ordered;
      }
    }
  } catch (_) {}
}
