// js/intro.js //
"use strict";

const GAME_BADGE_SPRITE = (() => {
  const entry = { img: new Image(), canvas: null, loaded: false };
  entry.img.onload = () => {
    const w = entry.img.naturalWidth || entry.img.width;
    const h = entry.img.naturalHeight || entry.img.height;
    if (!w || !h) return;

    // Crop tightly around the circular medallion (79.5% of image height)
    const cropSize = Math.round(Math.min(w, h) * 0.795);
    const sx = Math.round((w - cropSize) * 0.5);
    const sy = Math.round((h - cropSize) * 0.5);

    const off = document.createElement("canvas");
    off.width = cropSize;
    off.height = cropSize;
    const octx = off.getContext("2d");
    octx.drawImage(entry.img, sx, sy, cropSize, cropSize, 0, 0, cropSize, cropSize);

    // Strip outer light-gray/white corner pixels outside the medallion rim
    try {
      const imgData = octx.getImageData(0, 0, cropSize, cropSize);
      const data = imgData.data;
      const visited = new Uint8Array(cropSize * cropSize);
      const stack = [];

      const isOuterLight = (idx) => {
        const p = idx * 4;
        const r = data[p], g = data[p + 1], b = data[p + 2];
        return r > 210 && g > 210 && b > 210 && Math.abs(r - b) < 22;
      };

      const pushIfLight = (x, y) => {
        if (x < 0 || x >= cropSize || y < 0 || y >= cropSize) return;
        const idx = y * cropSize + x;
        if (!visited[idx] && isOuterLight(idx)) {
          visited[idx] = 1;
          stack.push(idx);
        }
      };

      for (let x = 0; x < cropSize; x++) {
        pushIfLight(x, 0);
        pushIfLight(x, cropSize - 1);
      }
      for (let y = 0; y < cropSize; y++) {
        pushIfLight(0, y);
        pushIfLight(cropSize - 1, y);
      }

      while (stack.length > 0) {
        const idx = stack.pop();
        data[idx * 4 + 3] = 0;
        const x = idx % cropSize;
        const y = (idx - x) / cropSize;
        pushIfLight(x - 1, y);
        pushIfLight(x + 1, y);
        pushIfLight(x, y - 1);
        pushIfLight(x, y + 1);
      }
      octx.putImageData(imgData, 0, 0);
    } catch (_) {
      // Fallback for local file:// browsing where getImageData is restricted
    }

    entry.canvas = off;
    entry.loaded = true;
  };
  entry.img.src = "./badge2.jpeg";
  return entry;
})();

function drawGameBadge(cx, cy, diameter, alpha = 1.0) {
  if (!GAME_BADGE_SPRITE.loaded) return false;
  const src = GAME_BADGE_SPRITE.canvas || GAME_BADGE_SPRITE.img;
  const r = diameter * 0.5;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(src, cx - r, cy - r, diameter, diameter);
  ctx.restore();
  return true;
}

const INTRO_CRAWL_LINES = [
  // Stanza 1: Traditional Chinese / English / Japanese
  {
    text: "話說一個人若無夢想，同條鹹魚有咩分別呢？",
    yRatio: 0.23,
    start: 0.25,
    dur: 1.10,
    font: 'bold 25px "Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif',
    color: "#f8fafc"
  },
  {
    text: "If a person has no dream, how are they different from a salted fish?",
    yRatio: 0.30,
    start: 0.70,
    dur: 1.10,
    font: "bold 15.5px sans-serif",
    color: "#cbd5e1"
  },
  {
    text: "夢を持たない人間など、塩漬けの魚と何の違いがあるだろうか？",
    yRatio: 0.355,
    start: 1.10,
    dur: 1.10,
    font: '15px "Yu Gothic", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif',
    color: "#94a3b8"
  },

  // Stanza 2: Traditional Chinese / English / Japanese
  {
    text: "咁如果係身體有障礙呢。。。",
    yRatio: 0.47,
    start: 2.15,
    dur: 1.05,
    font: 'bold 24px "Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif',
    color: "#f8fafc"
  },
  {
    text: "都無礙我地追夢！我要尋寶！",
    yRatio: 0.545,
    start: 2.75,
    dur: 1.15,
    font: 'bold 29px "Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif',
    color: "#facc15"
  },
  {
    text: "Even with physical barriers... nothing stops us from chasing our dreams! Let's hunt for treasure!",
    yRatio: 0.625,
    start: 3.30,
    dur: 1.10,
    font: "bold 15px sans-serif",
    color: "#fef08a"
  },
  {
    text: "たとえ身体に障がいがあっても…夢を追う妨げにはならない！お宝を探しに行くぞ！",
    yRatio: 0.685,
    start: 3.75,
    dur: 1.10,
    font: 'bold 14.5px "Yu Gothic", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif',
    color: "#fde047"
  }
];

const INTRO_PROMPT_TEXT = "Press any key   |   按任意鍵繼續   |   いずれかのキーを押してください";
const INTRO_PROMPT_START = 4.55;
const INTRO_TOTAL_DURATION = 4.95;

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

  // Dark theatrical backdrop
  ctx.save();
  ctx.fillStyle = "rgba(10, 15, 28, 0.89)";
  ctx.fillRect(0, 0, W, H);

  // Dull background badge emblem
  const badgeFade = Math.min(1, elapsed / 1.1);
  const badgePulse = 0.20 + 0.025 * Math.sin(now * 2.0);
  drawGameBadge(HALF_W, H * 0.47, 455, badgeFade * badgePulse);

  const vignette = ctx.createRadialGradient(HALF_W, H * 0.48, 120, HALF_W, H * 0.48, W * 0.62);
  vignette.addColorStop(0, "rgba(15, 23, 42, 0.0)");
  vignette.addColorStop(1, "rgba(2, 6, 23, 0.64)");
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
    const riseOffset = (1 - ease) * 38;

    ctx.save();
    ctx.globalAlpha = ease;
    ctx.font = item.font;
    ctx.shadowColor = "rgba(0, 0, 0, 0.94)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = item.color;
    ctx.fillText(item.text, HALF_W, H * item.yRatio + riseOffset);
    ctx.restore();
  }

  // Pulsing trilingual prompt
  const promptT = Math.max(0, Math.min(1, (elapsed - INTRO_PROMPT_START) / 0.75));
  if (promptT > 0) {
    const pulse = 0.55 + 0.45 * Math.sin(now * 4.2);
    ctx.save();
    ctx.globalAlpha = promptT * pulse;
    ctx.font = "bold 15px sans-serif";
    ctx.fillStyle = "#38bdf8";
    ctx.shadowColor = "rgba(0, 0, 0, 0.92)";
    ctx.shadowBlur = 8;
    ctx.fillText(INTRO_PROMPT_TEXT, HALF_W, H * 0.85);
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
