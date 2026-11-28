// js/scoreboard.js — UNBOUND SEEKERS Global Scoreboard (16 Boards × Top 5,000, Auto-Scaled)
"use strict";

const SCOREBOARD_API_URL = "https://script.google.com/macros/s/AKfycbyWETo6Kn9b__EvAXFPUHGQAMDSGQw92SZiL4zNOlJQL0jNb0MCUqh9RIrYaph3Axdt/exec";
const PAGE_CHUNK_SIZE = 30;
const CARD_BASE_W = 880;
const CARD_BASE_H = 550;

const SCOREBOARD_BOARDS = [
  // 5 Easy (5C1)
  { key: "E_ASTHMA",                   tier: "EASY",   label: "Easy · Asthma" },
  { key: "E_BLIND",                    tier: "EASY",   label: "Easy · Blind" },
  { key: "E_DEAF",                     tier: "EASY",   label: "Easy · Deaf" },
  { key: "E_PROSTHESIS",               tier: "EASY",   label: "Easy · Prosthesis" },
  { key: "E_TREMOR",                   tier: "EASY",   label: "Easy · Tremor" },
  // 10 Medium (5C3)
  { key: "M_ASTHMA+BLIND+DEAF",        tier: "MEDIUM", label: "Med · Asthma + Blind + Deaf" },
  { key: "M_ASTHMA+BLIND+PROSTHESIS",  tier: "MEDIUM", label: "Med · Asthma + Blind + Prosthesis" },
  { key: "M_ASTHMA+BLIND+TREMOR",      tier: "MEDIUM", label: "Med · Asthma + Blind + Tremor" },
  { key: "M_ASTHMA+DEAF+PROSTHESIS",   tier: "MEDIUM", label: "Med · Asthma + Deaf + Prosthesis" },
  { key: "M_ASTHMA+DEAF+TREMOR",       tier: "MEDIUM", label: "Med · Asthma + Deaf + Tremor" },
  { key: "M_ASTHMA+PROSTHESIS+TREMOR", tier: "MEDIUM", label: "Med · Asthma + Prosthesis + Tremor" },
  { key: "M_BLIND+DEAF+PROSTHESIS",    tier: "MEDIUM", label: "Med · Blind + Deaf + Prosthesis" },
  { key: "M_BLIND+DEAF+TREMOR",        tier: "MEDIUM", label: "Med · Blind + Deaf + Tremor" },
  { key: "M_BLIND+PROSTHESIS+TREMOR",  tier: "MEDIUM", label: "Med · Blind + Prosthesis + Tremor" },
  { key: "M_DEAF+PROSTHESIS+TREMOR",   tier: "MEDIUM", label: "Med · Deaf + Prosthesis + Tremor" },
  // 1 Hard (5C5)
  { key: "H_ALL5",                     tier: "HARD",   label: "Hard · All 5 Traits" }
];

function resolveBoardKeyFromTraits(traitsObj) {
  const active = Object.keys(traitsObj || {})
    .filter(k => Boolean(traitsObj[k]))
    .map(k => k.toUpperCase())
    .sort();

  if (active.length === 1) return "E_" + active[0];
  if (active.length === 3) return "M_" + active.join("+");
  if (active.length === 5) return "H_ALL5";
  return null;
}

function sanitizePlayerName(raw) {
  return String(raw || "")
    .replace(/[^A-Za-z0-9_\-.!@#$+*?]/g, "")
    .slice(0, 10);
}

function detectClientOS() {
  const ua = navigator.userAgent || "";
  const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
  if (/iPhone|iPod/.test(ua)) return "iOS";
  if (/iPad/.test(ua) || (platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "iPadOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Win/i.test(platform) || /Windows/i.test(ua)) return "Windows";
  if (/Mac/i.test(platform) || /Mac OS X/i.test(ua)) return "macOS";
  if (/CrOS/i.test(ua)) return "ChromeOS";
  if (/Linux/i.test(platform) || /Linux/i.test(ua)) return "Linux";
  return "Other";
}

function detectHostingPlatform() {
  const ref = (document.referrer || "").toLowerCase();
  const host = (window.location.hostname || "").toLowerCase();
  const combined = ref + " " + host;

  if (combined.includes("plicy.net")) return "PLiCy";
  if (combined.includes("itch.io") || combined.includes("itch.zone") || combined.includes("hwcdn.net")) return "itch.io";
  if (combined.includes("gamejolt.com") || combined.includes("gamejolt.net")) return "GameJolt";
  if (combined.includes("github.io")) return "GitHub";
  return "Web";
}

function computeScoreSignature(boardKey, name, score, floorBeaten) {
  const raw = `UBS_V1|${boardKey}|${name}|${score}|${floorBeaten}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function getDefaultPlayerName() {
  try {
    const params = new URLSearchParams(window.location.search);
    const gjUser = params.get("gjapi_username");
    if (gjUser) return sanitizePlayerName(gjUser);
  } catch (_) {}

  try {
    return sanitizePlayerName(localStorage.getItem("ub_last_name") || "");
  } catch (_) {
    return "";
  }
}

function saveLastPlayerName(name) {
  try {
    localStorage.setItem("ub_last_name", name);
  } catch (_) {}
}

const ScoreboardUI = (() => {
  const boardCache = new Map();
  let activeBoardKey = "E_BLIND";
  let highlightRank = null;
  let rootEl = null;
  let cardEl = null;

  function applyResponsiveScale() {
    if (!cardEl || !isOpen()) return;
    const availW = Math.max(300, window.innerWidth - 16);
    const availH = Math.max(240, window.innerHeight - 16);
    const scale = Math.min(1, availW / CARD_BASE_W, availH / CARD_BASE_H);
    cardEl.style.transform = scale < 0.999 ? `scale(${scale.toFixed(4)})` : "none";
  }

  function populateBoardDropdown(tierFilter, preferredKey) {
    const boardSel = rootEl.querySelector("#ub-sb-board-select");
    const filtered = tierFilter === "ALL"
      ? SCOREBOARD_BOARDS
      : SCOREBOARD_BOARDS.filter(b => b.tier === tierFilter);

    boardSel.innerHTML = filtered
      .map(b => `<option value="${b.key}">${b.label}</option>`)
      .join("");

    if (preferredKey && filtered.some(b => b.key === preferredKey)) {
      boardSel.value = preferredKey;
    } else if (filtered.length > 0) {
      boardSel.value = filtered[0].key;
    }
    return boardSel.value;
  }

  function ensureModalDOM() {
    if (rootEl) return rootEl;

    const style = document.createElement("style");
    style.textContent = `
      #ub-sb-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background: rgba(15, 23, 42, 0.86);
        display: none;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        font-family: "Courier New", Consolas, monospace;
        color: #f8fafc;
      }
      #ub-sb-card {
        width: ${CARD_BASE_W}px;
        height: ${CARD_BASE_H}px;
        flex-shrink: 0;
        transform-origin: center center;
        background: #1e293b;
        border: 2px solid #facc15;
        border-radius: 6px;
        box-shadow: 0 14px 40px rgba(0, 0, 0, 0.65);
        display: flex;
        flex-direction: column;
        padding: 14px 16px;
        box-sizing: border-box;
        gap: 10px;
      }
      #ub-sb-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      #ub-sb-controls {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .ub-sb-select {
        background: #0f172a;
        color: #facc15;
        border: 1px solid #475569;
        padding: 5px 8px;
        font-family: inherit;
        font-size: 13px;
        border-radius: 4px;
      }
      #ub-sb-close {
        background: #dc2626;
        color: #ffffff;
        border: none;
        padding: 6px 12px;
        font-family: inherit;
        font-size: 13px;
        font-weight: bold;
        cursor: pointer;
        border-radius: 4px;
      }
      #ub-sb-submit-box {
        background: #0f172a;
        border: 1px solid #facc15;
        border-radius: 4px;
        padding: 8px 10px;
        display: none;
        flex-direction: column;
        gap: 6px;
      }
      #ub-sb-run-summary {
        font-size: 12px;
        color: #e2e8f0;
      }
      #ub-sb-submit-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #ub-sb-name-input {
        width: 136px;
        background: #1e293b;
        color: #ffffff;
        border: 1px solid #facc15;
        border-radius: 3px;
        padding: 5px 8px;
        font-family: inherit;
        font-size: 14px;
        font-weight: bold;
      }
      #ub-sb-submit-btn {
        background: #16a34a;
        color: #ffffff;
        border: none;
        border-radius: 3px;
        padding: 6px 14px;
        font-family: inherit;
        font-size: 13px;
        font-weight: bold;
        cursor: pointer;
      }
      #ub-sb-submit-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      #ub-sb-scroll {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        border: 1px solid #334155;
        background: #0f172a;
      }
      #ub-sb-table {
        width: 820px;
        table-layout: fixed;
        border-collapse: collapse;
        font-size: 13px;
      }
      #ub-sb-table th {
        position: sticky;
        top: 0;
        z-index: 2;
        background: #334155;
        color: #facc15;
        padding: 7px 6px;
        border-bottom: 1px solid #475569;
        white-space: nowrap;
      }
      #ub-sb-table td {
        padding: 6px 6px;
        border-bottom: 1px solid #1e293b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #ub-sb-table .col-rank  { width: 62px;  text-align: left; }
      #ub-sb-table .col-name  { width: 128px; text-align: left; font-weight: bold; }
      #ub-sb-table .col-score { width: 122px; text-align: right; color: #fde047; }
      #ub-sb-table .col-floor { width: 74px;  text-align: center; }
      #ub-sb-table .col-os    { width: 96px;  text-align: center; color: #cbd5e1; }
      #ub-sb-table .col-site  { width: 96px;  text-align: center; color: #38bdf8; }
      #ub-sb-table .col-time  { width: 242px; text-align: right; color: #94a3b8; }
      #ub-sb-table tr:nth-child(even) { background: rgba(30, 41, 59, 0.45); }
      #ub-sb-table tr.ub-me {
        background: rgba(250, 204, 21, 0.24);
        color: #fef08a;
        font-weight: bold;
      }
      #ub-sb-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;
        color: #94a3b8;
      }
      #ub-sb-top-btn {
        background: #334155;
        color: #f8fafc;
        border: 1px solid #475569;
        border-radius: 3px;
        padding: 3px 9px;
        font-family: inherit;
        font-size: 11px;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);

    rootEl = document.createElement("div");
    rootEl.id = "ub-sb-overlay";
    rootEl.innerHTML = `
      <div id="ub-sb-card">
        <div id="ub-sb-header">
          <div id="ub-sb-controls">
            <strong style="color:#facc15;font-size:15px;">GLOBAL TOP 5,000</strong>
            <select id="ub-sb-tier-select" class="ub-sb-select">
              <option value="ALL">All Tiers (16)</option>
              <option value="EASY">Easy (5)</option>
              <option value="MEDIUM">Medium (10)</option>
              <option value="HARD">Hard (1)</option>
            </select>
            <select id="ub-sb-board-select" class="ub-sb-select"></select>
          </div>
          <button id="ub-sb-close" type="button">CLOSE [ESC]</button>
        </div>

        <div id="ub-sb-submit-box">
          <div id="ub-sb-run-summary"></div>
          <div id="ub-sb-submit-row">
            <input id="ub-sb-name-input" type="text" maxlength="10" autocomplete="off" spellcheck="false" placeholder="Name (10 max)" />
            <button id="ub-sb-submit-btn" type="button">POST SCORE</button>
            <span id="ub-sb-submit-msg" style="font-size:12px;color:#facc15;"></span>
          </div>
        </div>

        <div id="ub-sb-scroll">
          <table id="ub-sb-table">
            <thead>
              <tr>
                <th class="col-rank">#</th>
                <th class="col-name">NAME</th>
                <th class="col-score">SCORE</th>
                <th class="col-floor">FLOOR</th>
                <th class="col-os">OS</th>
                <th class="col-site">SITE</th>
                <th class="col-time">END TIME (GMT)</th>
              </tr>
            </thead>
            <tbody id="ub-sb-tbody"></tbody>
          </table>
        </div>

        <div id="ub-sb-footer">
          <span id="ub-sb-count-info">0 players</span>
          <span id="ub-sb-status">Scroll down to load more</span>
          <button id="ub-sb-top-btn" type="button">TOP ^</button>
        </div>
      </div>
    `;
    document.body.appendChild(rootEl);
    cardEl = rootEl.querySelector("#ub-sb-card");

    const tierSel = rootEl.querySelector("#ub-sb-tier-select");
    const boardSel = rootEl.querySelector("#ub-sb-board-select");
    populateBoardDropdown("ALL", activeBoardKey);

    tierSel.addEventListener("change", () => {
      highlightRank = null;
      const nextKey = populateBoardDropdown(tierSel.value, null);
      selectBoard(nextKey);
    });

    boardSel.addEventListener("change", () => {
      highlightRank = null;
      selectBoard(boardSel.value);
    });

    const nameInput = rootEl.querySelector("#ub-sb-name-input");
    nameInput.addEventListener("input", () => {
      const cleaned = sanitizePlayerName(nameInput.value);
      if (nameInput.value !== cleaned) nameInput.value = cleaned;
    });

    const scrollBox = rootEl.querySelector("#ub-sb-scroll");
    scrollBox.addEventListener("scroll", () => {
      const nearBottom = scrollBox.scrollTop + scrollBox.clientHeight >= scrollBox.scrollHeight - 60;
      if (nearBottom) loadMoreRows(activeBoardKey);
    });

    rootEl.querySelector("#ub-sb-top-btn").addEventListener("click", () => {
      scrollBox.scrollTop = 0;
    });

    rootEl.querySelector("#ub-sb-close").addEventListener("click", close);
    window.addEventListener("resize", applyResponsiveScale);
    return rootEl;
  }

  function getBoardState(boardKey) {
    if (!boardCache.has(boardKey)) {
      boardCache.set(boardKey, { rows: [], total: 0, nextOffset: 0, hasMore: true, loading: false });
    }
    return boardCache.get(boardKey);
  }

  function renderRows(boardKey) {
    const el = ensureModalDOM();
    const state = getBoardState(boardKey);
    const tbody = el.querySelector("#ub-sb-tbody");
    const countEl = el.querySelector("#ub-sb-count-info");
    const statusEl = el.querySelector("#ub-sb-status");

    tbody.innerHTML = state.rows.map(r => {
      const isMe = highlightRank !== null && r.rank === highlightRank;
      return `
        <tr class="${isMe ? "ub-me" : ""}">
          <td class="col-rank">${isMe ? ">" : ""}${r.rank}</td>
          <td class="col-name">${escapeHtml(r.name)}</td>
          <td class="col-score">${Number(r.score).toLocaleString()}</td>
          <td class="col-floor">${r.floorBeaten}F</td>
          <td class="col-os">${escapeHtml(r.os)}</td>
          <td class="col-site">${escapeHtml(r.platform || "Web")}</td>
          <td class="col-time">${escapeHtml(r.endedAtGmt)}</td>
        </tr>
      `;
    }).join("");

    countEl.textContent = state.total > 0
      ? `Showing ${state.rows.length} of ${state.total.toLocaleString()}`
      : "0 records";

    if (state.loading) {
      statusEl.textContent = `Loading #${state.nextOffset + 1}–#${state.nextOffset + PAGE_CHUNK_SIZE}...`;
    } else if (state.rows.length === 0) {
      statusEl.textContent = "No records yet — be the first!";
    } else if (state.hasMore) {
      statusEl.textContent = `Scroll down to load next ${PAGE_CHUNK_SIZE}`;
    } else {
      statusEl.textContent = "End of leaderboard";
    }
  }

  async function loadMoreRows(boardKey) {
    const state = getBoardState(boardKey);
    if (state.loading || !state.hasMore) return;

    state.loading = true;
    renderRows(boardKey);

    try {
      const url = `${SCOREBOARD_API_URL}?board=${encodeURIComponent(boardKey)}&offset=${state.nextOffset}&limit=${PAGE_CHUNK_SIZE}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to load");

      state.rows.push(...(data.rows || []));
      state.total = data.total || state.rows.length;
      state.nextOffset = data.nextOffset || state.rows.length;
      state.hasMore = Boolean(data.hasMore);
    } catch (err) {
      const el = ensureModalDOM();
      el.querySelector("#ub-sb-status").textContent = "Load error: " + err.message;
    } finally {
      state.loading = false;
      if (activeBoardKey === boardKey) renderRows(boardKey);
    }
  }

  function selectBoard(boardKey) {
    activeBoardKey = boardKey;
    const el = ensureModalDOM();
    el.querySelector("#ub-sb-tier-select").value = "ALL";
    populateBoardDropdown("ALL", boardKey);
    el.querySelector("#ub-sb-scroll").scrollTop = 0;

    const state = getBoardState(boardKey);
    renderRows(boardKey);
    if (state.rows.length === 0 && state.hasMore) {
      loadMoreRows(boardKey);
    }
  }

  function openVictorySubmit(gameState, heroState) {
    const el = ensureModalDOM();
    const boardKey = resolveBoardKeyFromTraits(heroState.traits);
    const baseFloors = Math.max(1, Math.floor(gameState.transitions || 0));
    const bossBonus = (gameState.bossDefeated || gameState.room?.roomType === "TREASURE" || gameState.room?.isFinal) ? 1 : 0;
    const floorBeaten = Number.isFinite(gameState.floorBeaten) ? gameState.floorBeaten : (baseFloors + bossBonus);
    const score = Math.max(0, Math.floor(gameState.score || 0));
    const os = detectClientOS();
    const platform = detectHostingPlatform();

    el.style.display = "flex";
    applyResponsiveScale();

    const submitBox = el.querySelector("#ub-sb-submit-box");
    const summaryEl = el.querySelector("#ub-sb-run-summary");
    const submitBtn = el.querySelector("#ub-sb-submit-btn");
    const msgEl = el.querySelector("#ub-sb-submit-msg");
    const nameInput = el.querySelector("#ub-sb-name-input");

    if (!boardKey) {
      submitBox.style.display = "none";
      selectBoard("E_BLIND");
      return;
    }

    submitBox.style.display = "flex";
    submitBtn.disabled = false;
    msgEl.textContent = "Allowed: A-Z, a-z, 0-9, _ - . ! @ # $ + * ?";
    nameInput.value = getDefaultPlayerName();
    summaryEl.textContent = `BOARD: ${boardKey}  |  SCORE: ${score.toLocaleString()}  |  FLOOR: ${floorBeaten}F  |  OS: ${os}  |  SITE: ${platform}`;

    submitBtn.onclick = async () => {
      const cleanName = sanitizePlayerName(nameInput.value) || "SEEKER";
      saveLastPlayerName(cleanName);
      submitBtn.disabled = true;
      msgEl.textContent = "Posting score...";

      try {
        const sig = computeScoreSignature(boardKey, cleanName, score, floorBeaten);
        const res = await fetch(SCOREBOARD_API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            boardKey,
            name: cleanName,
            score,
            floorBeaten,
            os,
            platform,
            sig
          })
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Submit failed");

        highlightRank = data.rank;
        msgEl.textContent = data.rank
          ? `Rank #${data.rank} of ${data.total} (${data.record.endedAtGmt})`
          : "Submitted (outside Top 5,000)";

        boardCache.delete(boardKey);
        selectBoard(boardKey);
      } catch (err) {
        submitBtn.disabled = false;
        msgEl.textContent = "Error: " + err.message;
      }
    };

    selectBoard(boardKey);
    setTimeout(() => nameInput.focus(), 50);
  }

  function openBrowser(initialBoardKey = "E_BLIND") {
    const el = ensureModalDOM();
    highlightRank = null;
    el.querySelector("#ub-sb-submit-box").style.display = "none";
    el.style.display = "flex";
    applyResponsiveScale();
    selectBoard(initialBoardKey);
  }

  function close() {
    if (rootEl) rootEl.style.display = "none";
  }

  function isOpen() {
    return Boolean(rootEl && rootEl.style.display === "flex");
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    }[ch]));
  }

  return { openVictorySubmit, openBrowser, close, isOpen };
})();
