// js/input.js //
"use strict";

const keys = Object.create(null);
const mouse = {
  screenX: W * 0.65,
  screenY: H * 0.65,
  leftDown: false,
  rightDown: false,
  middleDown: false
};

const inputDelayBuffer = [];
let prevEffectiveInput = {
  aHeld: false, dHeld: false, wHeld: false, sHeld: false,
  jumpHeld: false, gunHeld: false, boneHeld: false, hatHeld: false
};

window.addEventListener("contextmenu", e => e.preventDefault());

window.addEventListener("mousemove", e => {
  if (typeof ScoreboardUI !== "undefined" && ScoreboardUI.isOpen()) return;
  const rect = canvas.getBoundingClientRect();
  mouse.screenX = Math.max(0, Math.min(W, ((e.clientX - rect.left) / rect.width) * W));
  mouse.screenY = Math.max(0, Math.min(H, ((e.clientY - rect.top) / rect.height) * H));
});

window.addEventListener("mousedown", e => {
  if (typeof ScoreboardUI !== "undefined" && ScoreboardUI.isOpen()) return;
  SFX.unlock();
  const rect = canvas.getBoundingClientRect();
  const cx = ((e.clientX - rect.left) / rect.width) * W;
  const cy = ((e.clientY - rect.top) / rect.height) * H;

  if (game.state === "SELECT") {
    for (const box of setup.uiBoxes) {
      if (cx >= box.x && cx <= box.x + box.w && cy >= box.y && cy <= box.y + box.h) {
        box.onClick();
        break;
      }
    }
    return;
  }

  mouse.screenX = Math.max(0, Math.min(W, cx));
  mouse.screenY = Math.max(0, Math.min(H, cy));
  if (e.button === 0) mouse.leftDown = true;
  if (e.button === 2) mouse.rightDown = true;
  if (e.button === 1) mouse.middleDown = true;
});

window.addEventListener("mouseup", e => {
  if (e.button === 0) mouse.leftDown = false;
  if (e.button === 2) mouse.rightDown = false;
  if (e.button === 1) mouse.middleDown = false;
});

window.addEventListener("keydown", e => {
  if (typeof ScoreboardUI !== "undefined" && ScoreboardUI.isOpen()) {
    if (e.code === "Escape") {
      e.preventDefault();
      ScoreboardUI.close();
    }
    return;
  }

  SFX.unlock();
  keys[e.code] = true;

  if (game.state === "SELECT") {
    if (e.code === "Digit1") toggleTraitSelection("blind");
    else if (e.code === "Digit2") toggleTraitSelection("prosthesis");
    else if (e.code === "Digit3") toggleTraitSelection("deaf");
    else if (e.code === "Digit4") toggleTraitSelection("tremor");
    else if (e.code === "Digit5") toggleTraitSelection("asthma");
    else if (e.code === "KeyN") setDifficulty("NORMAL");
    else if (e.code === "KeyH") setDifficulty("HARD");
    else if (e.code === "KeyU") setDifficulty("ULTIMATE");
    else if ((e.code === "Enter" || e.code === "Space") && setup.selected.length === requiredTraitCount()) {
      startStageWithSelectedTraits();
    }
    return;
  }

  if (e.code === "Escape" || e.code === "Tab") {
    e.preventDefault();
    returnToCharSelect();
    return;
  }

  if (e.code === "KeyM") {
    SFX.toggleMute();
  }
});

window.addEventListener("keyup", e => {
  keys[e.code] = false;
});

function sampleRawState() {
  const aHeld = !!(keys["KeyA"] || keys["ArrowLeft"]);
  const dHeld = !!(keys["KeyD"] || keys["ArrowRight"]);
  const wHeld = !!(keys["KeyW"] || keys["ArrowUp"]);
  const sHeld = !!(keys["KeyS"] || keys["ArrowDown"]);
  const spaceHeld = !!keys["Space"];

  return {
    aHeld,
    dHeld,
    wHeld,
    sHeld,
    jumpHeld: wHeld || spaceHeld,
    gunHeld:  !!(mouse.leftDown || keys["KeyJ"]),
    boneHeld: !!(mouse.rightDown || keys["KeyE"] || keys["KeyC"]),
    hatHeld:  !!(mouse.middleDown || keys["KeyF"] || keys["ShiftLeft"] || keys["ShiftRight"])
  };
}

function getEffectiveInput() {
  const raw = sampleRawState();
  let state = raw;

  if (hero.traits.deaf) {
    const delaySec = hero.stats?.inputDelaySec ?? 0.40;
    inputDelayBuffer.push({ time: game.elapsedTime, raw });
    const targetTime = game.elapsedTime - delaySec;
    while (inputDelayBuffer.length > 1 && inputDelayBuffer[1].time <= targetTime) {
      inputDelayBuffer.shift();
    }
    if (inputDelayBuffer[0].time <= targetTime) {
      state = inputDelayBuffer[0].raw;
    } else {
      state = {
        aHeld: false, dHeld: false, wHeld: false, sHeld: false,
        jumpHeld: false, gunHeld: false, boneHeld: false, hatHeld: false
      };
    }
  }

  const effective = {
    ...state,
    jumpPressed: state.jumpHeld && !prevEffectiveInput.jumpHeld,
    bonePressed: state.boneHeld && !prevEffectiveInput.boneHeld,
    hatPressed:  state.hatHeld  && !prevEffectiveInput.hatHeld
  };
  prevEffectiveInput = state;
  return effective;
}
