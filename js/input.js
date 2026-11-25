// js/inpuit.js //

"use strict";

const keys = Object.create(null);
const mouse = {
  screenX: W * 0.65,
  screenY: H * 0.65,
  leftDown: false,
  rightDown: false,
  middleDown: false
};
const touchState = { left: false, right: false, up: false, down: false, jump: false, gun: false, bone: false, hat: false };
const touchUI = document.getElementById("touch-ui");

const inputDelayBuffer = [];
let prevEffectiveInput = {
  left: false, right: false, up: false, down: false,
  jumpHeld: false, gunHeld: false, boneHeld: false, hatHeld: false
};

const debugDrag = {
  active: false,
  startX: 0, startY: 0, curX: 0, curY: 0,
  draftBox: null,
  undoStack: [],
  lastJson: ""
};

function commitDraftBarrier(kind) {
  const scr = game.activeScreen;
  const b = debugDrag.draftBox;
  if (!scr || !b || b.w < 4 || b.h < 4) return;

  if (kind === "solid") {
    const item = { x: b.x, y: b.y, w: b.w, h: b.h, hatched: true };
    scr.solids.push(item);
    debugDrag.undoStack.push({ list: scr.solids, item });
    debugDrag.lastJson = `[SOLID] ${JSON.stringify(item)}`;
  } else if (kind === "ladder") {
    const item = { x: b.x, y: b.y, w: b.w, h: b.h };
    scr.ladders.push(item);
    debugDrag.undoStack.push({ list: scr.ladders, item });
    debugDrag.lastJson = `[LADDER] ${JSON.stringify(item)}`;
  } else if (kind === "oneway") {
    const item = { x: b.x, y: b.y, w: b.w, h: Math.max(8, b.h) };
    scr.oneWay.push(item);
    debugDrag.undoStack.push({ list: scr.oneWay, item });
    debugDrag.lastJson = `[ONEWAY] ${JSON.stringify(item)}`;
  }
  console.log("Added barrier:", debugDrag.lastJson);
  SFX.beep(520, 0.08, "triangle", 0.07, 740);
}

function undoLastBarrier() {
  const entry = debugDrag.undoStack.pop();
  if (!entry) return;
  const idx = entry.list.indexOf(entry.item);
  if (idx !== -1) entry.list.splice(idx, 1);
  debugDrag.lastJson = "UNDONE last barrier";
  SFX.beep(300, 0.08, "triangle", 0.06, 180);
}

window.addEventListener("contextmenu", e => e.preventDefault());

window.addEventListener("mousemove", e => {
  const rect = canvas.getBoundingClientRect();
  const cx = Math.max(0, Math.min(W, ((e.clientX - rect.left) / rect.width) * W));
  const cy = Math.max(0, Math.min(H, ((e.clientY - rect.top) / rect.height) * H));
  mouse.screenX = cx;
  mouse.screenY = cy;

  if (debugDrag.active) {
    debugDrag.curX = Math.round(cx + game.camX);
    debugDrag.curY = Math.round(cy + game.camY);
  }
});

window.addEventListener("mousedown", e => {
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

  if (game.debug && e.button === 0) {
    debugDrag.active = true;
    debugDrag.startX = Math.round(cx + game.camX);
    debugDrag.startY = Math.round(cy + game.camY);
    debugDrag.curX = debugDrag.startX;
    debugDrag.curY = debugDrag.startY;
    return;
  }

  mouse.screenX = Math.max(0, Math.min(W, cx));
  mouse.screenY = Math.max(0, Math.min(H, cy));
  if (e.button === 0) mouse.leftDown = true;
  if (e.button === 2) mouse.rightDown = true;
  if (e.button === 1) mouse.middleDown = true;
});

window.addEventListener("mouseup", e => {
  if (debugDrag.active && e.button === 0) {
    debugDrag.active = false;
    const x = Math.min(debugDrag.startX, debugDrag.curX);
    const y = Math.min(debugDrag.startY, debugDrag.curY);
    const w = Math.abs(debugDrag.curX - debugDrag.startX);
    const h = Math.abs(debugDrag.curY - debugDrag.startY);
    if (w > 4 && h > 4) {
      debugDrag.draftBox = { x, y, w, h };
      debugDrag.lastJson = `DRAFT { "x": ${x}, "y": ${y}, "w": ${w}, "h": ${h} } -> [B]Solid [L]Ladder [O]OneWay`;
    }
    return;
  }
  if (e.button === 0) mouse.leftDown = false;
  if (e.button === 2) mouse.rightDown = false;
  if (e.button === 1) mouse.middleDown = false;
});

window.addEventListener("keydown", e => {
  SFX.unlock();
  touchUI.classList.remove("active");
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

  if (game.debug && game.state === "PLAY") {
    if (e.code === "KeyB") commitDraftBarrier("solid");
    else if (e.code === "KeyL") commitDraftBarrier("ladder");
    else if (e.code === "KeyO") commitDraftBarrier("oneway");
    else if (e.code === "KeyZ") undoLastBarrier();
  }

  if (e.code === "F2") {
    e.preventDefault();
    game.debug = !game.debug;
  } else if (e.code === "KeyM") {
    SFX.muted = !SFX.muted;
    SFX.syncBgm();
  } else if (e.code === "KeyR" && (game.state === "GAMEOVER" || game.state === "VICTORY")) {
    startStageWithSelectedTraits();
  }
});

window.addEventListener("keyup", e => { keys[e.code] = false; });

function setupTouchControls() {
  const stickBase = document.getElementById("stick-base");
  const stickKnob = document.getElementById("stick-knob");
  let stickTouchId = null;

  canvas.addEventListener("touchstart", e => {
    SFX.unlock();
    if (e.changedTouches.length > 0) {
      const t = e.changedTouches[0];
      const rect = canvas.getBoundingClientRect();
      const cx = ((t.clientX - rect.left) / rect.width) * W;
      const cy = ((t.clientY - rect.top) / rect.height) * H;
      if (game.state === "SELECT") {
        e.preventDefault();
        for (const box of setup.uiBoxes) {
          if (cx >= box.x && cx <= box.x + box.w && cy >= box.y && cy <= box.y + box.h) {
            box.onClick();
            break;
          }
        }
        return;
      }
      touchUI.classList.add("active");
      mouse.screenX = Math.max(0, Math.min(W, cx));
      mouse.screenY = Math.max(0, Math.min(H, cy));
    }
  }, { passive: false });

  canvas.addEventListener("touchmove", e => {
    if (game.state === "PLAY" && e.changedTouches.length > 0) {
      const t = e.changedTouches[0];
      const rect = canvas.getBoundingClientRect();
      mouse.screenX = Math.max(0, Math.min(W, ((t.clientX - rect.left) / rect.width) * W));
      mouse.screenY = Math.max(0, Math.min(H, ((t.clientY - rect.top) / rect.height) * H));
    }
  }, { passive: true });

  stickBase.addEventListener("touchstart", e => {
    e.preventDefault();
    const t = e.changedTouches[0];
    stickTouchId = t.identifier;
    updateStick(t.clientX, t.clientY);
  }, { passive: false });

  stickBase.addEventListener("touchmove", e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === stickTouchId) updateStick(t.clientX, t.clientY);
    }
  }, { passive: false });

  const endStick = e => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickTouchId) {
        stickTouchId = null;
        touchState.left = touchState.right = touchState.up = touchState.down = false;
        stickKnob.style.transform = "translate(0px, 0px)";
      }
    }
  };
  stickBase.addEventListener("touchend", endStick);
  stickBase.addEventListener("touchcancel", endStick);

  function updateStick(cx, cy) {
    const rect = stickBase.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let dx = cx - centerX;
    let dy = cy - centerY;
    const maxR = 42;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    const dead = 14;
    touchState.left  = dx < -dead;
    touchState.right = dx > dead;
    touchState.up    = dy < -dead;
    touchState.down  = dy > dead;
  }

  function bindBtn(id, field) {
    const el = document.getElementById(id);
    el.addEventListener("touchstart", e => {
      e.preventDefault();
      SFX.unlock();
      touchState[field] = true;
      el.classList.add("pressed");
    }, { passive: false });
    const release = e => {
      e.preventDefault();
      touchState[field] = false;
      el.classList.remove("pressed");
    };
    el.addEventListener("touchend", release);
    el.addEventListener("touchcancel", release);
  }

  bindBtn("btn-jump", "jump");
  bindBtn("btn-gun",  "gun");
  bindBtn("btn-bone", "bone");
  bindBtn("btn-hat",  "hat");
}
setupTouchControls();

function sampleRawState() {
  const aHeld = !!(keys["KeyA"] || keys["ArrowLeft"] || touchState.left);
  const dHeld = !!(keys["KeyD"] || keys["ArrowRight"] || touchState.right);
  const wHeld = !!(keys["KeyW"] || keys["ArrowUp"] || touchState.up);
  const sHeld = !!(keys["KeyS"] || keys["ArrowDown"] || touchState.down);
  const spaceHeld = !!(keys["Space"] || touchState.jump);

  return {
    aHeld,
    dHeld,
    wHeld,
    sHeld,
    jumpHeld: wHeld || spaceHeld,
    gunHeld:  !!(mouse.leftDown || keys["KeyJ"] || touchState.gun),
    boneHeld: !!(mouse.rightDown || keys["KeyE"] || keys["KeyC"] || touchState.bone),
    hatHeld:  !!(mouse.middleDown || keys["KeyF"] || keys["ShiftLeft"] || keys["ShiftRight"] || touchState.hat)
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
