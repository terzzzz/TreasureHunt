// js/touch.js //
"use strict";

const touchUI = {
  enabled: ("ontouchstart" in window) || (navigator.maxTouchPoints > 0),
  activeTouches: new Map(), // identifier -> { x, y, role, btnId }
  virtualInput: {
    aHeld: false,
    dHeld: false,
    wHeld: false,
    sHeld: false,
    jumpPressed: false,
    gunHeld: false,
    bonePressed: false,
    hatPressed: false
  },
  prevJumpHeld: false,
  prevBoneHeld: false,
  prevHatHeld: false,
  buttons: []
};

function clientToCanvasCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * W,
    y: ((clientY - rect.top) / rect.height) * H
  };
}

function buildTouchLayout() {
  const padR = 30;
  const dpadCx = 96;
  const dpadCy = H - 96;

  touchUI.buttons = [
    // Left-thumb D-Pad
    { id: "LEFT",  label: "◀", cx: dpadCx - 54, cy: dpadCy,      r: padR },
    { id: "RIGHT", label: "▶", cx: dpadCx + 54, cy: dpadCy,      r: padR },
    { id: "UP",    label: "▲", cx: dpadCx,      cy: dpadCy - 54, r: padR },
    { id: "DOWN",  label: "▼", cx: dpadCx,      cy: dpadCy + 54, r: padR },

    // Right-thumb Action Buttons
    { id: "FIRE",  label: "GUN",  cx: W - 82,  cy: H - 86,  r: 40, color: "rgba(29, 78, 216, 0.55)" },
    { id: "JUMP",  label: "JUMP", cx: W - 174, cy: H - 68,  r: 34, color: "rgba(22, 163, 74, 0.55)" },
    { id: "BONE",  label: "BONE", cx: W - 158, cy: H - 148, r: 28, color: "rgba(217, 119, 6, 0.55)" },
    { id: "HAT",   label: "HAT",  cx: W - 76,  cy: H - 168, r: 28, color: "rgba(220, 38, 38, 0.55)" }
  ];
}

function findTouchButtonAt(x, y) {
  for (const b of touchUI.buttons) {
    if (Math.hypot(x - b.cx, y - b.cy) <= b.r + 10) return b;
  }
  return null;
}

function aimAtNearestEnemyOrForward() {
  const zoom = getActiveCamZoom();
  const hx = hero.x + hero.w / 2;
  const hy = hero.y + hero.h * 0.45;
  let best = null;
  let bestDist = Infinity;

  if (game.activeScreen) {
    for (const e of game.activeScreen.enemies) {
      if (!e.alive) continue;
      const ex = e.x + e.w / 2;
      const ey = e.y + e.h * 0.45;
      const d = Math.hypot(ex - hx, ey - hy);
      if (d < bestDist) {
        bestDist = d;
        best = { x: ex, y: ey };
      }
    }
  }

  if (best && bestDist < 520) {
    mouse.screenX = (best.x - game.camX) * zoom;
    mouse.screenY = (best.y - game.camY) * zoom;
  } else {
    mouse.screenX = (hx + hero.facing * 140 - game.camX) * zoom;
    mouse.screenY = (hy - game.camY) * zoom;
  }
}

function syncTouchControlsToInput(input) {
  if (!touchUI.enabled) return;

  let aHeld = false, dHeld = false, wHeld = false, sHeld = false;
  let jumpHeld = false, gunHeld = false, boneHeld = false, hatHeld = false;

  for (const t of touchUI.activeTouches.values()) {
    if (t.role === "AIM_FIRE") {
      mouse.screenX = t.x;
      mouse.screenY = t.y;
      gunHeld = true;
      continue;
    }

    // Re-evaluate D-pad direction continuously so sliding thumb between Left/Right works smoothly
    if (t.role === "DPAD") {
      const btn = findTouchButtonAt(t.x, t.y);
      const id = btn ? btn.id : t.btnId;
      if (id === "LEFT")  aHeld = true;
      if (id === "RIGHT") dHeld = true;
      if (id === "UP")    wHeld = true;
      if (id === "DOWN")  sHeld = true;
      continue;
    }

    if (t.btnId === "JUMP") jumpHeld = true;
    if (t.btnId === "BONE") boneHeld = true;
    if (t.btnId === "HAT")  hatHeld = true;
    if (t.btnId === "FIRE") {
      gunHeld = true;
      // Twin-stick drag on the FIRE button aims in drag direction; tap auto-aims nearest enemy
      const fireBtn = touchUI.buttons.find(b => b.id === "FIRE");
      const dx = t.x - fireBtn.cx;
      const dy = t.y - fireBtn.cy;
      if (Math.hypot(dx, dy) > 12) {
        const zoom = getActiveCamZoom();
        const hx = hero.x + hero.w / 2;
        const hy = hero.y + hero.h * 0.45;
        mouse.screenX = (hx + dx * 4 - game.camX) * zoom;
        mouse.screenY = (hy + dy * 4 - game.camY) * zoom;
      } else {
        aimAtNearestEnemyOrForward();
      }
    }
  }

  // Merge with keyboard/mouse without overwriting desktop inputs
  if (aHeld) input.aHeld = true;
  if (dHeld) input.dHeld = true;
  if (wHeld) input.wHeld = true;
  if (sHeld) input.sHeld = true;
  if (gunHeld) input.gunHeld = true;

  if (jumpHeld && !touchUI.prevJumpHeld) input.jumpPressed = true;
  if (boneHeld && !touchUI.prevBoneHeld) input.bonePressed = true;
  if (hatHeld  && !touchUI.prevHatHeld)  input.hatPressed = true;

  touchUI.prevJumpHeld = jumpHeld;
  touchUI.prevBoneHeld = boneHeld;
  touchUI.prevHatHeld  = hatHeld;
}

function drawTouchControls() {
  if (!touchUI.enabled || game.state !== "PLAY") return;
  if (touchUI.buttons.length === 0) buildTouchLayout();

  ctx.save();
  for (const b of touchUI.buttons) {
    if (b.id === "HAT" && !hero.hasMissileHat) continue;
    if (b.id === "BONE" && hero.bones <= 0) continue;

    const isPressed = Array.from(touchUI.activeTouches.values()).some(t => t.btnId === b.id);
    ctx.fillStyle = isPressed
      ? "rgba(250, 204, 21, 0.72)"
      : (b.color || "rgba(15, 23, 42, 0.48)");
    ctx.strokeStyle = isPressed ? "#fef08a" : "rgba(248, 250, 252, 0.65)";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(b.cx, b.cy, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isPressed ? "#0f172a" : "#ffffff";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.label, b.cx, b.cy);
  }
  ctx.restore();
}

function initTouchListeners() {
  buildTouchLayout();

  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    touchUI.enabled = true;

    // Unlock WebAudio on iOS Safari / Android Chrome
    if (typeof SFX !== "undefined" && SFX.ctx && SFX.ctx.state === "suspended") {
      SFX.ctx.resume();
    }

    for (const t of e.changedTouches) {
      const pt = clientToCanvasCoords(t.clientX, t.clientY);

      // 1. Character Select screen cards/buttons
      if (game.state === "SELECT") {
        for (const box of setup.uiBoxes) {
          if (pt.x >= box.x && pt.x <= box.x + box.w && pt.y >= box.y && pt.y <= box.y + box.h) {
            box.onClick();
            break;
          }
        }
        continue;
      }

      // 2. Top HUD buttons ([B] BOSS, [ESC] CHAR, [M] BGM) & End-screen buttons
      let hitHud = false;
      for (const btn of game.hudButtons) {
        if (pt.x >= btn.x && pt.x <= btn.x + btn.w && pt.y >= btn.y && pt.y <= btn.y + btn.h) {
          btn.onClick();
          hitHud = true;
          break;
        }
      }
      if (hitHud) continue;

      if (game.state !== "PLAY") continue;

      // 3. Virtual D-Pad or Action Button
      const btn = findTouchButtonAt(pt.x, pt.y);
      if (btn) {
        const isDpad = ["LEFT", "RIGHT", "UP", "DOWN"].includes(btn.id);
        touchUI.activeTouches.set(t.identifier, {
          x: pt.x,
          y: pt.y,
          role: isDpad ? "DPAD" : "ACTION",
          btnId: btn.id
        });
      } else {
        // 4. Touching anywhere else on screen aims & fires directly at that point
        touchUI.activeTouches.set(t.identifier, {
          x: pt.x,
          y: pt.y,
          role: "AIM_FIRE",
          btnId: null
        });
      }
    }
  }, { passive: false });

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const tracked = touchUI.activeTouches.get(t.identifier);
      if (!tracked) continue;
      const pt = clientToCanvasCoords(t.clientX, t.clientY);
      tracked.x = pt.x;
      tracked.y = pt.y;
    }
  }, { passive: false });

  const endTouch = (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      touchUI.activeTouches.delete(t.identifier);
    }
  };

  canvas.addEventListener("touchend", endTouch, { passive: false });
  canvas.addEventListener("touchcancel", endTouch, { passive: false });
}
