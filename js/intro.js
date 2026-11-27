// js/intro.js //
"use strict";

const INTRO_CRAWL_LINES = [
  {
    text: "話說一個人若無夢想，",
    yRatio: 0.31,
    start: 0.30,
    dur: 1.15,
    font: 'bold 28px "Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif',
    color: "#f8fafc"
  },
  {
    text: "同條鹹魚有咩分別呢？",
    yRatio: 0.39,
    start: 1.25,
    dur: 1.15,
    font: 'bold 28px "Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif',
    color: "#e2e8f0"
  },
  {
    text: "咁如果係身體有障礙呢。。。",
    yRatio: 0.52,
    start: 2.50,
    dur: 1.15,
    font: 'bold 28px "Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif',
    color: "#f8fafc"
  },
  {
    text: "都無礙我地追夢！我要尋寶！",
    yRatio: 0.61,
    start: 3.45,
    dur: 1.20,
    font: 'bold 32px "Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif',
    color: "#facc15"
  }
];

const INTRO_PROMPT_TEXT = "Press any key.";
const INTRO_PROMPT_START = 4.35;
const INTRO_TOTAL_DURATION = 4.70;

const introCrawlState = {
  startTime: null,
  completed: false
};

function resetIntroScreen() {
  introCrawlState.startTime = null;
  introCrawlState.completed = false;
  if (typeof setup !== "undefined") {
    setup.showIntroScreen = true;
  }
}

function advanceIntroScreen() {
  if (typeof SFX !== "undefined" && typeof SFX.unlock === "function") {
    SFX.unlock();
  }
  if (!introCrawlState.completed) {
    introCrawlState.completed = true;
    if (typeof SFX !== "undefined" && typeof SFX.beep === "function") {
      SFX.beep(480, 0.07, "triangle", 0.06);
    }
    return;
  }
  if (typeof setup !== "undefined") {
    setup.showIntroScreen = false;
  }
  if (typeof SFX !== "undefined" && typeof SFX.beep === "function") {
    SFX.beep(620, 0.10, "square", 0.08);
  }
}

function drawIntroCrawlScreen() {
  if (typeof setup !== "undefined" && Array.isArray(setup.uiBoxes)) {
    setup.uiBoxes.length = 0;
  }
  if (typeof drawActiveScreenBackground === "function" && typeof STAGE_001_DEFAULT !== "undefined") {
    drawActiveScreenBackground(STAGE_001_DEFAULT.screens[0]);
  }

  const now = performance.now() / 1000;
  if (introCrawlState.startTime === null) {
    introCrawlState.startTime = now;
  }
  const elapsed = introCrawlState.completed ? 99 : (now - introCrawlState.startTime);
  if (elapsed >= INTRO_TOTAL_DURATION) {
    introCrawlState.completed = true;
  }

  // Dark theatrical backdrop with subtle vignette and gold border
  ctx.save();
  ctx.fillStyle = "rgba(10, 15, 28, 0.88)";
  ctx.fillRect(0, 0, W, H);

  const vignette = ctx.createRadialGradient(HALF_W, H * 0.48, 90, HALF_W, H * 0.48, W * 0.62);
  vignette.addColorStop(0, "rgba(15, 23, 42, 0.0)");
  vignette.addColorStop(1, "rgba(2, 6, 23, 0.65)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(250, 204, 21, 0.45)";
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 22, W - 56, H - 44);

  // Subtle rising dust particles
  for (let i = 0; i < 18; i++) {
    const px = ((i * 197 + 63) % (W - 80)) + 40;
    const py = H - (((now * (14 + (i % 5) * 4) + i * 71) % (H - 60)) + 30);
    const alpha = 0.14 + 0.14 * Math.sin(now * 2 + i);
    ctx.fillStyle = `rgba(250, 204, 21, ${alpha.toFixed(3)})`;
    ctx.fillRect(px, py, 2.5, 2.5);
  }

  // Rising fade-in credit lines
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const item of INTRO_CRAWL_LINES) {
    const rawT = Math.max(0, Math.min(1, (elapsed - item.start) / item.dur));
    if (rawT <= 0) continue;

    const ease = 1 - Math.pow(1 - rawT, 3);
    const riseOffset = (1 - ease) * 42;

    ctx.save();
    ctx.globalAlpha = ease;
    ctx.font = item.font;
    ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = item.color;
    ctx.fillText(item.text, HALF_W, H * item.yRatio + riseOffset);
    ctx.restore();
  }

  // Pulsing "Press any key." prompt
  const promptT = Math.max(0, Math.min(1, (elapsed - INTRO_PROMPT_START) / 0.75));
  if (promptT > 0) {
    const pulse = 0.55 + 0.45 * Math.sin(now * 4.2);
    ctx.save();
    ctx.globalAlpha = promptT * pulse;
    ctx.font = "bold 17px monospace";
    ctx.fillStyle = "#38bdf8";
    ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
    ctx.shadowBlur = 8;
    ctx.fillText(INTRO_PROMPT_TEXT, HALF_W, H * 0.83);
    ctx.restore();
  }

  ctx.restore();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Allow mouse click or touch tap anywhere on screen to advance
  if (typeof setup !== "undefined" && Array.isArray(setup.uiBoxes)) {
    setup.uiBoxes.push({
      x: 0,
      y: 0,
      w: W,
      h: H,
      onClick: () => advanceIntroScreen()
    });
  }
}

window.addEventListener("keydown", (e) => {
  if (typeof game === "undefined" || game.state !== "SELECT" || typeof setup === "undefined") return;
  if (setup.showIntroScreen === false) return;
  if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;

  e.preventDefault();
  e.stopImmediatePropagation();
  advanceIntroScreen();
}, true);
