// GUGU-GBF 侧边栏逻辑（复刻 Tarou 侧边栏展示数据）
// 从 background 读取截获的数据 + 诊断，渲染明细供与网页核对。

async function fetchCollected() {
  try {
    const res = await chrome.runtime.sendMessage({ type: "gbf_get_collected" });
    return (res && res.cache) || {};
  } catch (e) {
    return {};
  }
}

const EL = { "1": "火", "2": "水", "3": "土", "4": "风", "5": "光", "6": "暗" };
function fmtAttr(v) {
  if (v === undefined || v === null || v === "") return "?";
  return EL[String(v)] || v;
}
function rarityStr(v) {
  const s = String(v || "");
  return { "3": "SR", "4": "SSR", "1": "R", "2": "R" }[s] || s;
}

function renderCharacters(container, list) {
  if (!list || !list.length) { container.innerHTML = "<i class=muted>暂无角色数据</i>"; return; }
  container.innerHTML = list.map((c) => `
    <div class="raw-item">
      <b>${c.name || c.id}</b>
      <span class="raw-field"> ${fmtAttr(c.attribute)}属性 · ${rarityStr(c.rarity)} · 类型${c.type ?? "?"}</span><br/>
      <span class="kv"><span class="raw-field">攻</span>${c.attack}</span>
      <span class="kv"><span class="raw-field">血</span>${c.hp}</span>
      <span class="kv"><span class="raw-field">得意</span>${(c.weapon || "").split(",").join("/")}</span>
    </div>`).join("");
}

function renderWeapons(container, list) {
  if (!list || !list.length) { container.innerHTML = "<i class=muted>暂无武器数据</i>"; return; }
  container.innerHTML = list.map((w) => {
    const skills = [];
    for (let i = 1; i <= 4; i++) { const sk = w["skill" + i]; if (sk && sk.name) skills.push(sk.name); }
    const lv = w.level ?? (w.param && w.param.level);
    return `<div class="raw-item">
      <b>${w.name}</b> <span class="raw-field">${fmtAttr(w.attribute)} · Lv${lv ?? "?"}</span><br/>
      <span class="kv"><span class="raw-field">攻</span>${w.attack}</span>
      <span class="kv"><span class="raw-field">血</span>${w.hp}</span>
      <span class="raw-field">技能:</span>${skills.join("、") || "无"}
    </div>`;
  }).join("");
}

function renderSummons(container, list) {
  if (!list || !list.length) { container.innerHTML = "<i class=muted>暂无召唤数据</i>"; return; }
  container.innerHTML = list.map((s) => `
    <div class="raw-item">
      <b>${s.name}</b> <span class="raw-field">${fmtAttr(s.attribute)}属性 · ${rarityStr(s.rarity)}</span><br/>
      <span class="kv"><span class="raw-field">攻</span>${s.attack}</span>
      <span class="kv"><span class="raw-field">血</span>${s.hp}</span>
    </div>`).join("");
}

function extractAndRender(cache) {
  let charList = [];
  const npcRaw = cache.character && cache.character.data;
  if (npcRaw && npcRaw.list) {
    charList = npcRaw.list.map((it) => ({ ...(it.master || {}), ...(it.param || {}) }));
  } else {
    const deckData = cache.deck && cache.deck.data;
    if (deckData && deckData.deck && deckData.deck.npc) {
      charList = Object.values(deckData.deck.npc).map((it) => ({ ...(it.master || {}), ...(it.param || {}) }));
    }
  }
  const charEl = document.getElementById("raw-characters");
  if (charList.length) { renderCharacters(charEl, charList); document.getElementById("c-char").textContent = charList.length; }
  else { charEl.innerHTML = "<i class=muted>暂无角色数据</i>"; document.getElementById("c-char").textContent = "0"; }

  let wepList = [];
  const lw = cache.weapon && cache.weapon.data;
  if (lw && lw.list) {
    wepList = lw.list.map((it) => ({ ...(it.master || {}), ...(it.param || {}) }));
  } else {
    const deckData = cache.deck && cache.deck.data;
    if (deckData && deckData.deck && deckData.deck.pc && deckData.deck.pc.weapons) {
      wepList = Object.values(deckData.deck.pc.weapons).map((it) => ({ ...(it.master || {}), ...(it.param || {}), ...it }));
    }
  }
  const wepEl = document.getElementById("raw-weapons");
  if (wepList.length) { renderWeapons(wepEl, wepList); document.getElementById("c-weapon").textContent = wepList.length; }
  else { wepEl.innerHTML = "<i class=muted>暂无武器数据</i>"; document.getElementById("c-weapon").textContent = "0"; }

  let sumList = [];
  const ls = cache.summon && cache.summon.data;
  if (ls && ls.list) {
    sumList = ls.list.map((it) => ({ ...(it.master || {}), ...(it.param || {}) }));
  } else {
    const deckData = cache.deck && cache.deck.data;
    if (deckData && deckData.deck && deckData.deck.pc && deckData.deck.pc.summons) {
      sumList = Object.values(deckData.deck.pc.summons).map((it) => ({ ...(it.master || {}), ...(it.param || {}), ...it }));
    }
  }
  const sumEl = document.getElementById("raw-summons");
  if (sumList.length) { renderSummons(sumEl, sumList); document.getElementById("c-summon").textContent = sumList.length; }
  else { sumEl.innerHTML = "<i class=muted>暂无召唤数据</i>"; document.getElementById("c-summon").textContent = "0"; }

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
    el.innerHTML = `<div class="raw-item">
      <b>${d.name || "未命名"}</b> <span class="raw-field">${d.group_name || ""}</span><br/>
      <span class="raw-field">角色:</span> ${npcNames}<br/>
      <span class="raw-field">队伍地址:</span> ${(cache.deck.url || "").split("?")[0] || "-"}
    </div>`;
  } else {
    document.getElementById("c-deck").textContent = "0";
    el.innerHTML = "<i class=muted>暂无队伍编成数据（打开编成页后自动采集）</i>";
  }
}

function updateStatus(cache) {
  const last = [];
  for (const k of ["character", "weapon", "summon", "deck"]) {
    if (cache[k] && cache[k].time) last.push(`${k}:${new Date(cache[k].time).toLocaleTimeString()}`);
  }
  document.getElementById("last-update").textContent =
    last.length ? "最近截获: " + last.join(" · ") : "尚未读取 · 打开游戏页后自动采集";

  try {
    chrome.storage.local.get("gugu_gbf_diag", (obj) => {
      const box = document.getElementById("diag-box");
      const d = obj && obj.gugu_gbf_diag;
      if (!d) {
        box.textContent = "暂无诊断数据。\ncontent script 未写入诊断。可能：尚未刷新游戏页，或注入失败。\n请刷新 GBF 页面后点「立即读取」。";
        return;
      }
      const lines = [
        "注入时间: " + (d.time ? new Date(d.time).toLocaleTimeString() : "-"),
        "注入页面: " + (d.url || "-"),
        "是否 iframe: " + (d.isIframe === true ? "是（子框架）" : d.isIframe === false ? "否（顶层）" : "未知"),
        "jQuery 就绪: " + (d.jquery ? "是" : "否"),
        "主世界inject加载: " + (d.injectLoaded ? "已加载" : "❌未加载"),
        "主世界inject状态: " + ({ hooked: "✅已挂接", "no-jquery": "❌无jQuery(30秒超时)", loaded: "已加载" }[d.injectState] || d.injectState || "-"),
        "已接收数据条数: " + (d.received ?? 0),
        "最近类型: " + (d.lastKind || "-"),
      ];
      box.textContent = lines.join("\n");
      if (d.contentInjected && !d.injectLoaded) {
        box.textContent += "\n\n⚠️ content script 已注入，但主世界 inject.js 未加载。\n原因：GBF 页面的 Content-Security-Policy 可能阻止了外部脚本注入。\n需改用 chrome.scripting 以 MAIN world 注入方式。";
      } else if (d.injectLoaded && (d.received ?? 0) === 0) {
        box.textContent += "\n\n⚠️ inject.js 已加载，但未捕获到数据。\n若状态为「已挂接」，请在游戏内切换页面触发请求后再「立即读取」。";
      }
    });
  } catch (e) {}
}

async function refresh() {
  const cache = await fetchCollected();
  extractAndRender(cache);
}

document.getElementById("btn-refresh").addEventListener("click", () => { refresh(); });
refresh();