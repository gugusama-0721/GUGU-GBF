// GUGU-GBF popup 逻辑 —— 数据读取验证视图
// 拉取 background 截获的原始接口数据，原样展示关键字段，供与网页核对。

const ANALYZER_URL = "http://127.0.0.1:8765";

// ---------- 从 background 读取已截获数据 ----------
async function fetchCollected() {
  try {
    const res = await chrome.runtime.sendMessage({ type: "gbf_get_collected" });
    return (res && res.cache) || {};
  } catch (e) {
    return {};
  }
}

// 属性数字 -> 中文（用于直接展示原始 field）
const EL = { "1": "火", "2": "水", "3": "土", "4": "风", "5": "光", "6": "暗" };

function fmtAttr(v) {
  if (v === undefined || v === null || v === "") return "?";
  return EL[String(v)] || v;
}

function rarityStr(v) {
  const s = String(v || "");
  return { "3": "SR", "4": "SSR", "1": "R", "2": "R" }[s] || s;
}

// ---------- 渲染角色（npc/list 或 deck.npc） ----------
function renderCharacters(container, list) {
  if (!container) return;
  if (!list || !list.length) {
    container.innerHTML = "<i>暂无角色数据</i>";
    return;
  }
  container.innerHTML = list
    .map((c) => {
      return `<div class="raw-item">
        <b>${c.name || c.id}</b>
        <span class="raw-field"> ${fmtAttr(c.attribute)}属性 · ${rarityStr(c.rarity)} · 类型${c.type ?? "?"}</span><br/>
        <span class="kv"><span class="raw-field">攻</span>${c.attack}</span>
        <span class="kv"><span class="raw-field">血</span>${c.hp}</span>
        <span class="kv"><span class="raw-field">得意武器</span>${(c.weapon || "").split(",").join("/")}</span>
      </div>`;
    })
    .join("");
}

// ---------- 渲染武器 ----------
function renderWeapons(container, list) {
  if (!container) return;
  if (!list || !list.length) {
    container.innerHTML = "<i>暂无武器数据</i>";
    return;
  }
  container.innerHTML = list
    .map((w) => {
      const skills = [];
      for (let i = 1; i <= 4; i++) {
        const sk = w["skill" + i];
        if (sk && sk.name) skills.push(sk.name);
      }
      return `<div class="raw-item">
        <b>${w.name}</b> <span class="raw-field">${fmtAttr(w.attribute)} · Lv${w.level ?? (w.param && w.param.level) ?? "?"} · 技能Lv${w.skill_level ?? "?"}</span><br/>
        <span class="kv"><span class="raw-field">攻</span>${w.attack}</span>
        <span class="kv"><span class="raw-field">血</span>${w.hp}</span>
        <span class="raw-field">技能:</span>${skills.join("、") || "无"}
      </div>`;
    })
    .join("");
}

// ---------- 渲染召唤 ----------
function renderSummons(container, list) {
  if (!container) return;
  if (!list || !list.length) {
    container.innerHTML = "<i>暂无召唤数据</i>";
    return;
  }
  container.innerHTML = list
    .map((s) => {
      return `<div class="raw-item">
        <b>${s.name}</b> <span class="raw-field">${fmtAttr(s.attribute)}属性 · ${rarityStr(s.rarity)}</span><br/>
        <span class="kv"><span class="raw-field">攻</span>${s.attack}</span>
        <span class="kv"><span class="raw-field">血</span>${s.hp}</span>
      </div>`;
    })
    .join("");
}

// ---------- 抽取并渲染三类数据（兼容 list 接口和 deck 接口两种结构） ----------
function extractAndRender(cache) {
  // ---- 角色 ----
  let charList = [];
  const npcRaw = cache.character && cache.character.data;
  if (npcRaw && npcRaw.list) {
    // npc/list 接口：list[].master + list[].param
    charList = npcRaw.list.map((it) => ({ ...(it.master || {}), ...(it.param || {}) }));
  } else {
    // deck 接口（在 deck.npc）
    const deckData = cache.deck && cache.deck.data;
    if (deckData && deckData.deck && deckData.deck.npc) {
      charList = Object.values(deckData.deck.npc).map((it) => ({
        ...(it.master || {}), ...(it.param || {}),
      }));
    }
  }
  const charEl = document.getElementById("raw-characters");
  if (charList.length) {
    renderCharacters(charEl, charList);
    document.getElementById("c-char").textContent = charList.length;
  } else {
    charEl.innerHTML = "<i>暂无角色数据</i>";
    document.getElementById("c-char").textContent = "0";
  }

  // ---- 武器 ----
  let wepList = [];
  const lw = cache.weapon && cache.weapon.data;
  if (lw && lw.list) {
    wepList = lw.list.map((it) => ({ ...(it.master || {}), ...(it.param || {}) }));
  } else {
    const deckData = cache.deck && cache.deck.data;
    if (deckData && deckData.deck && deckData.deck.pc && deckData.deck.pc.weapons) {
      wepList = Object.values(deckData.deck.pc.weapons).map((it) => ({
        ...(it.master || {}), ...(it.param || {}), ...it,
      }));
    }
  }
  const wepEl = document.getElementById("raw-weapons");
  if (wepList.length) {
    renderWeapons(wepEl, wepList);
    document.getElementById("c-weapon").textContent = wepList.length;
  } else {
    wepEl.innerHTML = "<i>暂无武器数据</i>";
    document.getElementById("c-weapon").textContent = "0";
  }

  // ---- 召唤 ----
  let sumList = [];
  const ls = cache.summon && cache.summon.data;
  if (ls && ls.list) {
    sumList = ls.list.map((it) => ({ ...(it.master || {}), ...(it.param || {}) }));
  } else {
    const deckData = cache.deck && cache.deck.data;
    if (deckData && deckData.deck && deckData.deck.pc && deckData.deck.pc.summons) {
      sumList = Object.values(deckData.deck.pc.summons).map((it) => ({
        ...(it.master || {}), ...(it.param || {}), ...it,
      }));
    }
  }
  const sumEl = document.getElementById("raw-summons");
  if (sumList.length) {
    renderSummons(sumEl, sumList);
    document.getElementById("c-summon").textContent = sumList.length;
  } else {
    sumEl.innerHTML = "<i>暂无召唤数据</i>";
    document.getElementById("c-summon").textContent = "0";
  }

  // ---- 队伍编成原始信息 ----
  renderDeck(cache);
  updateStatus(cache);
}

function renderDeck(cache) {
  const el = document.getElementById("raw-deck");
  const deckData = cache.deck && cache.deck.data;
  if (deckData && deckData.deck) {
    const d = deckData.deck;
    const npcNames = d.npc ? Object.values(d.npc).map((it) => (it.master && it.master.name) || "?").join("、") : "空";
    document.getElementById("c-deck").textContent = npcNames.split("、").length;
    el.innerHTML = `
      <div class="raw-item">
        <b>${d.name || "未命名"}</b> <span class="raw-field">${d.group_name || ""}</span><br/>
        <span class="raw-field">角色:</span> ${npcNames}<br/>
        <span class="raw-field">队伍地址:</span> ${(cache.deck.url || "").split("?")[0] || "-"}
      </div>`;
  } else {
    document.getElementById("c-deck").textContent = "0";
    el.innerHTML = "<i>暂无队伍编成数据（打开编成页后自动采集）</i>";
  }
}

function updateStatus(cache) {
  const last = [];
  for (const k of ["character", "weapon", "summon", "deck"]) {
    if (cache[k] && cache[k].time) last.push(`${k}:${new Date(cache[k].time).toLocaleTimeString()}`);
  }
  document.getElementById("last-update").textContent =
    last.length ? "最近截获: " + last.join(" · ") : "尚未读取 · 打开游戏页面后自动采集";
}

async function refresh() {
  const cache = await fetchCollected();
  extractAndRender(cache);
}

document.getElementById("btn-refresh").addEventListener("click", () => {
  refresh().then(() => {});
});

refresh();