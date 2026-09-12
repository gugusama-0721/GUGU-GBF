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
  document.getElementById("c-char").textContent = charList.length;

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
  document.getElementById("c-weapon").textContent = wepList.length;

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
  document.getElementById("c-summon").textContent = sumList.length;

  // 队伍数量由可视化函数 renderDeckVisual 处理，这里仅汇总计数
  const deckData = cache.deck && cache.deck.data;
  if (deckData && deckData.deck && deckData.deck.npc) {
    document.getElementById("c-deck").textContent = Object.values(deckData.deck.npc).length;
  } else {
    document.getElementById("c-deck").textContent = "0";
  }

  updateStatus(cache);
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
  renderRawBox(cache);
  renderBattle(cache);
  extractAndRender(cache);
  renderDeckVisual(cache);
  renderDeckCharacters(cache);
  renderWeaponGrid(cache);
  renderSummonGrid(cache);
  renderStatEstimate(cache);
}

// 战斗实时事件（WebSocket，复刻 Tarou）
async function renderBattle() {
  const box = document.getElementById("battle-box");
  if (!box) return;
  let list = null;
  try { list = (await chrome.storage.local.get("gugu_gbf_battle")).gugu_gbf_battle || []; } catch (e) { list = []; }
  if (!list.length) { box.innerHTML = '<i class="muted">进入副本战斗后，WebSocket 服务器实时推送事件会显示于此</i>'; return; }
  box.innerHTML = list.map((b) => {
    const t = new Date(b.t || Date.now());
    const hm = t.toTimeString().slice(0, 8);
    return `<div style="font-size:11px;padding:3px 0;border-bottom:1px dashed var(--line)">
      <span style="color:var(--muted)">${hm}</span>
      <span style="color:${b.dir==='发'?'var(--accent)':'var(--ok)'}">[${b.dir}]</span>
      <b style="color:var(--gold)">${b.evt}</b>
      <span style="color:var(--muted)"> ${b.summary||''}</span>
    </div>`;
  }).join("");
}

function renderRawBox(cache) {
  const box = document.getElementById("raw-box");
  if (!box) return;
  const parts = [];
  for (const k of ["deck", "character", "weapon", "summon"]) {
    const item = cache[k];
    if (item && item.data !== undefined) {
      parts.push("===== " + k + " (" + item.time + ") =====\n" + JSON.stringify(item.data).slice(0, 3000));
    } else {
      parts.push("===== " + k + " =====\n(无)");
    }
  }
  box.textContent = parts.join("\n\n");
}

const ATTR_COLOR = { "1":"#ff5b2e", "2":"#3fb0ff", "3":"#c8a24a", "4":"#7fd14a", "5":"#ffd23f", "6":"#a56bff" };
const ATTR_CHAR = { "1":"🔥", "2":"💧", "3":"⛰️", "4":"🌪️", "5":"🌕", "6":"🌑" };
const ATTR_NAME = { "1":"火","2":"水","3":"土","4":"风","5":"光","6":"暗" };

function charTag(v){ return ATTR_CHAR[String(v)] || ""; }
function charColor(v){ return ATTR_COLOR[String(v)] || "#555"; }

// 队伍总览：成员缩略条
function normalizeDeck(deckData) {
  // 兼容多种真实结构：deck.npc、deck.deck_list[]、平铺 deck
  if (!deckData) return null;
  // 顶层直接是 deck_list
  if (Array.isArray(deckData.deck_list)) {
    return deckData.deck_list[0] || deckData.deck_list;
  }
  return deckData;
}
function deckNPCs(d) {
  if (!d) return [];
  if (d.npc) return Object.values(d.npc);
  if (d.party && d.party.npc) return Object.values(d.party.npc);
  if (d.deck && d.deck.npc) return Object.values(d.deck.npc);
  return [];
}
function deckPC(d) {
  if (!d) return {};
  if (d.pc) return d.pc;
  if (d.party && d.party.pc) return d.party.pc;
  return {};
}
function renderDeckVisual(cache){
  const nameEl = document.getElementById("deck-name");
  const slotEl = document.getElementById("deck-slot");
  const memEl = document.getElementById("deck-members");
  const deckData = cache.deck && cache.deck.data;
  if(!deckData){
    nameEl.textContent = "未读取"; slotEl.textContent = "";
    memEl.innerHTML = '<i class="muted">打开编成页后自动采集</i>'; return;
  }
  const d = normalizeDeck(cache.deck.data);
  nameEl.textContent = (d && (d.name || d.deck_name)) || "Deck";
  slotEl.textContent = (d && (d.group_name || (cache.deck.url||"").split("?")[0])) || "";
  const npcs = deckNPCs(d);
  if(!npcs.length){ memEl.innerHTML='<i class="muted">无成员（原始结构见🔬原始数据）</i>'; return; }
  memEl.innerHTML = npcs.map((it,i)=>{
    const m = it.master||{}, p = it.param||{};
    const attr = String(m.element !== undefined ? m.element : p.element);
    return `<div class="m-cell">
      <div class="attr" style="background:${charColor(attr)}"></div>
      <div class="mn">${m.name || (m.unit_name || "?")}</div>
      <div class="mnum">${p.level ? "Lv"+p.level : ""}</div>
      <div class="ms">${ATTR_NAME[attr]||""} ${m.rare_name||""}</div>
    </div>`;
  }).join("");
}

// 角色头卡
function renderDeckCharacters(cache){
  const el = document.getElementById("ch-grid");
  const deckData = cache.deck && cache.deck.data;
  let list = deckNPCs(normalizeDeck(deckData));
  if(!list.length){
    const raw = cache.character && cache.character.data;
    if(raw && raw.list) list = raw.list;
  }
  if(!list.length){ el.innerHTML='<i class="muted">暂无角色数据</i>'; return; }
  // 优先从 deck 取 master.name 作真实名称
  el.innerHTML = list.map((it)=>{
    const m = it.master||{}, p = it.param||{};
    const attr = m.element !== undefined ? m.element : p.element;
    const name = (m && m.name) || "";
    return `<div class="ch-card">
      <div class="ch-head">
        <span class="ch-rarity">SSR</span>
        <div class="ch-avatar"></div>
        <div class="ch-attr" style="background:${charColor(attr)}"></div>
      </div>
      <div class="ch-body">
        <div class="ch-name">${name||it.id}</div>
        <div class="ch-stats">
          <span>攻<b>${p.attack||m.attack||"-"}</b></span>
          <span>血<b>${p.hp||m.hp||"-"}</b></span>
        </div>
        <div class="ch-type">${ATTR_NAME[attr]||""}属性 · ${m.specialty ? (Array.isArray(m.specialty)?m.specialty.map(s=>"得意"+s).join(" "):"得意"+m.specialty) : ""}</div>
      </div>
    </div>`;
  }).join("");
}

// 武器盘网格（主手 + 副手）
function renderWeaponGrid(cache){
  const el = document.getElementById("wp-grid");
  const deckData = cache.deck && cache.deck.data;
  const pc = deckPC(normalizeDeck(deckData));
  let weps = (pc && pc.weapons) ? Object.values(pc.weapons) : [];
  if(!weps.length){
    const raw = cache.weapon && cache.weapon.data;
    if(raw && raw.list) weps = raw.list.slice(0,13);
  }
  if(!weps.length){ el.innerHTML='<i class="muted">暂无武器数据</i>'; return; }
  el.innerHTML = weps.map((it,idx)=>{
    const m = it.master||{}, p = it.param||{};
    const name = (m && m.name) || "";
    const attr = m.element !== undefined ? m.element : p.element;
    const atk = p.attack !== undefined ? p.attack : m.attack;
    let skillName = "";
    for(let i=1;i<=4;i++){ if(it["skill"+i] && it["skill"+i].name){ skillName = it["skill"+i].name; break; } }
    return `<div class="wp-cell${idx===0?' main':''}">
      <span class="wp-tag">${idx===0?'主手':(charTag(attr))}</span>
      <div class="wp-icon" style="border:2px solid ${charColor(attr)}">🗡️</div>
      <div class="wp-name">${name||it.id}</div>
      <div class="wp-atk">攻 ${atk||"-"}</div>
      ${skillName?`<div class="wp-skill">${skillName}</div>`:""}
    </div>`;
  }).join("");
}

// 召唤栏（主召唤 + 副召唤）
function renderSummonGrid(cache){
  const el = document.getElementById("sm-grid");
  const deckData = cache.deck && cache.deck.data;
  const pc = deckPC(normalizeDeck(deckData));
  let sums = (pc && pc.summons) ? Object.values(pc.summons) : [];
  if(!sums.length){
    const raw = cache.summon && cache.summon.data;
    if(raw && raw.list) sums = raw.list.slice(0,6);
  }
  if(!sums.length){ el.innerHTML='<i class="muted">暂无召唤数据</i>'; return; }
  el.innerHTML = sums.map((it,idx)=>{
    const m = it.master||{}, p = it.param||{};
    const name = (m && m.name) || "";
    const attr = m.element !== undefined ? m.element : p.element;
    const atk = p.attack||m.attack||"-";
    return `<div class="sm-cell${idx===0?' main':''}">
      <div class="sm-icon" style="border:2px solid ${charColor(attr)}">${charTag(attr)||"✨"}</div>
      <div class="sm-name">${name||it.id}</div>
      <div class="sm-meta">${ATTR_NAME[attr]||""} · 攻 ${atk}</div>
    </div>`;
  }).join("");
}

// 数值统计：先展示可用基础统计（完整攻刃引擎后续）
function renderStatEstimate(cache){
  const el = document.getElementById("stats");
  const deckData = cache.deck && cache.deck.data;
  const weps = (deckData && deckData.deck && deckData.deck.pc && deckData.deck.pc.weapons)
    ? Object.values(deckData.deck.pc.weapons) : [];
  if(!weps.length){ el.innerHTML='<i class="muted">数值引擎待接入（参考 Tarou 攻刃/EX/浑身计算）</i>'; return; }
  // 简化的攻刃估算：按武器数量 + 技能类型粗分（占位，真实公式后续实现）
  const totalAtk = weps.reduce((s,w)=> s + Number((w.param&&w.param.attack)||(w.master&&w.master.attack)||0), 0);
  const attrs = weps.reduce((s,w)=>{ const a=String((w.master&&w.master.element)||(w.param&&w.param.element)); s[a]=(s[a]||0)+1; return s;},{});
  const rows = [
    ["武器数", weps.length + " 把", Math.min(100, weps.length*8)],
    ["总攻击", totalAtk.toLocaleString(), Math.min(100, totalAtk/2000)],
    ["主属性", (Object.entries(attrs).sort((a,b)=>b[1]-a[1])[0]||["?",""])[0]+"属 x"+(Object.values(attrs)[0]||0), 60],
  ];
  el.innerHTML = rows.map(([label,val,bar])=>`
    <div class="stat-row">
      <span class="label">${label}</span>
      <span class="val">${val}</span>
    </div>
    <div class="bar"><i style="width:${bar}%"></i></div>`).join("")
    + '<div class="muted" style="margin-top:8px">⚠️ 当前为基础统计，完整「攻刃/EX/浑身」精细计算引擎为下一步 TODO</div>';
}

// 保留原渲染调用
function refreshAll(){ refresh(); }
const refreshBtn = document.getElementById("btn-refresh");
if (refreshBtn) refreshBtn.addEventListener("click", refreshAll);

// ===== Tab 切换：配队读取 | 战斗事件 =====
function bindTabs() {
  const deckBtn = document.getElementById("tab-btn-deck");
  const battleBtn = document.getElementById("tab-btn-battle");
  const deckPanel = document.getElementById("panel-deck");
  const battlePanel = document.getElementById("panel-battle");
  if (!deckBtn || !battleBtn || !deckPanel || !battlePanel) return;
  function select(which) {
    const isDeck = which === "deck";
    deckBtn.classList.toggle("active", isDeck);
    battleBtn.classList.toggle("active", !isDeck);
    deckPanel.style.display = isDeck ? "" : "none";
    battlePanel.style.display = isDeck ? "none" : "";
  }
  deckBtn.addEventListener("click", () => select("deck"));
  battleBtn.addEventListener("click", () => select("battle"));
  return select;
}
const selectTab = bindTabs();

// ===== 实时监听：数据到位自动重渲染，无需手动点击 =====
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  // 数据缓存、诊断、最近请求 或 战斗事件 任一变化都触发刷新展示
  if (changes["gugu_gbf_data"] || changes["gugu_gbf_dbg"] || changes["gugu_gbf_recent"] || changes["gugu_gbf_battle"]) {
    refresh();
  }
});
liveRefresh(true);
function liveRefresh(first) {
  if (first) refresh();
}