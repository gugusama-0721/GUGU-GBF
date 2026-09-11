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
      // 叠加展示 CDP/debugger 状态
      chrome.storage.local.get("gugu_gbf_dbg", (dbgObj) => {
        const db = dbgObj && dbgObj.gugu_gbf_dbg;
        const dbgLine = db
          ? [
              "\n===== CDP/debugger 状态 =====",
              "attach: " + (db.state === "attached" ? "✅已附加" : db.state === "attach-fail" ? "❌附加失败" : db.state),
              "attach详情: " + (db.detail || "-"),
              "捕获响应数: " + (db.captured ?? 0),
              "最近捕获: " + (db.lastKind || "-"),
            ]
          : ["\n===== CDP/debugger 状态 =====", "暂无状态。debugger 未记录（可能扩展未重载或未打开 GBF 页）"];
      const lines = [
        "注入时间: " + (d.time ? new Date(d.time).toLocaleTimeString() : "-"),
        "注入页面: " + (d.url || "-"),
        "是否 iframe: " + (d.isIframe === true ? "是（子框架）" : d.isIframe === false ? "否（顶层）" : "未知"),
        "jQuery 就绪: " + (d.jquery ? "是" : "否"),
        "主世界inject加载: " + (d.injectLoaded ? "已加载" : "❌未加载"),
        "主世界inject状态: " + ({ hooked: "✅已挂接", "no-jquery": "❌无jQuery(30秒超时)", loaded: "已加载" }[d.injectState] || d.injectState || "-"),
        "已接收数据条数: " + (d.received ?? 0),
        "最近类型: " + (d.lastKind || "-"),
        ...dbgLine,
      ];
      box.textContent = lines.join("\n");
      // 追加最近请求 URL
      chrome.storage.local.get("gugu_gbf_recent", (rc) => {
        const list = (rc && rc.gugu_gbf_recent) || [];
        if (list.length) {
          const shown = list.map((r) => `  ${r.type||"-"} ${(r.url||"").replace("https://game.granbluefantasy.jp","")}`).join("\n");
          box.textContent += "\n\n===== 最近 CDP 请求 =====" + (shown.length > 900 ? shown.slice(-900) : shown);
        } else {
          box.textContent += "\n\n(暂无 CDP 请求记录)";
        }
      });
      if (db && db.state === "attached" && (db.captured ?? 0) === 0) {
        box.textContent += "\n\n⚠️ debugger 已附加但未捕获到目标接口。\nCDP 层级监控正常，但当前页面没触发 角色/武器/召唤/队伍 请求。请进入对应页面。";
      } else if (!db || db.state !== "attached") {
        box.textContent += "\n\n⚠️ debugger 未附加成功。\n可能是：①Tarou 或其他扩展占用；②标签页已自动 attach 但被 detach。\n请停用 Tarou 后重载扩展、重开 GBF 标签页。";
      }
      });
    });
  } catch (e) {}
}

async function refresh() {
  const cache = await fetchCollected();
  extractAndRender(cache);
}

document.getElementById("btn-refresh").addEventListener("click", () => { refresh(); });
const btnHome = document.getElementById("btn-home");
if (btnHome) btnHome.addEventListener("click", () => { window.open("https://github.com/gugusama-0721/GUGU-GBF", "_blank"); });
refresh();